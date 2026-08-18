-- KitchenMind — Migration 0018: Backfill base_unit for pre-0015 inventory rows
--
-- Migration 0015 added base_unit (and the other semantic quantity columns) as nullable with
-- no default, specifically so existing rows would keep reading back unchanged. The side effect:
-- every inventory row created before 0015/0016 shipped (v0.5.1) has base_unit = NULL forever.
-- src/lib/quantityFormat.js's formatInventoryQuantity() requires base_unit to be non-null, so
-- those rows fall back to the legacy qualitative andaaza display ("Thoda sa", "Ek chammach")
-- indefinitely — they only self-heal if that exact canonical_name is purchased/scanned again
-- (commit_scanned_bill's upsert stamps base_unit onto the row at that point).
--
-- base_unit is fully and safely derivable from the existing display_unit column — NOT NULL,
-- default 'g' since 0001 — using the same mapping as deriveBaseUnit() (src/utils/units.js).
-- quantity_grams / initial_grams / remaining_grams are left completely untouched: they already
-- hold the correct number in that base_unit's scale, nothing is recomputed or fabricated here.
-- No pack_size/purchase_quantity is backfilled — those genuinely aren't knowable for historical
-- rows, so those items will simply show a plain "N g / N ml / N pcs" instead of the packaged
-- "N pcs x P unit" view, which matches the "never fabricate" rule already used elsewhere.

BEGIN;

UPDATE public.inventory
SET base_unit = CASE
  WHEN lower(trim(display_unit)) IN ('kg', 'g') THEN 'g'
  WHEN lower(trim(display_unit)) IN ('l', 'ltr', 'ltrs', 'litre', 'liter', 'litres', 'liters') THEN 'ml'
  WHEN lower(trim(display_unit)) = 'ml' THEN 'ml'
  WHEN lower(trim(display_unit)) = 'pcs' THEN 'pcs'
  ELSE 'g'
END
WHERE base_unit IS NULL;

-- inventory_batches never carried its own unit column — each batch has always been in the
-- same scale as its parent inventory row's display_unit, so the now-backfilled parent's
-- base_unit is the correct value here too.
UPDATE public.inventory_batches b
SET base_unit = i.base_unit
FROM public.inventory i
WHERE b.inventory_id = i.id AND b.base_unit IS NULL;

COMMIT;
