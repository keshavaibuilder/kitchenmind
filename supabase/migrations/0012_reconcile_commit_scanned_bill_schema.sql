-- KitchenMind — Migration 0012: LIVE schema reconciliation for commit_scanned_bill (0004)
--
-- 0004_rpc_commit_scanned_bill.sql was never fully applied to this project. Its
-- `CREATE TABLE IF NOT EXISTS` statements for inventory_batches/inventory_transactions
-- silently no-op here because those two tables already exist under an incompatible,
-- narrower schema (missing several columns commit_scanned_bill writes to). This migration
-- reconciles that drift additively — ADD COLUMN IF NOT EXISTS only, no drops, no rewrites,
-- no data changes — then creates the two missing unique indexes and the function itself,
-- whose body below is copied verbatim from 0004 (no business-logic changes).
--
-- Pre-deployment read-only checks already performed against this project (see the forensic
-- session record) and relied on for the safety of this file:
--   - inventory_batches row count = 0
--   - inventory_transactions row count = 0
--   - duplicate (household_id, canonical_name) check on inventory returned zero rows
-- Both are why the NOT NULL column adds and the two CREATE UNIQUE INDEX statements below
-- cannot fail against existing data. Do not run this file if either precondition has changed
-- since those checks were performed — re-verify with the queries in this file's companion
-- report before executing.

BEGIN;

-- ── A. public.bills ──────────────────────────────────────────────────────────
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS merchant text;

-- Safe: idempotency_key is being added fresh, so every existing bills row gets NULL, and
-- Postgres unique indexes never treat NULL as colliding with another NULL — cannot fail.
CREATE UNIQUE INDEX IF NOT EXISTS bills_household_idempotency_idx
  ON public.bills(household_id, idempotency_key);

-- ── B. public.inventory ──────────────────────────────────────────────────────
-- Safe: live duplicate audit on (household_id, canonical_name) returned zero rows.
-- No existing inventory rows are read, modified, or merged by this statement.
CREATE UNIQUE INDEX IF NOT EXISTS inventory_household_canonical_idx
  ON public.inventory(household_id, canonical_name);

-- ── C. public.inventory_batches — additive column reconciliation only ────────
-- Table already exists live with 0 confirmed rows. NOT NULL columns with no default are
-- safe to add here specifically because there are no existing rows to violate the
-- constraint; this would NOT be safe to replay if the table were ever populated.
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS initial_grams numeric(10, 3) NOT NULL;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS remaining_grams numeric(10, 3) NOT NULL;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS cost numeric(10, 2);
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS status text NOT NULL
  CHECK (status IN ('active', 'depleted', 'expired')) DEFAULT 'active';

-- ── D. public.inventory_transactions — additive column reconciliation only ───
-- Table already exists live with 0 confirmed rows.
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS batch_id uuid
  REFERENCES public.inventory_batches(id) ON DELETE SET NULL;
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS bill_id uuid
  REFERENCES public.bills(id) ON DELETE SET NULL;
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS transaction_type text NOT NULL
  CHECK (transaction_type IN ('purchase', 'cooking_deduction', 'manual_adjustment', 'spoilage'));
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS quantity_grams numeric(10, 3) NOT NULL;
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS cost numeric(10, 2);

-- ── G. auth_household_id() hardening ─────────────────────────────────────────
-- Idempotent regardless of current state: setting an already-correct search_path, or setting
-- it for the first time, both succeed identically with no functional change to the function's
-- resolution behavior (its body only references public-schema objects and auth.uid()).
-- Included unconditionally because this session has no service-role/DB access to jrfuyjemopkbntvaziab
-- to query pg_proc directly and confirm current search_path before deciding whether to run it.
ALTER FUNCTION public.auth_household_id() SET search_path = public, pg_temp;

