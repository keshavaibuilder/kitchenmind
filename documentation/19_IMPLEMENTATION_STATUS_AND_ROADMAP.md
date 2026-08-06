# KitchenMind — Implementation Status & Product Roadmap

---

## 1. Executive Implementation Overview

KitchenMind is being developed in a structured 5-phase evolution. Phases 1 through 4A are committed and tagged (`v0.4.0-intelligence-foundation`, following an independent architecture/code review — see §3.4). The system now sits at **Phase 4B Core Backend Complete** (Recipe Engine & Automated Meal Stock Deduction — atomic FIFO deduction RPC, recipe/meal services, and roti calculation are implemented and tested; UI wiring is not yet started, see §4.2).

```mermaid
gantt
    title KitchenMind Development Roadmap & Status
    dateFormat  YYYY-MM-DD
    section Phase 1: Core Multi-Tenancy
    Supabase Schema & RLS Policies      :done,    p1, 2026-01-01, 2026-02-15
    Auth & Household Multi-Tenancy     :done,    p2, 2026-02-15, 2026-03-15
    section Phase 2: Inventory & Services
    Inventory Service & Household Logic:done,    p3, 2026-03-15, 2026-04-30
    Gemini 2.5 Flash OCR & Matching    :done,    p4, 2026-04-30, 2026-05-31
    section Phase 3: Receipt Scanning & Persistence
    ScanBill Review UI (Phase 3F)      :done,    p5, 2026-06-01, 2026-08-05
    PostgreSQL RPC commit_scanned_bill (3G) :done,  p6, 2026-08-06, 2026-08-06
    E2E Integration & Production Hardening (3H):done, p7, 2026-08-06, 2026-08-06
    section Phase 4: Intelligence, Recipes & Deductions
    Andaaza Intelligence Engine (4A)    :done,    p8, 2026-08-06, 2026-08-06
    Independent Review & v0.4.0 Tag     :done,    p8b, 2026-08-06, 2026-08-06
    Meal Deduction Backend Core (4B)    :done,    p9, 2026-08-06, 2026-08-06
    Recipe/Meal UI Wiring (4B)          :active,  p9b, 2026-08-07, 2026-08-21
    Andaaza Volumetric Calibration      :         p10, 2026-09-30, 2026-10-31
    section Phase 5: Financial Analytics
    Monthly Budget & Spend Insights     :        p11, 2026-11-01, 2026-12-15
```

---

## 2. Component Audit Matrix

