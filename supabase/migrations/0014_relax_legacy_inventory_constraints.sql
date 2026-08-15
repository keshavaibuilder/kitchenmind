BEGIN;

ALTER TABLE public.inventory_batches
  ALTER COLUMN quantity_grams DROP NOT NULL,
  ALTER COLUMN remaining_quantity_grams DROP NOT NULL;

ALTER TABLE public.inventory_transactions
  ALTER COLUMN transaction_type_id DROP NOT NULL,
  ALTER COLUMN quantity_change_grams DROP NOT NULL;

COMMIT;
