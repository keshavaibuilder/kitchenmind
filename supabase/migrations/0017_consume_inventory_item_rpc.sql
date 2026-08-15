-- KitchenMind — Migration 0017: consume_inventory_item() — manual semantic consumption
--
-- New RPC for manual inventory consumption ("I used 500ml mustard oil", "I used 1 Vim"),
-- separate from and does not replace mark_meal_cooked() (0006/0009), which remains the
-- recipe-cooking deduction path. Architecturally mirrors mark_meal_cooked's FIFO batch
-- deduction: soonest-expiry-first across active inventory_batches, row-locked with
-- FOR UPDATE, one inventory_transactions row per batch touched.
--
-- The RPC receives base_quantity already converted to the item's base_unit scale by the
-- application (src/utils/units.js / InventoryConsumptionService.js) — it performs no unit
-- conversion or interpretation itself, only additive/comparison arithmetic on numbers it's
-- given, exactly like commit_scanned_bill() already does for unit_grams. This keeps all
-- unit-semantics decisions (what "500 ml" or "1 pc" means for this specific item) in
-- deterministic application code, never in the RPC and never in an LLM.
--
-- Per-batch purchase_quantity deduction is derived from each batch's own immutable
-- purchase_quantity / initial_grams ratio (set once at batch creation in 0016) rather than
-- being passed in — this is exact for both packaged items (the ratio equals pack_size) and
-- loose items (the ratio equals the kg/L-to-base-unit factor), and stays correct per-batch
-- even when sibling batches of the same item carry a different pack signature.

CREATE OR REPLACE FUNCTION public.consume_inventory_item(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_household_id uuid;
  v_item_id uuid;
  v_base_quantity numeric(10,3);
  v_transaction_type text;

  v_inventory record;
  v_batch record;
  v_remaining_to_deduct numeric(10,3);
  v_deduct_from_batch numeric(10,3);
  v_batch_purchase_deducted numeric(10,3);
  v_total_deducted numeric(10,3) := 0;
  v_purchase_deducted_total numeric(10,3) := 0;
  v_any_purchase_null boolean := false;
  v_available numeric(10,3);
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) != 'object' THEN
    RAISE EXCEPTION 'RPC_INVALID_PAYLOAD: Payload must be a non-null JSON object';
  END IF;

  v_household_id := (p_payload->>'household_id')::uuid;
  v_item_id := (p_payload->>'item_id')::uuid;
  v_base_quantity := (p_payload->>'base_quantity')::numeric;
  v_transaction_type := COALESCE(p_payload->>'transaction_type', 'manual_adjustment');

  IF v_household_id IS NULL OR v_item_id IS NULL THEN
    RAISE EXCEPTION 'RPC_MISSING_REQUIRED_FIELDS: household_id and item_id are required';
  END IF;

  IF v_base_quantity IS NULL OR v_base_quantity <= 0 THEN
    RAISE EXCEPTION 'RPC_INVALID_QUANTITY: base_quantity must be greater than 0';
  END IF;

  -- 'purchase' and 'cooking_deduction' have their own dedicated RPCs (commit_scanned_bill,
  -- mark_meal_cooked) and must not be reachable through this manual-consumption path.
  IF v_transaction_type NOT IN ('manual_adjustment', 'spoilage') THEN
    RAISE EXCEPTION 'RPC_INVALID_TRANSACTION_TYPE: % is not a valid manual consumption type', v_transaction_type;
  END IF;

  -- Unconditional membership check — see 0004's commit_scanned_bill for why this must never
  -- be conditioned on auth.uid() being non-null.
  PERFORM 1 FROM public.members WHERE household_id = v_household_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RPC_UNAUTHORIZED: User does not belong to the specified household';
  END IF;

  SELECT id, quantity_grams, remaining_quantity, purchase_quantity, base_unit
  INTO v_inventory
  FROM public.inventory
  WHERE id = v_item_id AND household_id = v_household_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RPC_NOT_FOUND: inventory item does not exist for this household';
  END IF;

  SELECT COALESCE(SUM(remaining_grams), 0) INTO v_available
  FROM public.inventory_batches
  WHERE inventory_id = v_inventory.id AND status = 'active';

  -- Manual consumption is a user-declared "I used X now", not a recipe with a real-world
  -- fait-accompli like mark_meal_cooked's shortfall-tolerant deduction — if the household
  -- doesn't have enough on hand, reject outright rather than silently over-deducting.
  IF v_available < v_base_quantity THEN
    RAISE EXCEPTION 'RPC_INSUFFICIENT_STOCK: requested % exceeds available % for this item', v_base_quantity, v_available;
  END IF;

  v_remaining_to_deduct := v_base_quantity;

  FOR v_batch IN
    SELECT id, remaining_grams, purchase_quantity, initial_grams
    FROM public.inventory_batches
    WHERE inventory_id = v_inventory.id AND status = 'active' AND remaining_grams > 0
    ORDER BY (expiry_date IS NULL), expiry_date ASC, purchase_date ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining_to_deduct <= 0;

    v_deduct_from_batch := LEAST(v_batch.remaining_grams, v_remaining_to_deduct);

    IF v_batch.purchase_quantity IS NOT NULL AND v_batch.initial_grams > 0 THEN
      v_batch_purchase_deducted := v_deduct_from_batch * v_batch.purchase_quantity / v_batch.initial_grams;
    ELSE
      v_batch_purchase_deducted := NULL;
      v_any_purchase_null := true;
    END IF;

    UPDATE public.inventory_batches
    SET remaining_grams = remaining_grams - v_deduct_from_batch,
        remaining_quantity = CASE WHEN v_batch_purchase_deducted IS NOT NULL
          THEN GREATEST(0, COALESCE(remaining_quantity, 0) - v_batch_purchase_deducted)
          ELSE remaining_quantity END,
        status = CASE WHEN remaining_grams - v_deduct_from_batch <= 0 THEN 'depleted' ELSE status END
    WHERE id = v_batch.id;

    INSERT INTO public.inventory_transactions (
      household_id, inventory_id, batch_id, transaction_type, quantity_grams, created_at
    ) VALUES (
      v_household_id, v_inventory.id, v_batch.id, v_transaction_type, -v_deduct_from_batch, NOW()
    );

    v_remaining_to_deduct := v_remaining_to_deduct - v_deduct_from_batch;
    v_total_deducted := v_total_deducted + v_deduct_from_batch;
    IF v_batch_purchase_deducted IS NOT NULL THEN
      v_purchase_deducted_total := v_purchase_deducted_total + v_batch_purchase_deducted;
    END IF;
  END LOOP;

  UPDATE public.inventory
  SET quantity_grams = GREATEST(0, quantity_grams - v_total_deducted),
      remaining_quantity = CASE WHEN NOT v_any_purchase_null AND remaining_quantity IS NOT NULL
        THEN GREATEST(0, remaining_quantity - v_purchase_deducted_total)
        ELSE remaining_quantity END,
      last_updated = NOW()
  WHERE id = v_inventory.id;

  RETURN jsonb_build_object(
    'success', true,
    'item_id', v_inventory.id,
    'household_id', v_household_id,
    'base_quantity_deducted', v_total_deducted,
    'purchase_quantity_deducted', CASE WHEN v_any_purchase_null THEN NULL ELSE v_purchase_deducted_total END,
    'committed_at', NOW()
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_inventory_item(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_inventory_item(jsonb) TO authenticated;
