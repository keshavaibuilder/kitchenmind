import { ConsumptionProfileService } from '../ConsumptionProfileService.js'
import { PredictionService } from '../PredictionService.js'
import { HouseholdIntelligenceService } from '../HouseholdIntelligenceService.js'
import { AndaazaLearningEngine } from '../AndaazaLearningEngine.js'
import { BillPersistenceService } from '../BillPersistenceService.js'
import { supabaseClient } from '../supabaseClient.js'
import { createMockSupabaseFrom } from './mockSupabaseTable.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[ASSERTION_FAILED] ${message}`)
  }
}

function createSupabaseRpcMock(mockImplementation) {
  const originalRpc = supabaseClient.rpc
  supabaseClient.rpc = mockImplementation
  return () => {
    supabaseClient.rpc = originalRpc
  }
}

function createSupabaseFromMock(seedData = {}, options = {}) {
  const originalFrom = supabaseClient.from
  supabaseClient.from = createMockSupabaseFrom(seedData, options).from
  return () => {
    supabaseClient.from = originalFrom
  }
}

export async function runAndaazaIntelligenceTests() {
  const results = []
  console.log('🧠 Starting Phase 4A Andaaza Intelligence Engine Test Suite...\n')

  // Test 1: Deterministic Confidence Score Formula
  try {
    const p1 = ConsumptionProfileService.calculateProfileUpdate(null, { quantityGrams: 1000, purchaseDate: '2026-08-01' })
    assert(p1.confidence_score === 0.50, `Initial sample_count=1 confidence score should be 0.50, got ${p1.confidence_score}`)

    const p2 = ConsumptionProfileService.calculateProfileUpdate(p1, { quantityGrams: 1000, purchaseDate: '2026-08-10' })
    assert(p2.confidence_score === 0.60, `Sample count=2 confidence score should be 0.60, got ${p2.confidence_score}`)

    let pMany = p2
    for (let i = 3; i <= 10; i++) {
      pMany = ConsumptionProfileService.calculateProfileUpdate(pMany, { quantityGrams: 1000, purchaseDate: `2026-08-${10 + i}` })
    }
    assert(pMany.confidence_score === 0.95, `Confidence score should cap at 0.95, got ${pMany.confidence_score}`)
    results.push({ name: 'Test 1: Deterministic Confidence Score Convergence', passed: true })
  } catch (err) {
    results.push({ name: 'Test 1: Deterministic Confidence Score Convergence', passed: false, error: err.message })
  }

  // Test 2: Consumption Velocity Math (g/day) & Interval Updating
  try {
    const initial = { sample_count: 1, avg_purchase_grams: 1000, avg_interval_days: 10.0, last_purchased_at: '2026-08-01T00:00:00Z' }
    const updated = ConsumptionProfileService.calculateProfileUpdate(initial, { quantityGrams: 2000, purchaseDate: '2026-08-11' })

    // Interval between Aug 1 and Aug 11 = 10 days
    // Weighted avg interval = 10 * 0.5 + 10 * 0.5 = 10 days
    // Weighted avg purchase grams = 1000 * 0.6 + 2000 * 0.4 = 1400g
    // Velocity = 1400 / 10 = 140 g/day
    assert(updated.consumption_velocity_g_per_day === 140, `Velocity should be 140 g/day, got ${updated.consumption_velocity_g_per_day}`)
    results.push({ name: 'Test 2: Consumption Velocity & Interval Calculation', passed: true })
  } catch (err) {
    results.push({ name: 'Test 2: Consumption Velocity & Interval Calculation', passed: false, error: err.message })
  }

  // Test 3: Brand Preference Evolution
  try {
    const history = [
      { brand: 'Fortune' },
      { brand: 'Fortune' },
      { brand: 'Dhara' },
    ]
    const updated = ConsumptionProfileService.calculateProfileUpdate(
      { preferred_brand: 'Fortune' },
      { quantityGrams: 1000, purchaseDate: '2026-08-01', brand: 'Fortune' },
      history
    )
    assert(updated.preferred_brand === 'Fortune', `Preferred brand should be Fortune, got ${updated.preferred_brand}`)
    results.push({ name: 'Test 3: Brand Preference Evolution', passed: true })
  } catch (err) {
    results.push({ name: 'Test 3: Brand Preference Evolution', passed: false, error: err.message })
  }

  // Test 4: Depletion Date & Low Stock Risk Prediction
  try {
    const baseDate = new Date('2026-08-06T00:00:00Z')
    const pred = PredictionService.calculateDepletion(500, 100, baseDate)

    // 500g stock / 100 g/day = 5 days remaining
    // Aug 6 + 5 days = Aug 11
    assert(pred.daysUntilDepletion === 5, `Days remaining should be 5, got ${pred.daysUntilDepletion}`)
    assert(pred.predictedDepletionDate === '2026-08-11', `Predicted depletion date should be 2026-08-11, got ${pred.predictedDepletionDate}`)
    assert(pred.isLowStockRisk === false, '5 days stock should not be low stock risk (<= 3 days)')

    const riskPred = PredictionService.calculateDepletion(200, 100, baseDate)
    assert(riskPred.isLowStockRisk === true, '2 days stock should trigger low stock risk (<= 3 days)')
    results.push({ name: 'Test 4: Depletion Date & Low Stock Risk Algorithm', passed: true })
  } catch (err) {
    results.push({ name: 'Test 4: Depletion Date & Low Stock Risk Algorithm', passed: false, error: err.message })
  }

  // Test 5: Pantry Health Score Calculation
  try {
    const depletions = [
      { daysUntilDepletion: 14 },
      { daysUntilDepletion: 10 },
      { daysUntilDepletion: 2 },  // Unhealthy (< 7)
      { daysUntilDepletion: 8 },
    ]
    const score = PredictionService.calculatePantryHealthScore(depletions)
    assert(score === 75, `3 out of 4 healthy items should yield a score of 75, got ${score}`)
    results.push({ name: 'Test 5: Pantry Health Score Calculation', passed: true })
  } catch (err) {
    results.push({ name: 'Test 5: Pantry Health Score Calculation', passed: false, error: err.message })
  }

  // Test 6: Household Intelligence Profile Aggregation
  try {
    const mockInventory = [
      { canonical_name: 'Atta', category: 'Staples' },
      { canonical_name: 'Salt', category: 'Staples' },
      { canonical_name: 'Milk', category: 'Dairy' },
    ]
    const mockBills = [
      { bill_date: '2026-08-02' }, // Sunday
      { bill_date: '2026-08-09' }, // Sunday
    ]
    const profile = HouseholdIntelligenceService.calculateHouseholdMetrics('hh_test_4a', mockInventory, mockBills)

    assert(profile.pantry_diversity_score === 3, `Pantry diversity score should be 3, got ${profile.pantry_diversity_score}`)
    assert(profile.preferred_shopping_day === 'Sunday', `Preferred shopping day should be Sunday, got ${profile.preferred_shopping_day}`)
    assert(profile.top_categories[0].category === 'Staples', `Top category should be Staples, got ${profile.top_categories[0].category}`)
    results.push({ name: 'Test 6: Household Intelligence Profile Aggregation', passed: true })
  } catch (err) {
    results.push({ name: 'Test 6: Household Intelligence Profile Aggregation', passed: false, error: err.message })
  }

  // Test 7: Post-Commit Learning Engine Execution & Asynchronous Resilience
  const restoreFrom = createSupabaseFromMock({
    inventory: [{ canonical_name: 'Salt', category: 'Staples' }],
    bills: [{ bill_date: '2026-08-02' }],
  })
  const restoreRpc = createSupabaseRpcMock(async (fn, args) => {
    return {
      data: {
        success: true,
        commit_id: 'cmt_4a_001',
        bill_id: 'bill_4a_001',
        household_id: args.p_payload.household_id,
        idempotency_key: args.p_payload.idempotency_key,
        is_duplicate: false,
        metrics: { bill_items_created: 2, inventory_updated: 2, batches_created: 2, transactions_recorded: 2 },
        committed_at: new Date().toISOString(),
      },
      error: null,
    }
  })

  try {
    const startedAt = performance.now()
    const summary = await BillPersistenceService.commitBill('hh_intel_test', {
      idempotencyKey: 'tx_4a_001',
      items: [
        { status: 'confirmed', userEdits: { canonicalName: 'Whole Wheat Atta', quantity: 5, unit: 'kg', price: 240 } },
        { status: 'confirmed', userEdits: { canonicalName: 'Sunflower Oil', quantity: 1, unit: 'L', price: 145 } },
      ],
    })
    const commitLatencyMs = performance.now() - startedAt

    assert(summary.success === true, 'Bill persistence commit must succeed')
    assert(commitLatencyMs < 50, `Bill commit must return before async learning hooks complete, took ${commitLatencyMs.toFixed(2)}ms`)

    // Allow the fire-and-forget post-commit hook to settle before asserting on learned state.
    await new Promise((resolve) => setTimeout(resolve, 20))
    const learnedProfile = await ConsumptionProfileService.getIngredientProfile('hh_intel_test', 'Whole Wheat Atta')
    assert(learnedProfile !== null, 'Post-commit hook should have written an ingredient_consumption_profile row')
    assert(learnedProfile.sample_count === 1, `Expected first-sample profile, got sample_count=${learnedProfile?.sample_count}`)

    results.push({ name: 'Test 7: Post-Commit Learning Engine Non-Blocking Execution', passed: true })
  } catch (err) {
    results.push({ name: 'Test 7: Post-Commit Learning Engine Non-Blocking Execution', passed: false, error: err.message })
  } finally {
    restoreRpc()
    restoreFrom()
  }

  // Test 8: Database Failure Resilience (exercises the non-blocking catch branches directly,
  // not just structurally — a mock that always succeeds can never prove these paths work)
  const restoreFailingFrom = createSupabaseFromMock({}, {
    failTables: ['ingredient_consumption_profile', 'purchase_patterns', 'prediction_cache', 'household_learning_profile', 'inventory', 'bills'],
  })
  try {
    const profile = await ConsumptionProfileService.getIngredientProfile('hh_fail_test', 'Rice')
    assert(profile === null, 'getIngredientProfile must degrade to null (not throw) when the DB read fails')

    const engineResult = await AndaazaLearningEngine.processPostCommitLearning('hh_fail_test', [
      { status: 'confirmed', userEdits: { canonicalName: 'Rice', quantity: 1, unit: 'kg', price: 60 } },
    ])
    assert(engineResult.success === true, 'Engine must report success even when every downstream write fails')

    results.push({ name: 'Test 8: Database Failure Resilience (non-blocking catch paths)', passed: true })
  } catch (err) {
    results.push({ name: 'Test 8: Database Failure Resilience (non-blocking catch paths)', passed: false, error: err.message })
  } finally {
    restoreFailingFrom()
  }

  // Summary
  console.log('📊 Phase 4A Intelligence Test Suite Results:')
  let totalPassed = 0
  results.forEach((r, idx) => {
    if (r.passed) {
      totalPassed++
      console.log(`  ✓ ${r.name}`)
    } else {
      console.log(`  ✕ ${r.name} -> Error: ${r.error}`)
    }
  })

  console.log(`\nOverall: ${totalPassed} / ${results.length} Phase 4A intelligence tests passed cleanly.\n`)
  return totalPassed === results.length
}
