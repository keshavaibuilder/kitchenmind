-- KitchenMind — Migration 0015: Semantic inventory quantity columns
--
-- Additive schema for preserving structured purchase/pack quantity data alongside the
-- existing base-unit scalars (inventory.quantity_grams, inventory_batches.initial_grams /
-- remaining_grams, bill_items.quantity_value / unit_grams). Those existing columns are left
-- completely untouched — despite the historical name "quantity_grams" they may represent
-- grams, kg-converted-to-g, ml, or L-converted-to-ml. The new base_unit column on inventory
-- and inventory_batches explicitly records which physical scale that number is actually in
-- ('g', 'ml', or 'pcs'), which today is only ever implied and frequently ambiguous.
--
-- All new columns are nullable with no default: existing rows (created before this migration,
-- via the old qualitative/andaaza display path) must continue to read back exactly as they do
-- today — NULL here means "no semantic data available", which the application is expected to
-- treat as an explicit fallback trigger, not an error or a fabricated value.
--
-- Does not modify 0004, 0012, 0013, or 0014. Does not rename or drop any existing column.
-- Does not touch any row's existing data.

BEGIN;

-- ── inventory ─────────────────────────────────────────────────────────────────
-- purchase_quantity: cumulative lifetime total ever purchased, in purchase_unit terms
--   (e.g. 9 for "9 pcs", 5.036 for "5.036 kg"). Grows on every reconciled purchase.
-- purchase_unit: the unit purchase_quantity/remaining_quantity are expressed in — 'pcs' for
--   any packaged item (packSize known), or the item's own measured unit ('kg', 'g', 'l', 'ml')
--   for loose/unpackaged items.
-- remaining_quantity: current on-hand stock in purchase_unit terms. Starts equal to the
--   purchase_quantity of the first purchase; decreases with consumption, increases with
--   further compatible purchases — mirrors quantity_grams, expressed in the human-facing unit.
-- pack_size / pack_unit: size and unit of ONE pack as printed on the product (e.g. 110 / 'g'
--   for a Vim pouch). NULL for loose/unpackaged items — never fabricated.
-- base_unit: the physical scale quantity_grams/remaining_grams-equivalent numbers on this row
--   are actually measured in: 'g' (weight), 'ml' (volume), or 'pcs' (count, only when no real
--   weight/volume conversion is known — never a fabricated grams-per-piece guess).
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS purchase_quantity numeric(10, 3);
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS purchase_unit text;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS remaining_quantity numeric(10, 3);
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS pack_size numeric(10, 3);
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS pack_unit text;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS base_unit text;

-- ── inventory_batches ────────────────────────────────────────────────────────
-- Same six columns, scoped to a single purchase batch instead of the household-wide
-- aggregate. Unlike the `inventory` row (one per canonical item, which can only hold one
-- pack signature at a time — see migration 0016's accumulation logic), each batch is a
-- single purchase event, so it always retains its own exact purchase_quantity/pack_size
-- regardless of what other batches for the same item look like. This is what lets mixed
-- pack sizes (e.g. a 110g batch and a 250g batch of the same item) stay fully accurate at
-- the batch/FIFO level even when the household-wide `inventory` summary falls back to
-- base-unit-only display for that item.
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS purchase_quantity numeric(10, 3);
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS purchase_unit text;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS remaining_quantity numeric(10, 3);
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS pack_size numeric(10, 3);
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS pack_unit text;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS base_unit text;

-- ── bill_items ───────────────────────────────────────────────────────────────
-- Line-item audit trail only — bill_items rows are never merged/accumulated, so there is no
-- remaining_quantity here (nothing is ever "remaining" on a historical bill line).
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS purchase_quantity numeric(10, 3);
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS purchase_unit text;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS pack_size numeric(10, 3);
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS pack_unit text;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS base_unit text;

COMMIT;
