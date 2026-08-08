# KitchenMind: API & Services Catalogue

**Document Version:** 1.0.0  
**Status:** Approved Specification  
**Domain:** Core Frontend & API Integration Layer  

---

## 1. Executive Summary & Service Architecture Map

The **KitchenMind Services Layer** is a collection of modular JavaScript service classes and singletons that encapsulate all database communications, OCR image pipelines, intelligent ingredient matching, portion learning algorithms, and Supabase BaaS integrations.

```mermaid
graph TD
    UI[React Components & Custom Hooks] --> Orchestrator[BillProcessingOrchestrator]
    UI --> AuthService[AuthService]
    UI --> HouseholdService[HouseholdService]
    UI --> InventoryService[InventoryService]
    UI --> RecipeService[RecipeService]
    UI --> MealLogService[MealLogService]
    UI --> RecommendationService[RecommendationService]
    UI --> AndaazaService[AndaazaLearningService]

    MealLogService -->|scaleRecipeIngredients| RecipeService
    MealLogService -->|"mark_meal_cooked() RPC"| Supabase[supabaseClient]

    Orchestrator --> OCRService[OCRService]
    Orchestrator --> MatchingService[IngredientMatchingService]
    Orchestrator --> BillService[BillService]
    Orchestrator --> InventoryService

    UI --> BillPersistence[BillPersistenceService]
    BillPersistence -->|ACID commit| Supabase[supabaseClient]
    BillPersistence -.->|fire-and-forget post-commit| AIObs[AIObservationService]
    BillPersistence -.->|fire-and-forget post-commit| LearningEngine[AndaazaLearningEngine]
    LearningEngine --> ConsumptionSvc[ConsumptionProfileService]
    LearningEngine --> PredictionSvc[PredictionService]
    LearningEngine --> HouseholdIntelSvc[HouseholdIntelligenceService]

    AuthService --> Supabase
    HouseholdService --> Supabase
    InventoryService --> Supabase
    BillService --> Supabase
    RecipeService --> Supabase
    RecommendationService --> Supabase
    AndaazaService --> Supabase
    AIObs --> Supabase
    ConsumptionSvc --> Supabase
    PredictionSvc --> Supabase
    HouseholdIntelSvc --> Supabase

    UI --> Dashboard["useDashboard (Phase 5A)"]
    Dashboard -->|"reuses, no new logic"| PredictionSvc
    Dashboard -->|"reuses, no new logic"| HouseholdIntelSvc
    Dashboard -->|"reuses, no new logic"| ConsumptionSvc
    Dashboard --> InventoryService
    Dashboard --> AIObs
    Dashboard -->|"scaleRecipeIngredients"| RecipeService

    UI --> Planner["usePlanner (Phase 5B)"]
    Planner --> PlanningEngine["PlanningEngine (pure, no I/O)"]
    PlanningEngine -->|"reuses"| DashboardInsights["dashboardInsights.js (Phase 5A)"]
    Planner -->|"getMealLogs / createMealLog"| MealLogService
    Planner -->|"getPreferences"| HouseholdService
    Planner --> PredictionSvc
    Planner --> ConsumptionSvc
    Planner --> InventoryService
```

---

## 2. Services Catalogue Specification

---

### 2.1 `AuthService`

Provides authentication methods powered by Supabase Auth (OAuth, Magic Link, Email/Password).

#### `signUp({ email, password, fullName })`
- **Parameters**: `email` (string), `password` (string), `fullName` (string).
- **Returns**: `Promise<{ user: Object|null, session: Object|null, error: Error|null }>`
- **Error Behavior**: Throws or returns error object if email exists or password fails strength validation.

#### `signIn({ email, password })`
- **Parameters**: `email` (string), `password` (string).
- **Returns**: `Promise<{ user: Object, session: Object }>`
- **Error Behavior**: Returns `Invalid login credentials` error on failure.

#### `signOut()`
- **Parameters**: None.
- **Returns**: `Promise<{ error: Error|null }>`
- **Error Behavior**: Clears local session storage and Zustand auth state.

#### `getSession()`
- **Parameters**: None.
- **Returns**: `Promise<Session|null>`

#### `onAuthStateChange(callback)`
- **Parameters**: `callback` (`(event: string, session: Session|null) => void`).
- **Returns**: `{ data: { subscription: Unsubscribe } }`

