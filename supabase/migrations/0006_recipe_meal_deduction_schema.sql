-- KitchenMind — Migration 0006: Phase 4B Recipe Engine & Automated Meal Stock Deduction

-- 1. Recipes: support household-owned custom recipes alongside the existing global catalogue.
-- household_id stays NULL for global master recipes (0001 behavior is unchanged for those rows).
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.household(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS recipes_household_id_idx ON public.recipes(household_id);

-- The pre-0006 policy ("recipes: authenticated read") let any authenticated user read every
-- row in the table. That was safe while recipes were global-only; it would leak custom
-- household recipes cross-tenant now that household_id exists, so it must be replaced rather
-- than left in place alongside the new policies.
DROP POLICY IF EXISTS "recipes: authenticated read" ON public.recipes;

DROP POLICY IF EXISTS "recipes: global catalogue read" ON public.recipes;
CREATE POLICY "recipes: global catalogue read"
  ON public.recipes FOR SELECT
  USING (household_id IS NULL AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "recipes: household custom recipes" ON public.recipes;
CREATE POLICY "recipes: household custom recipes"
  ON public.recipes FOR ALL
  USING (household_id = auth_household_id())
  WITH CHECK (household_id = auth_household_id());

-- 2. meal_log: track when a meal actually transitioned to 'cooked'.
ALTER TABLE public.meal_log ADD COLUMN IF NOT EXISTS cooked_at timestamptz;

-- 3. stock_deductions: link each deduction to the specific batch it was drawn from (FIFO audit
-- trail), consistent with how inventory_batches/inventory_transactions already work for
-- purchases (0004). household_id is denormalized here (rather than only reachable via a
-- meal_log join) purely for query/index efficiency — RLS still also covers it via meal_log.
ALTER TABLE public.stock_deductions ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.inventory_batches(id) ON DELETE SET NULL;
ALTER TABLE public.stock_deductions ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.household(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS stock_deductions_household_id_idx ON public.stock_deductions(household_id);
CREATE INDEX IF NOT EXISTS stock_deductions_batch_id_idx ON public.stock_deductions(batch_id);

-- 4. Stored Procedure: mark_meal_cooked
-- Atomically transitions a meal_log to 'cooked' and FIFO-deducts each required ingredient
-- across active inventory_batches (soonest expiry first, matching docs/09 §5's documented
-- pipeline). Required ingredients are computed client-side (recipe ingredients scaled by
-- servings, roti flour requirement) and passed in — the same client-computes/RPC-persists
-- split already established by commit_scanned_bill (0004), not a new pattern.
CREATE OR REPLACE FUNCTION public.mark_meal_cooked(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_household_id uuid;
  v_meal_log_id uuid;
  v_required_ingredients jsonb;
  v_existing_status text;
  v_existing_cooked_at timestamptz;

  v_ingredient record;
  v_batch record;
  v_remaining_to_deduct numeric(10,3);
  v_deduct_from_batch numeric(10,3);
  v_inventory_id uuid;
  v_ingredient_deducted numeric(10,3);
  v_ingredient_shortfall numeric(10,3);
  v_deductions jsonb := '[]'::jsonb;
  v_any_shortfall boolean := false;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) != 'object' THEN
    RAISE EXCEPTION 'RPC_INVALID_PAYLOAD: Payload must be a non-null JSON object';
  END IF;

  v_household_id := (p_payload->>'household_id')::uuid;
  v_meal_log_id := (p_payload->>'meal_log_id')::uuid;
  v_required_ingredients := p_payload->'required_ingredients';

  IF v_household_id IS NULL OR v_meal_log_id IS NULL THEN
    RAISE EXCEPTION 'RPC_MISSING_REQUIRED_FIELDS: household_id and meal_log_id are required';
  END IF;

  -- Unconditional membership check — see 0004's commit_scanned_bill for why this must never be
  -- conditioned on auth.uid() being non-null.
  PERFORM 1 FROM public.members WHERE household_id = v_household_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RPC_UNAUTHORIZED: User does not belong to the specified household';
  END IF;

  SELECT status, cooked_at INTO v_existing_status, v_existing_cooked_at
  FROM public.meal_log
  WHERE id = v_meal_log_id AND household_id = v_household_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RPC_NOT_FOUND: meal_log does not exist for this household';
  END IF;

  -- Idempotent short-circuit: a meal already marked cooked is not re-deducted. Without this,
  -- a duplicate "mark as cooked" tap/retry would silently double-deduct the pantry.
  IF v_existing_status = 'cooked' THEN
    RETURN jsonb_build_object(
      'success', true,
      'meal_log_id', v_meal_log_id,
      'already_cooked', true,
      'cooked_at', v_existing_cooked_at,
      'deductions', '[]'::jsonb
    );
  END IF;

  IF v_required_ingredients IS NULL OR jsonb_typeof(v_required_ingredients) != 'array' THEN
    RAISE EXCEPTION 'RPC_INVALID_ITEMS: required_ingredients must be a JSON array';
  END IF;

  -- Sorted by canonical_name for the same deadlock-avoidance reason as commit_scanned_bill.
  FOR v_ingredient IN
    SELECT
      (elem->>'canonical_name')::text AS canonical_name,
      COALESCE((elem->>'quantity_grams')::numeric, 0)::numeric(10,3) AS quantity_grams
    FROM jsonb_array_elements(v_required_ingredients) AS elem
    ORDER BY (elem->>'canonical_name') ASC
  LOOP
    IF v_ingredient.canonical_name IS NULL OR v_ingredient.canonical_name = '' OR v_ingredient.quantity_grams <= 0 THEN
      CONTINUE;
    END IF;

    SELECT id INTO v_inventory_id
    FROM public.inventory
    WHERE household_id = v_household_id AND canonical_name = v_ingredient.canonical_name;

    v_remaining_to_deduct := v_ingredient.quantity_grams;
    v_ingredient_deducted := 0;

    IF v_inventory_id IS NOT NULL THEN
      -- FIFO: soonest expiry first: NULLs (no expiry set) sort last, then oldest purchase first.
      FOR v_batch IN
        SELECT id, remaining_grams
        FROM public.inventory_batches
        WHERE inventory_id = v_inventory_id AND status = 'active' AND remaining_grams > 0
        ORDER BY (expiry_date IS NULL), expiry_date ASC, purchase_date ASC
        FOR UPDATE
      LOOP
        EXIT WHEN v_remaining_to_deduct <= 0;

        v_deduct_from_batch := LEAST(v_batch.remaining_grams, v_remaining_to_deduct);

        UPDATE public.inventory_batches
        SET remaining_grams = remaining_grams - v_deduct_from_batch,
            status = CASE WHEN remaining_grams - v_deduct_from_batch <= 0 THEN 'depleted' ELSE status END
        WHERE id = v_batch.id;

        INSERT INTO public.inventory_transactions (
          household_id, inventory_id, batch_id, transaction_type, quantity_grams, created_at
        ) VALUES (
          v_household_id, v_inventory_id, v_batch.id, 'cooking_deduction', -v_deduct_from_batch, NOW()
        );

        INSERT INTO public.stock_deductions (
          meal_log_id, inventory_id, batch_id, household_id, grams_deducted, deducted_at
        ) VALUES (
          v_meal_log_id, v_inventory_id, v_batch.id, v_household_id, v_deduct_from_batch, NOW()
        );

        v_remaining_to_deduct := v_remaining_to_deduct - v_deduct_from_batch;
        v_ingredient_deducted := v_ingredient_deducted + v_deduct_from_batch;
      END LOOP;

      IF v_ingredient_deducted > 0 THEN
        UPDATE public.inventory
        SET quantity_grams = GREATEST(0, quantity_grams - v_ingredient_deducted),
            last_updated = NOW()
        WHERE id = v_inventory_id;
      END IF;
    END IF;

    v_ingredient_shortfall := v_ingredient.quantity_grams - v_ingredient_deducted;
    IF v_ingredient_shortfall > 0 THEN
      v_any_shortfall := true;
    END IF;

    v_deductions := v_deductions || jsonb_build_object(
      'canonical_name', v_ingredient.canonical_name,
      'required_grams', v_ingredient.quantity_grams,
      'deducted_grams', v_ingredient_deducted,
      'shortfall_grams', GREATEST(0, v_ingredient_shortfall),
      'out_of_stock', v_ingredient_shortfall > 0
    );
  END LOOP;

  UPDATE public.meal_log
  SET status = 'cooked', cooked_at = NOW()
  WHERE id = v_meal_log_id;

  RETURN jsonb_build_object(
    'success', true,
    'meal_log_id', v_meal_log_id,
    'already_cooked', false,
    'cooked_at', NOW(),
    'has_shortfall', v_any_shortfall,
    'deductions', v_deductions
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- Same anon-role hardening as commit_scanned_bill (0004).
REVOKE ALL ON FUNCTION public.mark_meal_cooked(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_meal_cooked(jsonb) TO authenticated;