-- ── E. commit_scanned_bill — verbatim from 0004_rpc_commit_scanned_bill.sql ──────────────
-- Body copied unchanged: authorization check, idempotency-keyed insert, bill_items insert,
-- inventory upsert, inventory_batches insert, inventory_transactions insert, JSON response
-- contract, and exception behavior are all identical to 0004. Only the schema this function
-- depends on (sections A-D above) has changed to make it actually runnable on this project.
CREATE OR REPLACE FUNCTION public.commit_scanned_bill(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_household_id uuid;
  v_idempotency_key text;
  v_merchant text;
  v_bill_date date;
  v_total_amount numeric(10,2);
  v_source text;
  v_items jsonb;

  v_existing_bill_id uuid;
  v_bill_id uuid;
  v_commit_id uuid;

  v_item record;
  v_bill_item_id uuid;
  v_inventory_id uuid;
  v_batch_id uuid;
  v_transaction_id uuid;

  v_items_count int := 0;
  v_inventory_count int := 0;
  v_batches_count int := 0;
  v_transactions_count int := 0;
BEGIN
  -- 1. Check Payload Not Null
  IF p_payload IS NULL OR jsonb_typeof(p_payload) != 'object' THEN
    RAISE EXCEPTION 'RPC_INVALID_PAYLOAD: Payload must be a non-null JSON object';
  END IF;

  -- 2. Extract & Validate Required Fields
  v_household_id := (p_payload->>'household_id')::uuid;
  v_idempotency_key := p_payload->>'idempotency_key';
  v_merchant := p_payload->>'merchant';
  v_bill_date := COALESCE((p_payload->>'bill_date')::date, CURRENT_DATE);
  v_total_amount := COALESCE((p_payload->>'total_amount')::numeric, 0.00);
  v_source := COALESCE(p_payload->>'source', 'scan');
  v_items := p_payload->'items';

  IF v_household_id IS NULL OR v_idempotency_key IS NULL OR v_idempotency_key = '' THEN
    RAISE EXCEPTION 'RPC_MISSING_REQUIRED_FIELDS: household_id and idempotency_key are required';
  END IF;

  IF v_items IS NULL OR jsonb_typeof(v_items) != 'array' OR jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'RPC_INVALID_ITEMS: items array must be a non-empty JSON array';
  END IF;

  -- 3. Verify Household Membership (Authorization Guard).
  -- No conditional on auth.uid() being NULL: an unauthenticated caller (anon role) has
  -- auth.uid() = NULL, which never matches user_id via `=`, so this always raises for them.
  -- (REVOKE/GRANT below also blocks the anon role at the Postgres privilege layer, in depth.)
  PERFORM 1 FROM public.members WHERE household_id = v_household_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RPC_UNAUTHORIZED: User does not belong to the specified household';
  END IF;

  -- 4. Generate new identifiers & attempt an atomic insert.
  -- INSERT ... ON CONFLICT DO NOTHING makes idempotency-key detection race-free: with a plain
  -- SELECT-then-INSERT, two concurrent commits of the same idempotency_key can both pass the
  -- SELECT before either writes, and the second INSERT would then raise a raw unique_violation
  -- instead of returning a graceful duplicate response. FOUND is set to false by PL/pgSQL when
  -- ON CONFLICT DO NOTHING suppresses the insert, so it reliably tells us which caller won the race.
  v_bill_id := gen_random_uuid();
  v_commit_id := gen_random_uuid();

  INSERT INTO public.bills (
    id,
    household_id,
    idempotency_key,
    bill_date,
    merchant,
    total_amount,
    source,
    created_at
  ) VALUES (
    v_bill_id,
    v_household_id,
    v_idempotency_key,
    v_bill_date,
    v_merchant,
    v_total_amount,
    v_source,
    NOW()
  )
  ON CONFLICT (household_id, idempotency_key) DO NOTHING;

  IF NOT FOUND THEN
    -- Another concurrent call (or a client retry) already committed this idempotency key.
    SELECT id INTO v_existing_bill_id
    FROM public.bills
    WHERE household_id = v_household_id AND idempotency_key = v_idempotency_key;

    SELECT COUNT(*) INTO v_items_count FROM public.bill_items WHERE bill_id = v_existing_bill_id;
    SELECT COUNT(*) INTO v_batches_count FROM public.inventory_batches WHERE bill_item_id IN (SELECT id FROM public.bill_items WHERE bill_id = v_existing_bill_id);

    RETURN jsonb_build_object(
      'success', true,
      'commit_id', gen_random_uuid(),
      'bill_id', v_existing_bill_id,
      'household_id', v_household_id,
      'idempotency_key', v_idempotency_key,
      'is_duplicate', true,
      'metrics', jsonb_build_object(
        'bill_items_created', v_items_count,
        'inventory_updated', v_items_count,
        'batches_created', v_batches_count,
        'transactions_recorded', v_batches_count
      ),
      'committed_at', NOW()
    );
  END IF;

  -- 6. Loop through Items (Sorted by canonical_name to prevent deadlocks under concurrency)
  FOR v_item IN
    SELECT
      (elem->>'item_name')::text AS item_name,
      (elem->>'canonical_name')::text AS canonical_name,
      COALESCE(elem->>'category', 'Miscellaneous')::text AS category,
      COALESCE((elem->>'quantity_value')::numeric, 1.0)::numeric(10,3) AS quantity_value,
      COALESCE(elem->>'unit', 'g')::text AS unit,
      COALESCE((elem->>'unit_grams')::numeric, 1.0)::numeric(10,3) AS unit_grams,
      (elem->>'cost')::numeric(10,2) AS cost
    FROM jsonb_array_elements(v_items) AS elem
    ORDER BY (elem->>'canonical_name') ASC
  LOOP
    IF v_item.canonical_name IS NULL OR v_item.canonical_name = '' THEN
      RAISE EXCEPTION 'RPC_INVALID_ITEMS: Each item must have a valid canonical_name';
    END IF;

    IF v_item.unit_grams <= 0 THEN
      RAISE EXCEPTION 'RPC_INVALID_ITEMS: Item unit_grams must be greater than 0';
    END IF;

    v_bill_item_id := gen_random_uuid();

    -- Step 6a: Create bill_items entry
    INSERT INTO public.bill_items (
      id,
      bill_id,
      item_name,
      category,
      quantity_value,
      andaaza_unit,
      unit_grams,
      cost,
      purchase_date
    ) VALUES (
      v_bill_item_id,
      v_bill_id,
      v_item.item_name,
      v_item.category,
      v_item.quantity_value,
      v_item.unit,
      v_item.unit_grams,
      v_item.cost,
      v_bill_date
    );
    v_items_count := v_items_count + 1;

    -- Step 6b: Atomic Inventory UPSERT
    INSERT INTO public.inventory (
      household_id,
      item_name,
      canonical_name,
      category,
      quantity_grams,
      display_unit,
      last_updated
    ) VALUES (
      v_household_id,
      v_item.canonical_name,
      v_item.canonical_name,
      v_item.category,
      v_item.unit_grams,
      v_item.unit,
      NOW()
    )
    ON CONFLICT (household_id, canonical_name)
    DO UPDATE SET
      quantity_grams = inventory.quantity_grams + EXCLUDED.quantity_grams,
      category = COALESCE(EXCLUDED.category, inventory.category),
      last_updated = NOW()
    RETURNING id INTO v_inventory_id;
    v_inventory_count := v_inventory_count + 1;

    -- Step 6c: Create inventory_batches entry
    v_batch_id := gen_random_uuid();
    INSERT INTO public.inventory_batches (
      id,
      inventory_id,
      bill_item_id,
      initial_grams,
      remaining_grams,
      cost,
      purchase_date,
      status,
      created_at
    ) VALUES (
      v_batch_id,
      v_inventory_id,
      v_bill_item_id,
      v_item.unit_grams,
      v_item.unit_grams,
      v_item.cost,
      v_bill_date,
      'active',
      NOW()
    );
    v_batches_count := v_batches_count + 1;

    -- Step 6d: Create inventory_transactions entry
    v_transaction_id := gen_random_uuid();
    INSERT INTO public.inventory_transactions (
      id,
      household_id,
      inventory_id,
      batch_id,
      bill_id,
      transaction_type,
      quantity_grams,
      cost,
      created_at
    ) VALUES (
      v_transaction_id,
      v_household_id,
      v_inventory_id,
      v_batch_id,
      v_bill_id,
      'purchase',
      v_item.unit_grams,
      v_item.cost,
      NOW()
    );
    v_transactions_count := v_transactions_count + 1;

  END LOOP;

  -- 7. Return Result Payload
  RETURN jsonb_build_object(
    'success', true,
    'commit_id', v_commit_id,
    'bill_id', v_bill_id,
    'household_id', v_household_id,
    'idempotency_key', v_idempotency_key,
    'is_duplicate', false,
    'metrics', jsonb_build_object(
      'bill_items_created', v_items_count,
      'inventory_updated', v_inventory_count,
      'batches_created', v_batches_count,
      'transactions_recorded', v_transactions_count
    ),
    'committed_at', NOW()
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- ── F. Permissions — identical to 0004 ────────────────────────────────────────
-- Postgres grants EXECUTE on new/replaced functions to PUBLIC by default, which includes
-- Supabase's `anon` role. This function is SECURITY DEFINER (bypasses RLS), so it must only
-- be reachable by authenticated sessions; the membership check above is defense in depth on
-- top of this, not a substitute for it.
REVOKE ALL ON FUNCTION public.commit_scanned_bill(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_scanned_bill(jsonb) TO authenticated;

COMMIT;