#### `resetPassword(email)`
- **Parameters**: `email` (string).
- **Returns**: `Promise<{ error: Error|null }>`

---

### 2.2 `HouseholdService`

Manages household onboarding, member profiling, role assignments, and dietary preferences.

#### `getHousehold(householdId)`
- **Parameters**: `householdId` (string UUID).
- **Returns**: `Promise<HouseholdObject>`

#### `createHousehold({ name, currency, nonVegProhibitedDays })`
- **Parameters**: Object with household metadata.
- **Returns**: `Promise<HouseholdObject>`

#### `updateHousehold(householdId, updates)`
- **Parameters**: `householdId` (string UUID), `updates` (Partial<HouseholdObject>).
- **Returns**: `Promise<HouseholdObject>`

#### `addMember(householdId, memberData)`
- **Parameters**: `householdId` (string UUID), `memberData` (`{ name, role, ageCategory, baseRotiAppetite, dietaryPreference }`).
- **Returns**: `Promise<HouseholdMember>`

#### `removeMember(memberId)`
- **Parameters**: `memberId` (string UUID).
- **Returns**: `Promise<{ success: boolean }>`

#### `updatePreferences(householdId, preferences)`
- **Parameters**: `householdId` (string UUID), `preferences` (Object).
- **Returns**: `Promise<HouseholdObject>`

#### `getMembers(householdId)` (Phase 4C)
- **Returns**: `Promise<Array<Member>>` — all household members (`role`, `roti_preference`, etc.). Added so `useCookMeal` (Recipe Workspace) can feed `rotiCalculator` without a hook touching `supabaseClient` directly.

---

### 2.3 `InventoryService`

Handles real-time inventory queries and manual additions. **Corrected to match the actual implementation** (the previous version of this section described `getInventoryItems`/`addInventoryItem`/`recordTransaction`/`deductForMeal`, none of which exist — FIFO batch deduction actually lives in the `mark_meal_cooked()` RPC via `MealLogService`, §2.17, and purchase-side batch creation lives in `commit_scanned_bill()`, §2.8).

#### `getInventory(householdId)`
- **Returns**: `Promise<Array<InventoryItem>>` — all inventory rows for a household.

#### `getItemByCanonicalName(householdId, canonicalName)`
- **Returns**: `Promise<{ id, quantity_grams, canonical_name }|null>`

#### `addOrUpdateItem(householdId, { label, canonical, category, gramsToStore, displayUnit, threshold })`
- Upserts by canonical name (manual entry path, e.g. `AddItem.jsx`) — adds to `quantity_grams` if the item exists, inserts otherwise. Does **not** create an `inventory_batches` row (only `commit_scanned_bill()` does), so manually-added stock has no FIFO/expiry batch trail.
- **Returns**: `Promise<InventoryItem>`

#### `updateItem(itemId, updates)` / `deleteItem(itemId)`
- Direct row update/delete by `inventory.id`.

#### `getExpiringBatches(householdId, { withinDays = 7 })` (Phase 5A)
- **Returns**: `Promise<Array<{ id, remaining_grams, expiry_date, purchase_date, status, inventory: { canonical_name, category } }>>` — active batches with a non-null `expiry_date` within the window, one joined query (not one per item), soonest-expiring first.
- **Known limitation**: no code path sets `inventory_batches.expiry_date` yet (see [07_ANDAAZA_AI_LEARNING_ENGINE.md §13](./07_ANDAAZA_AI_LEARNING_ENGINE.md)), so this legitimately returns `[]` today — the query is correct and will surface real data once OCR expiry extraction or a manual-entry UI exists.

---

### 2.4 `BillService`

Provides persistence and query APIs for receipts and line-item financial records.

#### `createBill(billPayload)`
- **Parameters**: `billPayload` (`{ householdId, storeName, billDate, totalAmount, taxAmount, imageUrl }`).
- **Returns**: `Promise<BillRecord>`

#### `getBills(householdId, pagination)`
- **Parameters**: `householdId` (string UUID), `pagination` (`{ page: number, limit: number }`).
- **Returns**: `Promise<{ bills: Array<BillRecord>, totalCount: number }>`

