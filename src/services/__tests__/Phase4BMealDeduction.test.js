import { calculateMemberRotiCount, getEffectiveGuestCount, calculateRotiRequirement } from '../../utils/rotiCalculator.js'
import { RecipeService } from '../RecipeService.js'
import { MealLogService } from '../MealLogService.js'
import { supabaseClient } from '../supabaseClient.js'

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

export async function runPhase4BMealDeductionTests() {
  const results = []
  console.log('🍲 Starting Phase 4B Recipe Engine & Meal Deduction Test Suite...\n')

  const household = { roti_per_adult: 3, roti_per_child: 2 }

  // Test 1: Member roti count respects explicit override before falling back to household defaults
  try {
    assert(calculateMemberRotiCount({ role: 'adult', roti_preference: 4 }, household) === 4, 'Explicit override should win')
    assert(calculateMemberRotiCount({ role: 'adult' }, household) === 3, 'Adult should fall back to household.roti_per_adult')
    assert(calculateMemberRotiCount({ role: 'child' }, household) === 2, 'Child should fall back to household.roti_per_child')
    assert(calculateMemberRotiCount({ role: 'elder' }, household) === 3, 'Elder should fall back to the adult default (no dedicated elder rate in schema)')
    results.push({ name: 'Test 1: Member Roti Count Resolution', passed: true })
  } catch (err) {
    results.push({ name: 'Test 1: Member Roti Count Resolution', passed: false, error: err.message })
  }

  // Test 2: Guest count filtering by date and meal_scope
  try {
    const guests = [
      { date: '2026-08-10', meal_scope: 'lunch', count: 2 },
      { date: '2026-08-10', meal_scope: 'all', count: 1 },
      { date: '2026-08-10', meal_scope: 'dinner', count: 5 },
      { date: '2026-08-11', meal_scope: 'lunch', count: 9 },
    ]
    const lunchGuests = getEffectiveGuestCount(guests, '2026-08-10', 'lunch')
    assert(lunchGuests === 3, `Expected 2 (lunch) + 1 (all) = 3 guests, got ${lunchGuests}`)
    results.push({ name: 'Test 2: Effective Guest Count Filtering', passed: true })
  } catch (err) {
    results.push({ name: 'Test 2: Effective Guest Count Filtering', passed: false, error: err.message })
  }

  // Test 3: Full roti requirement calculation (deterministic)
  try {
    const members = [
      { role: 'adult' }, // 3
      { role: 'adult', roti_preference: 2.5 }, // 2.5
      { role: 'child' }, // 2
    ]
    // memberRotis = 3 + 2.5 + 2 = 7.5; guestRotis = 2 guests * 3 = 6; total = 13.5
    const req = calculateRotiRequirement({ members, household, guestCount: 2 })
    assert(req.totalRotis === 13.5, `Expected 13.5 total rotis, got ${req.totalRotis}`)
    assert(req.totalFlourGrams === Math.ceil(13.5 * 28.5), `Flour grams mismatch, got ${req.totalFlourGrams}`)
    assert(req.estimatedDoughGrams === Math.ceil(req.totalFlourGrams * 1.65), `Dough grams mismatch, got ${req.estimatedDoughGrams}`)
    results.push({ name: 'Test 3: Full Roti Requirement Calculation', passed: true })
  } catch (err) {
    results.push({ name: 'Test 3: Full Roti Requirement Calculation', passed: false, error: err.message })
  }

  // Test 4: Recipe ingredient scaling math
  try {
    const recipe = {
      base_servings: 4,
      ingredients: [
        { canonical_name: 'Toor Dal', base_quantity_grams: 200 },
        { canonical_name: 'Turmeric', base_quantity_grams: 5, is_optional: true },
      ],
    }
    const scaled = RecipeService.scaleRecipeIngredients(recipe, 6) // 1.5x
    assert(scaled[0].quantity_grams === 300, `Toor Dal should scale to 300g, got ${scaled[0].quantity_grams}`)
    assert(scaled[1].quantity_grams === 7.5, `Turmeric should scale to 7.5g, got ${scaled[1].quantity_grams}`)
    assert(scaled[1].is_optional === true, 'is_optional flag should pass through')

    const unscaled = RecipeService.scaleRecipeIngredients({ base_servings: 4, ingredients: [] }, 4)
    assert(Array.isArray(unscaled) && unscaled.length === 0, 'Empty ingredients should scale to an empty array, not throw')
    results.push({ name: 'Test 4: Recipe Ingredient Scaling', passed: true })
  } catch (err) {
    results.push({ name: 'Test 4: Recipe Ingredient Scaling', passed: false, error: err.message })
  }

  // Test 5: markAsCooked RPC payload shape & successful response mapping
  let capturedPayload = null
  const restoreRpcSuccess = createSupabaseRpcMock(async (fnName, args) => {
    capturedPayload = args.p_payload
    return {
      data: {
        success: true,
        meal_log_id: args.p_payload.meal_log_id,
        already_cooked: false,
        cooked_at: '2026-08-10T12:00:00Z',
        has_shortfall: false,
        deductions: [{ canonical_name: 'Toor Dal', required_grams: 300, deducted_grams: 300, shortfall_grams: 0, out_of_stock: false }],
      },
      error: null,
    }
  })
  try {
    const result = await MealLogService.markAsCooked('hh_4b_001', 'meal_001', [{ canonical_name: 'Toor Dal', quantity_grams: 300 }])
    assert(capturedPayload.household_id === 'hh_4b_001', 'RPC payload should carry household_id')
    assert(capturedPayload.meal_log_id === 'meal_001', 'RPC payload should carry meal_log_id')
    assert(result.success === true, 'markAsCooked should report success')
    assert(result.alreadyCooked === false, 'alreadyCooked should map from already_cooked')
    assert(result.deductions.length === 1, 'Deductions array should pass through')
    results.push({ name: 'Test 5: markAsCooked RPC Payload & Response Mapping', passed: true })
  } catch (err) {
    results.push({ name: 'Test 5: markAsCooked RPC Payload & Response Mapping', passed: false, error: err.message })
  } finally {
    restoreRpcSuccess()
  }

  // Test 6: markAsCooked idempotent already-cooked short-circuit passthrough
  const restoreRpcDuplicate = createSupabaseRpcMock(async () => ({
    data: { success: true, meal_log_id: 'meal_002', already_cooked: true, cooked_at: '2026-08-09T08:00:00Z', deductions: [] },
    error: null,
  }))
  try {
    const result = await MealLogService.markAsCooked('hh_4b_001', 'meal_002', [{ canonical_name: 'Rice', quantity_grams: 100 }])
    assert(result.alreadyCooked === true, 'Already-cooked meals must short-circuit without re-deducting')
    results.push({ name: 'Test 6: markAsCooked Idempotent Short-Circuit', passed: true })
  } catch (err) {
    results.push({ name: 'Test 6: markAsCooked Idempotent Short-Circuit', passed: false, error: err.message })
  } finally {
    restoreRpcDuplicate()
  }

  // Test 7: markAsCooked surfaces RPC failures as normalized errors
  const restoreRpcFailure = createSupabaseRpcMock(async () => ({
    data: null,
    error: { message: 'RPC_NOT_FOUND: meal_log does not exist for this household', code: 'P0001' },
  }))
  try {
    await MealLogService.markAsCooked('hh_4b_001', 'meal_missing', [])
    results.push({ name: 'Test 7: markAsCooked RPC Failure Handling', passed: false, error: 'Expected error but succeeded' })
  } catch (err) {
    assert(err.code === 'MEAL_COOK_FAILED', `Should map to MEAL_COOK_FAILED, got ${err.code}`)
    results.push({ name: 'Test 7: markAsCooked RPC Failure Handling', passed: true })
  } finally {
    restoreRpcFailure()
  }

  // Test 8: markAsCooked pre-flight validation (missing IDs never reaches the network)
  try {
    await MealLogService.markAsCooked(null, 'meal_003', [])
    results.push({ name: 'Test 8: markAsCooked Validation Guard', passed: false, error: 'Expected error but succeeded' })
  } catch (err) {
    assert(err.code === 'MEAL_COOK_VALIDATION_ERROR', `Should throw MEAL_COOK_VALIDATION_ERROR, got ${err.code}`)
    results.push({ name: 'Test 8: markAsCooked Validation Guard', passed: true })
  }

  // Summary
  console.log('📊 Phase 4B Test Suite Results:')
  let totalPassed = 0
  results.forEach((r) => {
    if (r.passed) {
      totalPassed++
      console.log(`  ✓ ${r.name}`)
    } else {
      console.log(`  ✕ ${r.name} -> Error: ${r.error}`)
    }
  })
  console.log(`\nOverall: ${totalPassed} / ${results.length} Phase 4B tests passed cleanly.\n`)
  return totalPassed === results.length
}
