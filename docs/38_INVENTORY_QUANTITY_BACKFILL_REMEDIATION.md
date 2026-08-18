# KitchenMind: Inventory Quantity Display — Root Cause & Backfill Remediation

**Document Version:** 1.0.0
**Domain:** Inventory Display, Semantic Quantity Schema (Migrations 0015/0016/0018)
**Status:** **RESOLVED — backfill applied to the live database**

---

## 1. Symptom

User-reported: after the v0.5.1 semantic-quantity fixes (`quantityFormat.js`, migrations `0015`/`0016`), inventory items were still displaying vague qualitative amounts — e.g. **"Thoda sa"**, **"Ek chammach"** — instead of the actual scanned quantity (grams/ml/pcs).

Confirmed with the user: this was happening specifically for items that were **already in inventory before v0.5.1 shipped**, not for freshly scanned bills.

## 2. Root Cause

`src/hooks/useInventory.js` (`enrichItem`) decides how to render each inventory row's quantity:

```js
const semantic = formatInventoryQuantity(item)   // src/lib/quantityFormat.js
if (semantic) { ... use real numbers ... }
// else falls back to:
gramsToAndaaza(item.quantity_grams, item.category)   // src/lib/andaaza.js — qualitative buckets
```

`formatInventoryQuantity()` requires `item.base_unit` to be non-null. `base_unit` was added in migration **0015** as a **nullable column with no default**, specifically so pre-existing rows would keep reading back unchanged:

> *"All new columns are nullable with no default: existing rows ... must continue to read back exactly as they do today — NULL here means 'no semantic data available', which the application is expected to treat as an explicit fallback trigger."* — `0015_add_semantic_inventory_quantity_columns.sql`

Migration **0016** (`commit_scanned_bill`) correctly populates `base_unit` on every new purchase, and even retroactively stamps it onto an existing row the next time that exact `canonical_name` is purchased again (a `NULL` existing `purchase_unit` always counts as "signature matches"). But **any row never repurchased after v0.5.1 shipped keeps `base_unit = NULL` forever**, so it falls back to `gramsToAndaaza()` indefinitely — this is exactly the "Thoda sa" / "Ek chammach" the user was seeing.

The same gap silently broke a second feature: manual consumption (`InventoryConsumptionService.consumeItem`) also requires `base_unit` (`convertConsumptionToBaseUnits` throws `CONSUMPTION_NO_BASE_UNIT` without it), so "I used X" logging was also non-functional for these pre-existing rows.

No application code was behaving incorrectly — this was a **data migration gap**: new-row logic was fixed, old rows were never backfilled.

## 3. Fix

Added migration `0018_backfill_semantic_base_unit.sql`, a one-time, non-destructive `UPDATE`:

- Derives `inventory.base_unit` from the existing `display_unit` column (`NOT NULL DEFAULT 'g'` since migration `0001`), using the same mapping as `deriveBaseUnit()` in `src/utils/units.js` (`kg`/`g` → `g`, `l`/`ml` → `ml`, `pcs` → `pcs`).
- Propagates the now-known `base_unit` from `inventory` down to `inventory_batches` (batches never carried their own unit column; they've always shared their parent row's scale).
- Only touches rows where `base_unit IS NULL` — never overwrites data set by the normal purchase flow.
- Does **not** fabricate `pack_size` / `purchase_quantity` for historical rows (genuinely unknowable) — those items show a plain `N g` / `N ml` / `N pcs` instead of the packaged `N pcs × P unit` view, consistent with the "never fabricate" rule already used elsewhere in this schema.

```sql
UPDATE public.inventory
SET base_unit = CASE
  WHEN lower(trim(display_unit)) IN ('kg', 'g') THEN 'g'
  WHEN lower(trim(display_unit)) IN ('l', 'ltr', 'ltrs', 'litre', 'liter', 'litres', 'liters') THEN 'ml'
  WHEN lower(trim(display_unit)) = 'ml' THEN 'ml'
  WHEN lower(trim(display_unit)) = 'pcs' THEN 'pcs'
  ELSE 'g'
END
WHERE base_unit IS NULL;

UPDATE public.inventory_batches b
SET base_unit = i.base_unit
FROM public.inventory i
WHERE b.inventory_id = i.id AND b.base_unit IS NULL;
```

## 4. How It Was Applied

`supabase db push` was attempted first but failed twice, both times with:

```
{"code":"LegacyDbConfigLoginRoleStatusError","message":"unexpected login role status 403: ...
Your account does not have the necessary privileges to access this endpoint."}
```

This is consistent with a pre-existing, previously documented finding in `docs/37_PRODUCTION_DEPLOYMENT_REMEDIATION.md`: the Supabase CLI in this environment is linked to project `pgwemjswxdlnshrfoggj` ("poonamkarn's Project"), which is a **different, effectively empty project** (zero migrations ever applied) than `jrfuyjemopkbntvaziab`, the project actually referenced by `.env` / `VITE_SUPABASE_URL` and used by the running application. The CLI session has no admin access to `jrfuyjemopkbntvaziab`, so `db push` cannot reach the real database from here regardless of CLI version (upgraded 2.48.3 → 2.114.0 during this session; unrelated to the 403).

**Resolution:** the user ran the migration SQL directly via the Supabase Dashboard SQL Editor against `jrfuyjemopkbntvaziab`, and confirmed the result looked correct.

## 5. Verification

- SQL executed successfully in the Dashboard SQL Editor against the correct (`.env`-referenced) project.
- User confirmed the result.
- Expected effect on next inventory load: previously-vague rows now render through `formatInventoryQuantity()`'s real-unit path instead of `gramsToAndaaza()`.

## 6. Follow-Ups Not Yet Done

- **CLI/project linkage mismatch** (Section 4) is a pre-existing, separately-tracked issue (`docs/37`) — the Supabase CLI in this environment cannot administer the project the live app actually uses. Any future migration will need the same manual SQL Editor workaround, or a re-`supabase link` to the correct project ref with an account that has access, until that's resolved.
- **Temporary diagnostic logging** left in `BillPersistenceService.js` and `OCRService.js` (marked `// TEMPORARY DIAGNOSTIC — remove once confirmed`) is unrelated cleanup debt noticed during this investigation, not yet removed.
- Migration `0018` was applied manually rather than via `supabase db push`, so the remote project's migration-history table does not have it recorded. It is idempotent (`WHERE base_unit IS NULL`), so a future `db push` re-running it is harmless, but the history is not currently reconciled.