#### `getBillById(billId)`
- **Parameters**: `billId` (string UUID).
- **Returns**: `Promise<BillRecordWithItems>`

#### `deleteBill(billId)`
- **Parameters**: `billId` (string UUID).
- **Returns**: `Promise<{ success: boolean }>`

---

### 2.5 `OCRService`

Interfaces with Tesseract.js / Cloud OCR APIs to process raw receipt images into structured text line items.

```mermaid
sequenceDiagram
    autonumber
    participant UI as ScanBill Page
    participant OCR as OCRService
    participant Engine as Tesseract / Cloud Vision API
    
    UI->>OCR: processBillImage(imageFileBlob)
    OCR->>Engine: Run Preprocessing & Text Extraction
    Engine-->>OCR: Raw Text Block Output
    OCR->>OCR: parseReceiptMetadata(rawText)
    OCR->>OCR: extractLineItems(rawText)
    OCR-->>UI: Return Structured OCR Result { storeName, billDate, lineItems: [...] }
```

#### `processBillImage(fileBlob, onProgress)`
- **Parameters**: `fileBlob` (File/Blob), `onProgress` (`(progress: number) => void`).
- **Returns**: `Promise<{ rawText: string, confidence: number }>`

#### `extractLineItems(rawText)`
- **Parameters**: `rawText` (string).
- **Returns**: `Array<{ rawName: string, quantity: number, unit: string, price: number }>`

#### `parseReceiptMetadata(rawText)`
- **Parameters**: `rawText` (string).
- **Returns**: `{ storeName: string|null, billDate: string|null, totalAmount: number|null }`

---

### 2.6 `IngredientMatchingService`

Employs fuzzy string matching (Levenshtein Distance & Token Jaccard Similarity) to map raw OCR receipt text to canonical master ingredient IDs.

#### `matchOcrToMasterIngredients(rawItemName, masterCatalogue)`
- **Parameters**: `rawItemName` (string), `masterCatalogue` (Array).
- **Returns**: `{ matchedItem: MasterIngredient|null, confidenceScore: number, matchType: 'EXACT'|'FUZZY'|'ALIAS' }`

#### `calculateMatchConfidence(strA, strB)`
- **Parameters**: `strA` (string), `strB` (string).
- **Returns**: `number` (Value between 0.0 and 1.0)

#### `suggestMappings(rawItemName, masterCatalogue, topN = 3)`
- **Parameters**: `rawItemName` (string), `masterCatalogue` (Array), `topN` (number).
- **Returns**: `Array<{ matchedItem: MasterIngredient, confidenceScore: number }>`

---

### 2.7 `BillProcessingOrchestrator`

Coordinates the end-to-end flow from image upload to verified inventory addition.

#### `orchestrateScanToInventory(fileBlob, householdId, onProgress)`
- **Parameters**: `fileBlob` (File/Blob), `householdId` (string UUID), `onProgress` (`(step: string, pct: number) => void`).
- **Returns**: `Promise<{ billId: string, processedItemsCount: number, matchedItems: Array }>`

#### `validateProcessedItems(itemsList)`
- **Parameters**: `itemsList` (Array).
- **Returns**: `{ isValid: boolean, validationErrors: Array }`

---

### 2.8 `BillPersistenceService`

Validates and commits a reviewed bill atomically via the `commit_scanned_bill()` PostgreSQL RPC, then fires the Phase 4A learning hooks without blocking the caller.

#### `commitBill(householdId, reviewedBillData)`
- **Parameters**: `householdId` (string UUID), `reviewedBillData` (`{ idempotencyKey?, merchant?, billDate?, totalAmount?, source?, items: Array }`).
- **Returns**: `Promise<{ success, commitId, billId, householdId, idempotencyKey, isDuplicate, metrics, committedAt }>` — resolves as soon as the ACID commit completes; does **not** wait on `AIObservationService` or `AndaazaLearningEngine`.
- **Error Behavior**: Throws `AppError` with code `PERSISTENCE_VALIDATION_ERROR` for pre-commit validation failures (missing household, zero active items, invalid quantities) or `BILL_COMMIT_FAILED` if the RPC itself errors.

---

### 2.9 `RecipeService` (Phase 4B, extended Phase 4C)

