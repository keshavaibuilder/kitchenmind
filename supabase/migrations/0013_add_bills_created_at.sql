-- KitchenMind — Migration 0013: Add public.bills.created_at
--
-- Corrective migration for the live 42703 error surfaced by commit_scanned_bill():
--   column "created_at" of relation "bills" does not exist
--
-- Root cause: public.bills was created in 0001_initial_schema.sql (id, household_id,
-- bill_date, total_amount, source) and later extended in 0004_rpc_commit_scanned_bill.sql /
-- 0012_reconcile_commit_scanned_bill_schema.sql (idempotency_key, merchant). created_at was
-- never added in any prior migration, yet commit_scanned_bill() has always inserted a
-- created_at value into public.bills. This is the only schema gap between
-- commit_scanned_bill()'s INSERT INTO public.bills column list and the live table — every
-- other column it writes there already exists.
--
-- Scope: this migration touches ONLY public.bills, adding exactly one column. It does not
-- modify commit_scanned_bill(), does not touch 0004 or 0012, does not modify any other
-- table, and does not change or delete any existing row data.

BEGIN;

-- Safe as NOT NULL with no separate backfill step: now() is STABLE, not VOLATILE, so
-- PostgreSQL 11+ applies this default via the metadata-only "missing value" fast path
-- instead of rewriting the table. Existing rows are never scanned or written by this
-- statement — they read back a single non-null timestamp (the moment this ALTER TABLE
-- runs) captured once in the catalog. New rows get DEFAULT now() unless a caller supplies
-- its own value, which commit_scanned_bill() does via an explicit NOW() argument. This is
-- safe regardless of how many rows public.bills currently holds, so no separate backfill
-- pass is required before or after this statement.
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

COMMIT;
