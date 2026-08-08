# Changelog

All notable changes to KitchenMind are documented in this file. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.5.0] - Kitchen Intelligence Dashboard, Smart Planner & RC-1 Hardening

### Added
- **Kitchen Intelligence Dashboard** (`/dashboard`, additive `BottomNav` "Insights" tab):
  Household Snapshot, Pantry Health, Low Stock Predictions, Expiry Risk, Shopping Intelligence,
  Cooking Suggestions, Pantry Insights, Household Trends, AI Observation Timeline, Quick Actions.
  Pure derivation over existing prediction/consumption services — no new scoring logic.
- **Smart Meal Planner & Shopping Intelligence** (`/planner`, reached via a Dashboard card):
  Today's Plan (Accept/Dismiss/Regenerate per meal slot), This Week Preview, category-grouped
  Shopping Suggestions. Every suggestion carries an explicit, non-empty, human-readable reason.
  Household dietary preferences (`non_veg_days`, `excluded_vegetables`) are now real hard filters.
- AI Observation persistence: observations generated since Phase 3H are now actually stored
  (`ai_observations` table, migration `0008`) and surfaced on the Dashboard timeline.
- `ConsumptionProfileService.getAllProfiles`, `InventoryService.getExpiringBatches` — aggregated
  reads added to keep the Dashboard/Planner query count fixed instead of growing per-item.

### Fixed (RC-1 production-readiness audit)
- **Manually-added inventory was invisible to meal-cook stock deduction.** `InventoryService.addOrUpdateItem`
  updated `inventory.quantity_grams` but never created an `inventory_batches` row, so
  `mark_meal_cooked()`'s FIFO deduction (which only walks batches) always reported a false
  shortfall and never actually decremented stock for manually-entered items. Now creates one
  batch per add, mirroring what bill-commit already does per line item.
- **`mark_meal_cooked()` idempotency race** (migration `0009`): the cooked-status check read
  `meal_log` without a row lock, so two concurrent calls for the same meal (double-tap, retry)
  could both pass the check and double-deduct the pantry. Now uses `SELECT ... FOR UPDATE`,
  matching the equivalent hardening already applied to `commit_scanned_bill()`.
- **Dual Supabase client instances.** `Login.jsx`, `AuthCallback.jsx`, `Onboarding.jsx`, and
  `Home.jsx` talked to Supabase through a second, separate client, which was the actual source of
  the "Multiple GoTrueClient instances" warning and a violation of the "pages never call Supabase
  directly" rule. Removed the second client; all four pages now go through the service layer.
  `Onboarding.jsx` additionally was duplicating logic that already existed, unused, in
  `HouseholdService.createHouseholdWithMembersAndPreferences` — wired up instead of keeping both.
- **Missing cache invalidation after bill-commit and after cook-meal.** `ScanBill.jsx` and
  `useCookMeal.js` mutated inventory/predictions/learning data without explicitly invalidating the
  React Query caches the Dashboard and Planner read from — previously masked by the default
  `staleTime: 0` forcing a refetch on the next route change. Now explicit.
- **Inventory reconciliation utility silently passed unverifiable items.** `verifyInventoryReconciliation`
  treated an inventory item with zero matching active batches as automatically reconciled instead
  of flagging it — hiding exactly the drift the check exists to catch.

### Notes
- No database migration was required for the Planner (0008 only; 0009 is an RC-1 hardening fix).
- No live Postgres instance is available in this development environment; all SQL migrations are
  verified by manual review only, not execution — a standing, previously-disclosed limitation.
- Known, intentionally-deferred gaps: no route-based code-splitting yet (single ~646 KB JS bundle);
  no dedicated tests yet for `Home.jsx`/`Login.jsx`/`AuthCallback.jsx`/`Onboarding.jsx`/
  `MealLogService.js`/`HouseholdService.js`; `BillService.js`/`RecommendationService.js` remain
  empty Phase-2 stubs with no importers. See `docs/19_IMPLEMENTATION_STATUS_AND_ROADMAP.md` §3.9
  for the full audit writeup.

## [0.4.2] - v0.4.2-recipe-workspace — Recipe Workspace & Meal Execution UI
- Recipe Library, Recipe Detail, Recipe Editor, Meal History pages.
- Full "Cook Now" workflow: serving scale → live ingredient availability → inventory impact
  preview → `mark_meal_cooked()` → success/shortfall confirmation.
- Added `recipes.image_url`/`description`/`prep_time_mins`/`cook_time_mins`/`difficulty`/
  `is_vegetarian`/`tags` (migration `0007`) plus an 8-recipe seed.
- First DOM test tooling in the repo (vitest + Testing Library + jsdom), 49/49 passing.

## [0.4.1] - v0.4.1-recipe-backend — Recipe Engine & Automated Meal Stock Deduction
- Household-owned custom recipes alongside the global catalogue (migration `0006`).
- Atomic, idempotent, FIFO-aware `mark_meal_cooked()` RPC.
- `RecipeService.js`, `MealLogService.js`, `rotiCalculator.js`.

## [0.4.0] - v0.4.0-intelligence-foundation — Andaaza Intelligence Engine & Production Hardening
- Purchase-pattern ledger, consumption profiles, prediction cache, household learning profile
  (migration `0005`).
- Atomic bill persistence (`commit_scanned_bill()` RPC, migration `0004`).
- Independent pre-tag review fixed a critical auth bypass, an idempotency race, a fabricated
  depletion estimate, and a missing `merchant` column — all resolved before this tag.