Global master recipe catalogue (`household_id IS NULL`) plus household-owned custom recipes. `recipes.ingredients` is a jsonb array of `{ canonical_name, base_quantity_grams, is_optional? }` scaled for `base_servings` — see [09_RECIPE_AND_MEAL_LOGGING_SPECIFICATION.md §7](./09_RECIPE_AND_MEAL_LOGGING_SPECIFICATION.md) for why this differs from the originally-designed `recipe_ingredients` join table. Phase 4C added `image_url`, `description`, `prep_time_mins`, `cook_time_mins`, `difficulty`, `is_vegetarian`, `tags` (migration `0007`, see §7.1 there) and the pagination/search/CRUD surface the Recipe Workspace needed.

#### `getRecipes(householdId, filters)`
- **Parameters**: `householdId` (string UUID), `filters` (`{ mealType?, cuisine?, isVegetarian?: boolean, search?: string, limit?: number, offset?: number }`).
- **Returns**: `Promise<{ recipes: Array<Recipe>, hasMore: boolean }>` — global recipes plus this household's own custom recipes, one page at a time (default `limit` 20). **Changed in Phase 4C**: previously returned a bare array; now paginated for the Library's infinite scroll.

#### `getRecipesByIds(ids)`
- **Parameters**: `ids` (`Array<string>`).
- **Returns**: `Promise<Array<Recipe>>` — resolves in the same order as `ids` (e.g. most-recently-cooked-first). Used by the Favorites and Recently Cooked shelves, which only have IDs to start from.

#### `getRecipeById(recipeId)`
- **Parameters**: `recipeId` (string UUID).
- **Returns**: `Promise<Recipe|null>`

#### `createCustomRecipe(householdId, recipePayload)`
- **Parameters**: `householdId` (string UUID), `recipePayload` (`{ name, meal_type, cuisine?, base_servings, ingredients, instructions?, image_url?, description?, prep_time_mins?, cook_time_mins?, difficulty?, is_vegetarian?, tags? }`).
- **Returns**: `Promise<Recipe>`

