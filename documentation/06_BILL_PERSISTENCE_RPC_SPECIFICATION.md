# KitchenMind — Bill Persistence RPC Specification (`commit_scanned_bill`)

---

## 1. Specification Overview

This document specifies the authoritative contract for the PostgreSQL stored function `commit_scanned_bill()`. It coordinates the atomic commitment of a user-reviewed grocery bill, updates household inventory stock, records purchase batches, logs audit transactions, and enforces idempotency.

---

## 2. Function Signature & Metadata

```sql
-- Function Signature Specification
FUNCTION public.commit_scanned_bill(
    p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
```

- **Security Context**: `SECURITY DEFINER` (Enforces explicit RLS membership check against `auth.uid()`). The membership check is unconditional — it is **not** skipped when `auth.uid()` is `NULL` (unauthenticated/anon caller), since a `NULL` comparison via `=` never matches. `search_path` is pinned (`SET search_path = public, pg_temp`) to prevent search-path hijacking of unqualified calls inside the function body. `EXECUTE` is explicitly revoked from `PUBLIC` and granted only to the `authenticated` role, so the `anon` key alone cannot invoke this function even before the membership check runs.
- **Volatility**: `VOLATILE` (Mutates database state).
- **Idempotency**: implemented as an atomic `INSERT ... ON CONFLICT (household_id, idempotency_key) DO NOTHING`, not a check-then-insert — this is race-free under concurrent duplicate submissions (double-tap, client retry racing the original request); PL/pgSQL's `FOUND` reliably reports whether the conflict branch was taken.

---

## 3. Input JSON Payload Contract

```json
{
  "household_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "idempotency_key": "tx_20260806_bill_001",
  "merchant": "Reliance Fresh",
  "bill_date": "2026-08-06",
  "total_amount": 345.50,
  "source": "scan",
  "items": [
    {
      "item_name": "TATA SALT 1KG",
      "canonical_name": "Salt",
      "category": "Staples",
      "quantity_value": 1,
      "unit": "kg",
      "unit_grams": 1000,
      "cost": 28.00
    },
    {
      "item_name": "FORTUNE SUNFLOWER OIL 1L",
      "canonical_name": "Cooking Oil",
      "category": "Staples",
      "quantity_value": 1,
      "unit": "L",
      "unit_grams": 1000,
      "cost": 165.00
    }
  ]
}
```

---

## 4. Execution Sequence & Atomic Rules

```
                      Client Calls supabase.rpc('commit_scanned_bill')
                                     │
                                     ▼
                      1. Check RLS & Membership (auth.uid())
                                     │
                                     ▼
                      2. Check Idempotency Key (bills table)
                                     │
                    ┌────────────────┴────────────────┐
                 Found (Duplicate)               Not Found (Fresh)
                    │                                 │
                    ▼                                 ▼
             Return HTTP 200                  3. Create Bill Record (bills)
          (is_duplicate: true)                        │
                                                      ▼
                                              4. Sort Items by canonical_name
                                                      │
                                                      ▼
                                              5. Loop Items:
                                                 - Create bill_items
                                                 - Atomic UPSERT inventory
                                                 - Create inventory_batches
                                                 - Create inventory_transactions
                                                      │
                                                      ▼
                                              6. Return CommitSummary
                                                 (is_duplicate: false)
```

---

## 5. Key Transaction Rules

1. **Idempotency De-duplication**: If `bills` already contains a row with `(household_id, idempotency_key)`, short-circuit and return `is_duplicate: true` without mutating inventory.
2. **Deadlock Prevention Lock Order**: In-memory sort of incoming items by `canonical_name` prior to UPSERT guarantees deterministic row locking, eliminating PostgreSQL deadlocks under high concurrency.
3. **Atomic Inventory Upsert**: Uses `INSERT INTO inventory ... ON CONFLICT (household_id, canonical_name) DO UPDATE SET quantity_grams = inventory.quantity_grams + EXCLUDED.quantity_grams` to guarantee atomic additions.
4. **Decoupled AI Logging**: `andaaza_profile` observations are excluded from the ACID transaction and executed asynchronously after the RPC returns.
5. **Full Rollback Guarantee**: Any validation error or database failure aborts the entire transaction, leaving zero orphaned rows.
