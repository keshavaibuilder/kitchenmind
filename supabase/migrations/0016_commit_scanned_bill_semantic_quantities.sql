-- KitchenMind — Migration 0016: commit_scanned_bill() — semantic quantity persistence
--
-- Extends commit_scanned_bill() (unchanged since 0012) to also populate the semantic
-- quantity columns added in 0015 (purchase_quantity, purchase_unit, remaining_quantity,
-- pack_size, pack_unit, base_unit) on bill_items, inventory, and inventory_batches.
--
-- Every existing behavior is preserved verbatim: authorization, idempotency-keyed insert,
-- bill_items creation, inventory upsert, inventory_batches creation, inventory_transactions
-- creation, atomic rollback (implicit — the whole function still runs in the caller's
-- transaction), and the JSON response contract. Only the INSERT/UPDATE column lists are
-- extended. Does not modify 0004, 0012, 0013, or 0014.
--
-- The RPC does not compute any unit conversion or arithmetic itself — purchase_quantity,
-- pack_size, base_unit, and the base-quantity total (unit_grams) all arrive pre-computed
-- from BillPersistenceService.js, exactly as unit_grams already did before this migration.
-- This function only stores what it's given and performs pure additive/comparison logic.
--
-- ── inventory row accumulation (Task 6 of the approved plan) ──────────────────────────────
-- A single `inventory` row is the household-wide aggregate for one canonical item, so it can
-- only hold ONE pack signature (purchase_unit + pack_size + pack_unit + base_unit) at a time.
-- When a new purchase's signature matches the row's existing signature (or the row has no
-- signature yet — a pre-0015 row, or its first-ever semantic purchase), purchase_quantity and
-- remaining_quantity accumulate additively, same as quantity_grams already does. When the
-- signature differs (e.g. a 110g-pack purchase merging into a row already tracking 250g
-- packs), the semantic fields are reset to NULL rather than silently merged into a wrong
-- single pack_size — quantity_grams/remaining stays fully correct either way; only the
-- structured "N pcs x P unit" display falls back to a base-unit-only number for that item
-- until the packaging is consistent again. inventory_batches never has this problem: each
-- batch is a single purchase event and always keeps its own exact signature (see 0015).

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

  -- Semantic-signature reconciliation for the inventory row upsert (see header comment).
  v_existing_purchase_unit text;
  v_existing_pack_size numeric(10,3);
  v_existing_pack_unit text;
  v_existing_base_unit text;
  v_signature_matches boolean;
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
  PERFORM 1 FROM public.members WHERE household_id = v_household_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RPC_UNAUTHORIZED: User does not belong to the specified household';
  END IF;

  -- 4. Generate new identifiers & attempt an atomic insert.
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
      (elem->>'cost')::numeric(10,2) AS cost,
      -- Semantic quantity fields (0015). All nullable — never fabricated when the client
      -- couldn't determine them (e.g. no printed pack size on the bill).
      (elem->>'purchase_quantity')::numeric(10,3) AS purchase_quantity,
      (elem->>'purchase_unit')::text AS purchase_unit,
      (elem->>'pack_size')::numeric(10,3) AS pack_size,
      (elem->>'pack_unit')::text AS pack_unit,
      elem->>'base_unit' AS base_unit
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
      purchase_date,
      purchase_quantity,
      purchase_unit,
      pack_size,
      pack_unit,
      base_unit
    ) VALUES (
      v_bill_item_id,
      v_bill_id,
      v_item.item_name,
      v_item.category,
      v_item.quantity_value,
      v_item.unit,
      v_item.unit_grams,
      v_item.cost,
      v_bill_date,
      v_item.purchase_quantity,
      v_item.purchase_unit,
      v_item.pack_size,
      v_item.pack_unit,
      v_item.base_unit
    );
    v_items_count := v_items_count + 1;

    -- Step 6b: Atomic Inventory UPSERT — read the existing row's semantic signature first
    -- (if any) so the ON CONFLICT branch below knows whether to accumulate or reset the
    -- semantic fields. NULL existing purchase_unit means "no signature yet", which always
    -- matches (first semantic purchase for this row, including pre-0015 legacy rows).
    SELECT purchase_unit, pack_size, pack_unit, base_unit
    INTO v_existing_purchase_unit, v_existing_pack_size, v_existing_pack_unit, v_existing_base_unit
    FROM public.inventory
    WHERE household_id = v_household_id AND canonical_name = v_item.canonical_name;

    v_signature_matches := (
      v_existing_purchase_unit IS NULL
      OR (
        v_existing_purchase_unit = v_item.purchase_unit
        AND v_existing_pack_size IS NOT DISTINCT FROM v_item.pack_size
        AND v_existing_pack_unit IS NOT DISTINCT FROM v_item.pack_unit
        AND v_existing_base_unit IS NOT DISTINCT FROM v_item.base_unit
      )
    );

    INSERT INTO public.inventory (
      household_id,
      item_name,
      canonical_name,
      category,
      quantity_grams,
      display_unit,
      last_updated,
      purchase_quantity,
      purchase_unit,
      remaining_quantity,
      pack_size,
      pack_unit,
      base_unit
    ) VALUES (
      v_household_id,
      v_item.canonical_name,
      v_item.canonical_name,
      v_item.category,
      v_item.unit_grams,
      v_item.unit,
      NOW(),
      v_item.purchase_quantity,
      v_item.purchase_unit,
      v_item.purchase_quantity,
      v_item.pack_size,
      v_item.pack_unit,
      v_item.base_unit
    )
    ON CONFLICT (household_id, canonical_name)
    DO UPDATE SET
      quantity_grams = inventory.quantity_grams + EXCLUDED.quantity_grams,
      category = COALESCE(EXCLUDED.category, inventory.category),
      last_updated = NOW(),
      purchase_quantity = CASE WHEN v_signature_matches
        THEN COALESCE(inventory.purchase_quantity, 0) + COALESCE(EXCLUDED.purchase_quantity, 0)
        ELSE NULL END,
      remaining_quantity = CASE WHEN v_signature_matches
        THEN COALESCE(inventory.remaining_quantity, 0) + COALESCE(EXCLUDED.remaining_quantity, 0)
        ELSE NULL END,
      purchase_unit = CASE WHEN v_signature_matches THEN EXCLUDED.purchase_unit ELSE NULL END,
      pack_size = CASE WHEN v_signature_matches THEN EXCLUDED.pack_size ELSE NULL END,
      pack_unit = CASE WHEN v_signature_matches THEN EXCLUDED.pack_unit ELSE NULL END,
      base_unit = CASE WHEN v_signature_matches THEN EXCLUDED.base_unit ELSE inventory.base_unit END
    RETURNING id INTO v_inventory_id;
    v_inventory_count := v_inventory_count + 1;

    -- Step 6c: Create inventory_batches entry — always a new row per purchase, so it always
    -- retains its own exact signature regardless of what other batches for this item look
    -- like (no merge/accumulation logic needed here, unlike the inventory row above).
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
      created_at,
      purchase_quantity,
      purchase_unit,
      remaining_quantity,
      pack_size,
      pack_unit,
      base_unit
    ) VALUES (
      v_batch_id,
      v_inventory_id,
      v_bill_item_id,
      v_item.unit_grams,
      v_item.unit_grams,
      v_item.cost,
      v_bill_date,
      'active',
      NOW(),
      v_item.purchase_quantity,
      v_item.purchase_unit,
      v_item.purchase_quantity,
      v_item.pack_size,
      v_item.pack_unit,
      v_item.base_unit
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

-- Permissions — identical to 0004/0012, restated because CREATE OR REPLACE FUNCTION does not
-- reset a function's own grants, but explicitness here matches the previous migrations' style.
REVOKE ALL ON FUNCTION public.commit_scanned_bill(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_scanned_bill(jsonb) TO authenticated;