#### `updateRecipe(householdId, recipeId, updates)` / `deleteRecipe(householdId, recipeId)` / `duplicateRecipe(householdId, sourceRecipe)`
- Household-scoped CRUD for custom recipes (RLS already prevents editing global or another household's recipes; `householdId` is passed as defense-in-depth too). `duplicateRecipe` works on any *visible* recipe — global or another household's within what `getRecipes`/RLS already exposes — and creates an editable copy owned by the calling household.

#### `scaleRecipeIngredients(recipe, targetServings)`
- **Parameters**: `recipe` (Recipe row), `targetServings` (number).
- **Returns**: `Array<{ canonical_name, quantity_grams, is_optional }>` — pure function, no I/O.

> `searchRecipesByInventory` (inventory-driven recipe matching) is **not implemented** — it's a recommendation-adjacent feature and out of scope for the Phase 4B/4C deduction and browsing pipeline, same as Phase 4A excluded recommendation logic.

---

### 2.10 `RecommendationService`

Intelligent recommendation engine producing daily meal plans and Tiffin box pairings.

#### `getMealRecommendations(householdId, targetDate, mealType)`
- **Parameters**: `householdId` (string UUID), `targetDate` (Date), `mealType` ('BREAKFAST'|'LUNCH'|'DINNER').
- **Returns**: `Promise<Array<{ recipe: Recipe, suitabilityScore: number, reason: string }>>`

#### `getTiffinRecommendations(householdId, memberId, targetDate)`
- **Parameters**: `householdId` (string UUID), `memberId` (string UUID), `targetDate` (Date).
- **Returns**: `Promise<{ container1: Recipe, container2: Recipe, leakRiskWarning: boolean }>`

---

### 2.11 `AndaazaLearningService`

Adaptive machine learning engine that calculates household-specific portion modifiers based on cooking feedback.

#### `recordHouseholdCookingRatio(householdId, recipeId, plannedServings, actualUsedGrams)`
- **Parameters**: `householdId`, `recipeId`, `plannedServings`, `actualUsedGrams`.
- **Returns**: `Promise<{ updatedModifier: number }>`

#### `predictPortionMultiplier(householdId, recipeId)`
- **Parameters**: `householdId` (string UUID), `recipeId` (string UUID).
- **Returns**: `Promise<number>` (Modifier multiplier e.g. `1.15`)

---

### 2.12 `AIObservationService` (Phase 3H / 4A)

Foundation service for generating discrete, fact-based AI observations from a committed bill — separate from the quantitative learning pipeline in §2.13–2.16. Runs asynchronously post-commit and never affects the committed transaction.

#### `generateObservations(householdId, activeItems, existingInventory)`
- **Parameters**: `householdId` (string UUID), `activeItems` (Array of reviewed line items), `existingInventory` (Array of current inventory rows, used for delta comparison).
- **Returns**: `Array<{ household_id, observation_type, canonical_name, details, created_at }>` — pure function, no I/O.
- **Observation Types**: `NEW_INGREDIENT_DISCOVERED`, `FIRST_PURCHASE`, `UNUSUAL_PURCHASE_QUANTITY` (≥3000g), `DUPLICATE_PURCHASE` (same ingredient twice in one receipt), `PANTRY_DIVERSITY` (milestone at 5/10/25/50/100 unique ingredients).

#### `recordPostCommitObservations(householdId, activeItems)`
- **Parameters**: `householdId` (string UUID), `activeItems` (Array).
- **Returns**: `Promise<{ success: boolean, observationsCount: number, observations?: Array, error?: string }>` — fetches current inventory, delegates to `generateObservations`, persists the results to `ai_observations` (Phase 5A — see [07_ANDAAZA_AI_LEARNING_ENGINE.md §12](./07_ANDAAZA_AI_LEARNING_ENGINE.md)), and never throws (errors are caught and logged).

#### `getRecentObservations(householdId, limit = 20)` (Phase 5A)
- **Returns**: `Promise<Array<AiObservation>>` — one aggregated query against `ai_observations`, most recent first. Feeds the Kitchen Intelligence Dashboard's Observation Timeline.

---

### 2.13 `AndaazaLearningEngine` (Phase 4A)

The Phase 4A intelligence orchestrator. Single entry point invoked by `BillPersistenceService` after every successful commit; coordinates `ConsumptionProfileService`, `PredictionService`, and `HouseholdIntelligenceService` and persists their outputs. See [07_ANDAAZA_AI_LEARNING_ENGINE.md §6](./07_ANDAAZA_AI_LEARNING_ENGINE.md#6-learning-model) for the full learning model.

#### `processPostCommitLearning(householdId, activeItems, billMeta)`
- **Parameters**: `householdId` (string UUID), `activeItems` (Array of confirmed line items), `billMeta` (`{ billId?, billDate?, merchant? }`).
- **Returns**: `Promise<{ success: boolean, profilesUpdated: number, predictionsCount: number, executionTimeMs: number, householdProfileSummary, error?: string }>`.
- **Error Behavior**: Never throws — every per-item DB write and the household-profile recalculation are individually try/caught so one failing write cannot prevent the rest of the bill's items from being learned from.
- **Side Effects**: writes to `purchase_patterns` (insert), `ingredient_consumption_profile` (upsert), `prediction_cache` (upsert), and `household_learning_profile` (upsert).

---

### 2.14 `ConsumptionProfileService` (Phase 4A)

Calculates ingredient-level consumption statistics. Core calculation is a pure function for testability; fetch method is the read-side API.

#### `calculateProfileUpdate(currentProfile, newPurchaseEvent, history)`
- **Parameters**: `currentProfile` (existing profile row or `null`), `newPurchaseEvent` (`{ quantityGrams, purchaseDate, brand?, unit? }`), `history` (Array, used for brand-frequency evolution).
- **Returns**: `{ avg_interval_days, avg_purchase_grams, consumption_velocity_g_per_day, preferred_brand, preferred_unit, confidence_score, sample_count, last_purchased_at, updated_at }` — pure, deterministic, no I/O.

#### `getIngredientProfile(householdId, canonicalName)`
- **Parameters**: `householdId` (string UUID), `canonicalName` (string).
- **Returns**: `Promise<IngredientConsumptionProfile|null>` — read-only API; returns `null` (with a logged warning) on fetch failure rather than throwing.

#### `getAllProfiles(householdId)` (Phase 5A)
- **Returns**: `Promise<Array<IngredientConsumptionProfile>>` — every profile for a household in one query, used by the dashboard (Shopping Intelligence, Pantry Insights) instead of calling `getIngredientProfile` per ingredient.

---

### 2.15 `PredictionService` (Phase 4A)

Deterministic depletion and stock-health calculations consuming `ConsumptionProfileService` outputs.

#### `calculateDepletion(currentStockGrams, velocityGramsPerDay, fromDate = now)`
- **Returns**: `{ predictedDepletionDate: 'YYYY-MM-DD', daysUntilDepletion: number, isLowStockRisk: boolean }` — pure function.

#### `calculatePantryHealthScore(ingredientDepletions)`
- **Parameters**: `ingredientDepletions` (Array of `{ daysUntilDepletion }`).
- **Returns**: `number` (0–100) — pure function; returns `100` for an empty pantry (no ingredients tracked yet ≠ unhealthy pantry).

#### `getHouseholdPredictions(householdId)`
- **Parameters**: `householdId` (string UUID).
- **Returns**: `Promise<Array<PredictionCacheRow>>` — read-only API, sorted by `days_until_depletion` ascending (most urgent first).

---

### 2.16 `HouseholdIntelligenceService` (Phase 4A)

Household-wide (not per-ingredient) intelligence summary, recalculated once per commit.

#### `calculateHouseholdMetrics(householdId, inventoryItems, billHistory)`
- **Returns**: `{ household_id, pantry_diversity_score, shopping_frequency_days, top_categories, preferred_shopping_day, total_bills_analyzed, last_analyzed_at }` — pure function.

#### `getHouseholdProfile(householdId)`
- **Parameters**: `householdId` (string UUID).
- **Returns**: `Promise<HouseholdLearningProfile|null>` — read-only API.

---

### 2.17 `MealLogService` (Phase 4B)

Meal lifecycle (`planned` -> `cooked` | `skipped`) and the atomic, FIFO-aware stock deduction that runs when a meal transitions to `cooked`, via the `mark_meal_cooked()` RPC (migration `0006`).

#### `getMealLogs(householdId, dateRange)`
- **Parameters**: `householdId` (string UUID), `dateRange` (`{ from?: string, to?: string }`).
- **Returns**: `Promise<Array<MealLog>>`

#### `createMealLog(householdId, payload)`
- **Parameters**: `householdId` (string UUID), `payload` (`{ date, meal_type, recipe_id?, headcount?, notes? }`).
- **Returns**: `Promise<MealLog>` — created in `'planned'` status.

#### `markAsSkipped(householdId, mealLogId)`
- **Returns**: `Promise<{ success: boolean }>` — no inventory side effects.

#### `markAsCooked(householdId, mealLogId, requiredIngredients)`
- **Parameters**: `householdId` (string UUID), `mealLogId` (string UUID), `requiredIngredients` (`Array<{ canonical_name, quantity_grams }>`, typically `RecipeService.scaleRecipeIngredients(...)` output plus roti flour).
- **Returns**: `Promise<{ success, mealLogId, alreadyCooked, cookedAt, hasShortfall, deductions }>`.
- **Behavior**: Idempotent — re-calling on an already-cooked meal returns `alreadyCooked: true` without deducting stock again (enforced by the RPC, not just client-side). FIFO-deducts across `inventory_batches` (soonest expiry first); a shortfall never fails the call, it's reported per-ingredient in `deductions`.
- **Error Behavior**: Throws `AppError` with code `MEAL_COOK_VALIDATION_ERROR` for missing IDs, or `MEAL_COOK_FAILED` if the RPC errors.

#### `cookRecipeNow(householdId, { recipeId, mealType, servings, requiredIngredients })` (Phase 4C)
- Convenience wrapper for the Recipe Detail "Cook Now" flow: `createMealLog` (status `planned`, `date` = today) followed immediately by `markAsCooked` on the new row. Two separate calls, not one transaction — a `markAsCooked` failure leaves the meal in `planned` rather than losing the cook record or double-deducting.
- **Returns**: same shape as `markAsCooked`.

#### `getMealHistory(householdId, { limit?, offset?, recipeId? })` (Phase 4C)
- **Returns**: `Promise<{ mealLogs: Array<MealLog & { recipes: Recipe }>, hasMore: boolean }>` — cooked meals only, most recent first, recipe embedded via a single joined query (avoids N+1). `recipeId` narrows to one recipe's history (Recipe Detail's "Cooking history").

#### `getRecentlyCookedRecipeIds(householdId, limit = 10)` (Phase 4C)
- **Returns**: `Promise<Array<string>>` — distinct recipe IDs, most-recently-cooked first. Powers the Library's "Recently Cooked" shelf; never throws (degrades to `[]` on failure, logged as a warning).

#### `getStockDeductionsForMeal(mealLogId)` (Phase 4C)
- **Returns**: `Promise<Array<StockDeduction & { inventory: { canonical_name } }>>` — the ingredient-level FIFO deduction audit trail for one cooked meal, for Meal History's expandable detail row.

---

### 2.18 `rotiCalculator` (Phase 4B, `src/utils/rotiCalculator.js`)

Pure calculation utility, not a service (no I/O). Computes flour/dough requirements from `household.roti_per_adult`/`roti_per_child`, per-member `roti_preference` overrides, and the `guests` table — see [09_RECIPE_AND_MEAL_LOGGING_SPECIFICATION.md §7.1](./09_RECIPE_AND_MEAL_LOGGING_SPECIFICATION.md) for why this differs from the originally-designed age-tiered formula.

#### `calculateRotiRequirement({ members, household, guestCount, andaazaFactor?, flourPerRotiGrams? })`
- **Returns**: `{ totalRotis, totalFlourGrams, estimatedDoughGrams }`

#### `getEffectiveGuestCount(guests, date, mealType)`
- **Returns**: `number` — sums `guests.count` for rows matching `date` and (`meal_scope === mealType` or `meal_scope === 'all'`).

---

### 2.19 `dashboardInsights` (Phase 5A, `src/utils/dashboardInsights.js`)

Pure calculation utilities, not a service (no I/O) — every Kitchen Intelligence Dashboard module is one of these functions, taking already-fetched aggregated data and deriving a view model. See [07_ANDAAZA_AI_LEARNING_ENGINE.md §13](./07_ANDAAZA_AI_LEARNING_ENGINE.md) for the "no new prediction logic" reuse principle each one follows.

| Function | Reuses | Produces |
| :--- | :--- | :--- |
| `derivePantryHealth(predictions)` | `PredictionService.calculatePantryHealthScore` | `{ score, label, trackedIngredients, atRiskCount }` |
| `deriveLowStockPredictions(predictions)` | — (filter/sort only) | Array of at-risk ingredients, soonest-first |
| `deriveExpiryRisk(expiringBatches)` | — | Array with `daysUntilExpiry`/`isExpired`, soonest/most-overdue first |
| `deriveShoppingIntelligence(predictions, consumptionProfiles, { withinDays? })` | — (joins two already-fetched sources by canonical_name) | "Buy soon" list with suggested quantity/brand |
| `deriveCookingSuggestions(recipes, inventoryItems, atRiskCanonicalNames, { maxSuggestions? })` | `RecipeService.scaleRecipeIngredients`, `ingredientAvailability.js` (Phase 4C) | `{ readyToCook, useItUp }` — two deterministic buckets, not a scored recommendation |
| `derivePantryInsights(householdProfile, consumptionProfiles)` | — | Diversity score, top categories, fastest-moving ingredients |
| `deriveHouseholdTrends(householdProfile, consumptionProfiles)` | — | Shopping cadence, bill count, ingredient-profile stability |
| `deriveObservationTimeline(observations)` | — | Display-ready `ai_observations` rows |
| `deriveHouseholdSnapshot({...})` | — | Composes other modules' already-derived output into a compact header summary |
| `deriveQuickActions({...})` | — | Contextual action buttons (max 4), prioritized by what's actionable |

---

### 2.20 `useDashboard` (Phase 5A, `src/hooks/useDashboard.js`)

Orchestrating hook for `/dashboard`. Fires a small **fixed** set of aggregated queries — `PredictionService.getHouseholdPredictions`, `HouseholdIntelligenceService.getHouseholdProfile`, `ConsumptionProfileService.getAllProfiles`, `InventoryService.getExpiringBatches`, `AIObservationService.getRecentObservations`, plus `HouseholdService.getHouseholdDetails` — each one query per household, never one per ingredient/recipe/batch. Reuses existing hooks/cache keys rather than re-fetching: `useInventory()`, `useRecipes()` (same default-filter cache key `RecipeLibrary` warms), `useRecentlyCookedRecipes()`, `useMealHistory()`. All derived module data is wrapped in `useMemo`, keyed off stable references (a shared `EMPTY_ARRAY` constant avoids new-array-per-render invalidating memoization while a query is still loading).

- **Returns**: `{ isLoading, isError, refetch, snapshot, pantryHealth, lowStock, expiryRisk, shoppingIntelligence, cookingSuggestions, pantryInsights, householdTrends, observationTimeline, quickActions }`

---

### 2.21 `PlanningEngine` (Phase 5B, `src/services/PlanningEngine.js`)

Pure computation module (no I/O — deliberately not a Supabase-calling service like the rest of `src/services/`; see [09_RECIPE_AND_MEAL_LOGGING_SPECIFICATION.md §9.2](./09_RECIPE_AND_MEAL_LOGGING_SPECIFICATION.md) for why it lives here anyway). Reuses `dashboardInsights.js` (Phase 5A) and `ingredientAvailability.js`/`RecipeService.scaleRecipeIngredients` (Phase 4C/4B) directly rather than reimplementing availability, depletion, or expiry logic.

#### `buildPlanningContext(raw)`
- Assembles the shared context object every function below consumes from already-fetched data (recipes, inventory, predictions, consumption profiles, expiring batches, household profile, preferences, upcoming meal_logs, recent cooked meal_logs).

#### `filterRecipesByPreferences(recipes, preferences, weekday)`
- Hard filter (never a scoring signal) for `non_veg_days` and `excluded_vegetables`. Pure.

#### `scoreMealCandidate(recipe, weekday, ctx)`
- **Returns**: `{ recipe, score, reasons, confidence, availability, availabilitySummary, requiresShopping, missingIngredients }` — see §9.3 of the recipe/meal doc for the full scoring table. `reasons` is never empty.

#### `generateTodaysPlan(ctx, excludedByMealType?)`
- **Returns**: `{ breakfast, lunch, dinner }`, each `{ status: 'planned'|'cooked'|'skipped'|'suggested'|'no_options', mealLog?, suggestion?, alternates? }`.

#### `generateWeekPreview(ctx, days = 7)`
- **Returns**: `Array<{ date, weekday, dateLabel, meals: {...} }>` — tracks recipes already picked earlier in the week and prefers a fresh one where possible (variety optimization).

#### `generateShoppingSuggestions(ctx)`
- **Returns**: `Array<{ category, items: Array<{canonicalName, suggestedGrams, reason, confidence, priority, purchaseWindow, preferredBrand}> }>` — see §9.5 of the recipe/meal doc.

#### `deriveCookingSuggestions` (re-exported from `dashboardInsights.js`)
- For callers that want the plain "ready to cook" / "uses at-risk ingredients" buckets without day-of-week ranking.

---

### 2.22 `usePlanner` (Phase 5B, `src/hooks/usePlanner.js`)

Orchestrating hook for `/planner`. Query keys for `predictions`/`householdProfile`/`consumptionProfiles`/`expiringBatches` deliberately match `useDashboard.js`'s exactly, and `preferences` matches the pre-existing `useHousehold.js`'s — visiting the Dashboard, completing onboarding, or opening the Planner all warm each other's caches. `mealLogs` (upcoming planned/cooked meals for the visible window) is the one genuinely new aggregated query.

- **Returns**: `{ isLoading, isError, refetch, todaysPlan, weekPreview, shoppingSuggestions, recipeById, acceptSuggestion, isAccepting, dismissSuggestion, regenerateSuggestion }`
- `acceptSuggestion(mealType, suggestion, date?)`: calls `MealLogService.createMealLog` (no new persistence logic), invalidates `mealLogs`/`mealHistory` caches.
- `dismissSuggestion` / `regenerateSuggestion`: both add the candidate's recipe id to an in-memory (not persisted) per-slot exclusion set — a dismissal means "not today," not "never again."

---

### 2.23 `supabaseClient`

The unified client configuration initializing Supabase JS SDK.

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
```