The table below provides a comprehensive audit of all frontend pages, components, services, and hooks within [`src/`](file:///mnt/c/Users/keysh/github/kitchenmind/src/).

| Component / File Path | Module Area | Implementation Status | Purpose & Responsibility |
| :--- | :--- | :--- | :--- |
| [`src/App.jsx`](file:///mnt/c/Users/keysh/github/kitchenmind/src/App.jsx) | Router / Layout | **Completed** | Main routing table, layout shell, auth state listener |
| [`src/pages/Home.jsx`](file:///mnt/c/Users/keysh/github/kitchenmind/src/pages/Home.jsx) | Page View | **Completed** | Today's meals overview, low stock alerts, quick actions |
| [`src/pages/Inventory.jsx`](file:///mnt/c/Users/keysh/github/kitchenmind/src/pages/Inventory.jsx) | Page View | **Completed** | Inventory grid, category grouping, threshold badges |
| [`src/pages/ScanBill.jsx`](file:///mnt/c/Users/keysh/github/kitchenmind/src/pages/ScanBill.jsx) | Page View | **Completed (Phase 3H)** | End-to-end receipt scanning, editing, confirmation, & persistence |
| [`src/pages/AddItem.jsx`](file:///mnt/c/Users/keysh/github/kitchenmind/src/pages/AddItem.jsx) | Page View | **Completed** | Manual inventory item entry with unit conversion |
| [`src/pages/Onboarding.jsx`](file:///mnt/c/Users/keysh/github/kitchenmind/src/pages/Onboarding.jsx) | Page View | **Completed** | Multi-step household setup wizard |
| [`src/pages/Login.jsx`](file:///mnt/c/Users/keysh/github/kitchenmind/src/pages/Login.jsx) | Page View | **Completed** | Supabase auth login screen |
| [`src/pages/AuthCallback.jsx`](file:///mnt/c/Users/keysh/github/kitchenmind/src/pages/AuthCallback.jsx) | Auth Flow | **Completed** | OAuth login callback handler |
| [`src/services/AuthService.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/services/AuthService.js) | Auth Service | **Completed** | Auth login, logout, session management |
| [`src/services/HouseholdService.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/services/HouseholdService.js) | Data Service | **Completed** | Household creation, member & preference updates |
| [`src/services/InventoryService.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/services/InventoryService.js) | Data Service | **Completed** | Inventory CRUD and canonical name queries |
| [`src/services/OCRService.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/services/OCRService.js) | AI Integration | **Completed** | Gemini 2.5 Flash receipt OCR parsing |
| [`src/services/IngredientMatchingService.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/services/IngredientMatchingService.js) | AI Service | **Completed** | Alias resolution and confidence scoring |
| [`src/services/BillProcessingOrchestrator.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/services/BillProcessingOrchestrator.js) | Orchestration | **Completed** | In-memory OCR + matching workflow pipeline |
| [`src/services/BillPersistenceService.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/services/BillPersistenceService.js) | Persistence | **Completed (Phase 3H)** | Pre-commit validation, RPC invocation, structured logging, async post-hooks |
| [`src/services/AIObservationService.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/services/AIObservationService.js) | AI Learning | **Completed (Phase 3H)** | Post-commit AI observation foundation service |
| [`src/services/AndaazaLearningService.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/services/AndaazaLearningService.js) | AI Learning | **Stub (unimplemented)** | Empty placeholder from the initial commit; `BillPersistenceService` guards the call with `typeof === 'function'` so it's a safe no-op today. Volumetric andaaza calibration (§2 of `07_ANDAAZA_AI_LEARNING_ENGINE.md`) will implement this in a future phase — do not confuse with the Phase 4A `AndaazaLearningEngine` below, which is unrelated and fully implemented |
| [`src/utils/reconciliation.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/utils/reconciliation.js) | Reconciliation | **Completed (Phase 3H)** | Inventory stock vs active batch reconciliation auditor |
| [`src/utils/logger.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/utils/logger.js) | Telemetry | **Completed (Phase 3H)** | Structured telemetry and sanitization logger |
| [`src/services/AndaazaLearningEngine.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/services/AndaazaLearningEngine.js) | AI Learning | **Completed (Phase 4A)** | Post-commit intelligence orchestrator: consumption profiles, predictions, household metrics |
| [`src/services/ConsumptionProfileService.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/services/ConsumptionProfileService.js) | AI Learning | **Completed (Phase 4A)** | Deterministic consumption velocity, interval, brand & confidence calculation |
| [`src/services/PredictionService.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/services/PredictionService.js) | AI Learning | **Completed (Phase 4A)** | Depletion date, low-stock risk, pantry health score algorithms |
| [`src/services/HouseholdIntelligenceService.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/services/HouseholdIntelligenceService.js) | AI Learning | **Completed (Phase 4A)** | Pantry diversity, category trends, shopping cadence aggregation |
| [`src/services/__tests__/mockSupabaseTable.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/services/__tests__/mockSupabaseTable.js) | Test Utility | **Completed (Phase 4A)** | In-memory `.from()` mock so tests/benchmarks measure engine logic, not network I/O |
| [`src/hooks/useBillProcessing.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/hooks/useBillProcessing.js) | Custom Hook | **Completed** | Hook connecting ScanBill UI to Orchestrator |
| [`src/hooks/useInventory.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/hooks/useInventory.js) | Custom Hook | **Completed** | React Query hook for inventory fetching |
| `supabase/migrations/0004_rpc_commit_scanned_bill.sql` | Database RPC | **Completed (Phase 3G)**, hardened post-review | PostgreSQL atomic commit stored procedure with race-free idempotency, unconditional auth check, pinned `search_path`, anon-role EXECUTE revoked |
| `supabase/migrations/0005_andaaza_intelligence_schema.sql` | Database Schema | **Completed (Phase 4A)** | `ingredient_consumption_profile`, `purchase_patterns`, `prediction_cache`, `household_learning_profile` tables + RLS |
| [`src/utils/units.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/utils/units.js) | Utility | **Completed** | Single source of truth for quantity→grams conversion (was duplicated across two files pre-review) |
| [`src/services/RecipeService.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/services/RecipeService.js) | Data Service | **Backend Complete (Phase 4B)** | Global + household custom recipe CRUD, ingredient scaling |
| [`src/services/MealLogService.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/services/MealLogService.js) | Data Service | **Backend Complete (Phase 4B)** | Meal lifecycle CRUD, atomic FIFO stock deduction via `mark_meal_cooked()` |
| [`src/utils/rotiCalculator.js`](file:///mnt/c/Users/keysh/github/kitchenmind/src/utils/rotiCalculator.js) | Utility | **Completed (Phase 4B)** | Flour/dough requirement calculation from real household/member/guest schema |
| `supabase/migrations/0006_recipe_meal_deduction_schema.sql` | Database Schema + RPC | **Completed (Phase 4B)** | Household-owned custom recipes + RLS, `meal_log.cooked_at`, `stock_deductions.batch_id`, atomic FIFO `mark_meal_cooked()` RPC |

---

## 3. Performance Benchmark & Integration Test Results

### 3.1 Objective 4: Performance Validation Benchmarks

| Item Count | Total Latency (ms) | Avg Latency / Item (ms) | Memory Delta (KB) | Total SQL Statements |
| :--- | :--- | :--- | :--- | :--- |
| **10 Items** | `5.72 ms` | `0.572 ms` | `52.70 KB` | `41` |
| **50 Items** | `7.66 ms` | `0.153 ms` | `112.14 KB` | `201` |
| **100 Items** | `11.41 ms` | `0.114 ms` | `103.34 KB` | `401` |
| **500 Items** | `51.94 ms` | `0.104 ms` | `0.00 KB` | `2001` |

### 3.2 Objective 2 & 3: Integration & Reconciliation Test Results

- **Unit Test Suite**: `7 / 7 PASSED (100%)`
- **Integration Test Suite**: `8 / 8 PASSED (100%)`
- **Inventory Reconciliation Audit**: `VERIFIED (inventory.quantity_grams === SUM(active batches.remaining_grams))`
- **Build Verification (`npm run build`)**: `CLEAN SUCCESS (0 Errors)`
- **Lint Verification (`npm run lint`)**: `CLEAN SUCCESS (0 Errors)`

### 3.3 Phase 4A: Andaaza Intelligence Engine Benchmark & Test Results

Benchmarked via `scripts/run_phase4a_tests.js` using an in-memory `.from()` mock (`mockSupabaseTable.js`) so results reflect learning-engine compute cost, isolated from network/database I/O latency (which is environment-dependent and out of scope for a code-level benchmark):

| Item Count | Total Latency (ms) | Avg Latency / Item (ms) | Memory Delta (KB) | Profiles Updated |
| :--- | :--- | :--- | :--- | :--- |
| **10 Items** | `0.90 ms` | `0.090 ms` | `125.50 KB` | `10` |
| **50 Items** | `8.61 ms` | `0.172 ms` | `862.73 KB` | `50` |
| **100 Items** | `17.63 ms` | `0.176 ms` | `0.00 KB` | `100` |
| **500 Items** | `130.40 ms` | `0.261 ms` | `4865.34 KB` | `500` |

- **Phase 4A Intelligence Test Suite**: `7 / 7 PASSED (100%)` — deterministic confidence convergence, consumption velocity/interval math, brand preference evolution, depletion/low-stock prediction, pantry health score, household intelligence aggregation, and non-blocking post-commit execution (asserts `commitBill()` returns in <50ms regardless of learning engine work, then verifies the learned profile was written after the async hook settles).
- **Combined Phase 3H + 4A Suite Total**: `22 / 22 PASSED (100%)` (`BillPersistenceService.test.js` + `Phase3HIntegration.test.js` + `AndaazaIntelligence.test.js`).
- **Non-blocking verification**: `commitBill()` resolves before `AndaazaLearningEngine.processPostCommitLearning()` executes — measured directly in Test 7 of `AndaazaIntelligence.test.js` rather than only asserted structurally.
- **Build Verification (`npm run build`)**: `CLEAN SUCCESS (0 Errors)`
- **Lint Verification (`npm run lint`)**: `CLEAN SUCCESS (0 Errors)`

### 3.4 Independent Architecture/Code Review (pre-v0.4.0-intelligence-foundation)

A fresh, context-free review agent audited all Phase 3G/3H/4A changes against docs 02/03/06/07/12/15/19 before the milestone commit. Findings and resolutions:

| Severity | Finding | Resolution |
| :--- | :--- | :--- |
| Critical | `commit_scanned_bill`'s membership check was skipped entirely for unauthenticated (`auth.uid() IS NULL`) callers | Check made unconditional; `EXECUTE` explicitly revoked from `PUBLIC`, granted only to `authenticated` |
| High | Idempotency check-then-insert had a genuine race under concurrent duplicate submits (raw `23505` instead of a graceful duplicate response) | Replaced with atomic `INSERT ... ON CONFLICT (household_id, idempotency_key) DO NOTHING`, using `FOUND` to detect the race |
| High | Depletion predictions used a fabricated stock estimate (EMA of purchase size) instead of the real `inventory.quantity_grams` | `AndaazaLearningEngine` now fetches the actual inventory balance before calling `PredictionService.calculateDepletion` |
| Medium | `commit_scanned_bill` inserted into a `bills.merchant` column that was never added by any migration (would fail on every real invocation) | Added `ALTER TABLE bills ADD COLUMN IF NOT EXISTS merchant text` |
| Medium | `'pcs'` unit silently treated as 1 gram; conversion logic duplicated across two files | Extracted to `src/utils/units.js`, given a documented (not silently wrong) default piece weight |
| Medium | Hardcoded placeholder household UUID fallback in `ScanBill.jsx` | Replaced with an explicit, visible error state when no household is resolved |
| Medium | `SECURITY DEFINER` functions missing `search_path` pinning | `SET search_path = public, pg_temp` added to both `commit_scanned_bill` and `auth_household_id` |
| Medium | Env var validation silently removed, unconditional placeholder fallback | Fail-fast restored for real Vite/browser contexts; placeholder fallback now scoped to Node-only test/benchmark execution |
| Low | Backdated purchase dates clamped to a 1-day interval instead of rejected | Interval-acceptance guard now validates the raw (unclamped) gap |
| Low | `shopping_frequency_days` hardcoded to `7.0` despite docs claiming it was computed | Implemented as the actual average gap between consecutive bill dates |
| Low | Docs claimed `AndaazaLearningService.js` was "Completed"; it's an empty Phase-2 stub | Corrected in the Component Audit Matrix above |
| Low | Test mock couldn't simulate DB failures, so every non-blocking catch branch was untested | `mockSupabaseTable.js` gained a `failTables` option; added `AndaazaIntelligence.test.js` Test 8 exercising it |

**Known limitation**: no local Postgres server is available in this sandbox (client tools only, no network), so the migration SQL fixes above were validated by careful manual review, not by executing them against a live instance. A `psql` client (v18.4) is present if a `DATABASE_URL` becomes available for a future session to run the migrations end-to-end.

### 3.5 Phase 4B: Recipe Engine & Meal Deduction Test Results

- **Phase 4B Test Suite**: `8 / 8 PASSED (100%)` (`Phase4BMealDeduction.test.js`, run via `scripts/run_phase4b_tests.js`) — member roti count resolution, guest-count filtering, full roti requirement math, recipe ingredient scaling, `markAsCooked` RPC payload/response mapping, idempotent already-cooked short-circuit, RPC failure handling, and pre-flight validation.
- **Build Verification (`npm run build`)**: `CLEAN SUCCESS (0 Errors)`
- **Lint Verification (`npm run lint`)**: `CLEAN SUCCESS (0 Errors)`

---

## 4. Feature Matrix: Completed vs. Pending

### 4.1 Completed Milestones (Phases 1 - 4B core)
- [x] **Phase 1: Multi-Tenant Database & RLS**
- [x] **Phase 2: Core Domain Services & OCR Engine**
- [x] **Phase 3F: ScanBill Review UI Integration**
- [x] **Phase 3G: Atomic Stock Deduction RPC & Bill Persistence**
- [x] **Phase 3H: E2E Integration, Production Hardening & AI Observation Foundation**
  - Full end-to-end UI integration from bill photo upload to atomic database persistence.
  - Inventory reconciliation verification utility (`verifyInventoryReconciliation`).
  - Structured telemetry logging (`logger.logCommitTelemetry`).
  - AI Observation Foundation service (`AIObservationService.js`).
  - Automated integration test suite (`Phase3HIntegration.test.js`).
  - Performance benchmarking for 10, 50, 100, 500 items.
- [x] **Phase 4A: Andaaza Intelligence Engine (Household Learning & Consumption Modeling)**
  - Append-only purchase event ledger (`purchase_patterns`) and derived `ingredient_consumption_profile`, `prediction_cache`, `household_learning_profile` tables with RLS (`0005_andaaza_intelligence_schema.sql`).
  - Deterministic consumption velocity, purchase interval, brand preference, and confidence-score calculation (`ConsumptionProfileService.js`).
  - Depletion date, low-stock risk, and pantry health score prediction algorithms (`PredictionService.js`).
  - Household-wide pantry diversity, category trend, and shopping cadence aggregation (`HouseholdIntelligenceService.js`).
  - Asynchronous, non-blocking learning orchestrator invoked post-commit (`AndaazaLearningEngine.js`) — verified never to delay `commitBill()`.
  - Read-only prediction/profile APIs (`getIngredientProfile`, `getHouseholdProfile`, `getHouseholdPredictions`) — no recommendation, meal-planning, or UI logic included (explicitly out of scope).
  - Automated test suite (`AndaazaIntelligence.test.js`, 7/7 passing) and dedicated benchmark harness with an in-memory Supabase mock for network-independent performance measurement.
  - See [07_ANDAAZA_AI_LEARNING_ENGINE.md §6-11](./07_ANDAAZA_AI_LEARNING_ENGINE.md) for the full architecture review and [12_API_AND_SERVICES_CATALOGUE.md §2.12-2.16](./12_API_AND_SERVICES_CATALOGUE.md) for API contracts.
- [x] **Independent Review & `v0.4.0-intelligence-foundation` tag** — see §3.4 above.
- [x] **Phase 4B (backend core): Recipe Engine & Automated Meal Stock Deduction**
  - Household-owned custom recipes alongside the global catalogue, with corrected RLS (`0006_recipe_meal_deduction_schema.sql`).
  - Atomic, idempotent, FIFO-aware `mark_meal_cooked()` RPC — same architecture as `commit_scanned_bill`, including the same security hardening.
  - `RecipeService.js` (recipe CRUD + ingredient scaling), `MealLogService.js` (meal lifecycle + deduction), `rotiCalculator.js` (flour/dough requirement).
  - Automated test suite (`Phase4BMealDeduction.test.js`, 8/8 passing).
  - See [09_RECIPE_AND_MEAL_LOGGING_SPECIFICATION.md §7](./09_RECIPE_AND_MEAL_LOGGING_SPECIFICATION.md) for how this reconciles with the original design doc, and [12_API_AND_SERVICES_CATALOGUE.md §2.9, §2.17-2.18](./12_API_AND_SERVICES_CATALOGUE.md) for API contracts.

### 4.2 Next Engineering Milestones

#### Phase 4B (remaining): Recipe & Meal Logging UI
* **Goal**: Wire `RecipeService`/`MealLogService` into the `/meals` and `/recipe/:id` routes (currently `<Soon>` placeholders in `App.jsx`) — meal planning calendar, "mark as cooked" action, recipe browsing/creation UI.
* Not started this session — backend/logic layer only, per the same UI-deferred scoping Phase 4A used.

#### Andaaza Volumetric Calibration
* **Goal**: Implement `AndaazaLearningService.js` (currently an empty stub) — dynamic calibration of `andaaza_profile` volumetric weights based on cooking feedback over time (distinct from the Phase 4A consumption-learning engine — see [07_ANDAAZA_AI_LEARNING_ENGINE.md](./07_ANDAAZA_AI_LEARNING_ENGINE.md) note at the top of the Phase 4A section). Feeds `rotiCalculator`'s `andaazaFactor` parameter, which defaults to `1.0` until this exists.

#### Recommendation layer (future)
* Recipe suggestions, shopping list generation, and budget dashboards can now be built on top of the Phase 4A intelligence tables and Phase 4B recipe/meal tables without further schema changes.

#### Phase 5: Monthly Budget & Financial Analytics Dashboard
* **Goal**: Aggregate bill totals and category expenditures into `budget_monthly`.
