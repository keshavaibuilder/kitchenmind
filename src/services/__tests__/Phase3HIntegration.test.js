import { BillPersistenceService } from '../BillPersistenceService.js'
import { AIObservationService } from '../AIObservationService.js'
import { supabaseClient } from '../supabaseClient.js'
import { verifyInventoryReconciliation } from '../../utils/reconciliation.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[ASSERTION_FAILED] ${message}`)
  }
}

/**
 * Mocking helper for Supabase Client RPC calls
 */
function createSupabaseRpcMock(mockImplementation) {
  const originalRpc = supabaseClient.rpc
  supabaseClient.rpc = mockImplementation
  return () => {
    supabaseClient.rpc = originalRpc
  }
}

/**
 * Helper to generate synthetic test bill payload
 */
function generateTestBill(itemCount, prefix = 'item') {
  const items = []
  for (let i = 1; i <= itemCount; i++) {
    items.push({
      status: 'confirmed',
      userEdits: {
        itemName: `${prefix}_raw_${i}`,
        canonicalName: `Canonical_${prefix}_${i}`,
        quantity: (i % 5) + 1,
        unit: i % 2 === 0 ? 'kg' : 'g',
        price: (i * 25.5).toFixed(2),
        category: i % 3 === 0 ? 'Staples' : 'Dairy',
      },
    })
  }
  return items
}

export async function runPhase3HIntegrationTests() {
  const results = []
  console.log('🧪 Starting Phase 3H Automated Integration Test Suite & Benchmarks...\n')

  // 1. Small Bill (3 items)
  const restoreSmall = createSupabaseRpcMock(async (fn, args) => {
    return {
      data: {
        success: true,
        commit_id: 'cmt_small_001',
        bill_id: 'bill_small_001',
        household_id: args.p_payload.household_id,
        idempotency_key: args.p_payload.idempotency_key,
        is_duplicate: false,
        metrics: { bill_items_created: 3, inventory_updated: 3, batches_created: 3, transactions_recorded: 3 },
        committed_at: new Date().toISOString(),
      },
      error: null,
    }
  })

  try {
    const summary = await BillPersistenceService.commitBill('hh_integration_01', {
      idempotencyKey: 'tx_small_001',
      items: generateTestBill(3, 'small'),
    })
    assert(summary.success === true, 'Small bill should commit successfully')
    assert(summary.metrics.billItemsCreated === 3, 'Should produce 3 bill items')
    results.push({ name: 'Integration Test 1: Small Bill Persistence (3 items)', passed: true })
  } catch (err) {
    results.push({ name: 'Integration Test 1: Small Bill Persistence (3 items)', passed: false, error: err.message })
  } finally {
    restoreSmall()
  }

  // 2. Medium Bill (10 items)
  const restoreMed = createSupabaseRpcMock(async (fn, args) => {
    return {
      data: {
        success: true,
        commit_id: 'cmt_med_001',
        bill_id: 'bill_med_001',
        household_id: args.p_payload.household_id,
        idempotency_key: args.p_payload.idempotency_key,
        is_duplicate: false,
        metrics: { bill_items_created: 10, inventory_updated: 10, batches_created: 10, transactions_recorded: 10 },
        committed_at: new Date().toISOString(),
      },
      error: null,
    }
  })

  try {
    const summary = await BillPersistenceService.commitBill('hh_integration_01', {
      idempotencyKey: 'tx_med_001',
      items: generateTestBill(10, 'med'),
    })
    assert(summary.metrics.billItemsCreated === 10, 'Should produce 10 items')
    results.push({ name: 'Integration Test 2: Medium Bill Persistence (10 items)', passed: true })
  } catch (err) {
    results.push({ name: 'Integration Test 2: Medium Bill Persistence (10 items)', passed: false, error: err.message })
  } finally {
    restoreMed()
  }

  // 3. Large Bill (50 items)
  const restoreLarge = createSupabaseRpcMock(async (fn, args) => {
    return {
      data: {
        success: true,
        commit_id: 'cmt_large_001',
        bill_id: 'bill_large_001',
        household_id: args.p_payload.household_id,
        idempotency_key: args.p_payload.idempotency_key,
        is_duplicate: false,
        metrics: { bill_items_created: 50, inventory_updated: 50, batches_created: 50, transactions_recorded: 50 },
        committed_at: new Date().toISOString(),
      },
      error: null,
    }
  })

  try {
    const summary = await BillPersistenceService.commitBill('hh_integration_01', {
      idempotencyKey: 'tx_large_001',
      items: generateTestBill(50, 'large'),
    })
    assert(summary.metrics.billItemsCreated === 50, 'Should process 50 items')
    results.push({ name: 'Integration Test 3: Large Bill Persistence (50 items)', passed: true })
  } catch (err) {
    results.push({ name: 'Integration Test 3: Large Bill Persistence (50 items)', passed: false, error: err.message })
  } finally {
    restoreLarge()
  }

  // 4. Duplicate Submission (Idempotency)
  const restoreDup = createSupabaseRpcMock(async (fn, args) => {
    return {
      data: {
        success: true,
        commit_id: 'cmt_dup_123',
        bill_id: 'bill_dup_001',
        household_id: args.p_payload.household_id,
        idempotency_key: args.p_payload.idempotency_key,
        is_duplicate: true,
        metrics: { bill_items_created: 3, inventory_updated: 3, batches_created: 3, transactions_recorded: 3 },
        committed_at: new Date().toISOString(),
      },
      error: null,
    }
  })

  try {
    const summary = await BillPersistenceService.commitBill('hh_integration_01', {
      idempotencyKey: 'tx_existing_key_001',
      items: generateTestBill(3, 'dup'),
    })
    assert(summary.isDuplicate === true, 'Duplicate key must return isDuplicate: true')
    results.push({ name: 'Integration Test 4: Idempotent Duplicate Submission', passed: true })
  } catch (err) {
    results.push({ name: 'Integration Test 4: Idempotent Duplicate Submission', passed: false, error: err.message })
  } finally {
    restoreDup()
  }

  // 5. Network Retry Resilience
  let attempt = 0
  const restoreRetry = createSupabaseRpcMock(async (fn, args) => {
    attempt++
    if (attempt === 1) {
      return { data: null, error: { message: 'Network connection reset by peer', code: 'FETCH_ERROR' } }
    }
    return {
      data: {
        success: true,
        commit_id: 'cmt_retry_001',
        bill_id: 'bill_retry_001',
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
    // Attempt 1 fails
    let err1 = null
    try {
      await BillPersistenceService.commitBill('hh_integration_01', {
        idempotencyKey: 'tx_retry_001',
        items: generateTestBill(2, 'retry'),
      })
    } catch (e) {
      err1 = e
    }
    assert(err1 !== null, 'First network attempt should fail')

    // Attempt 2 succeeds using same idempotency key
    const summary2 = await BillPersistenceService.commitBill('hh_integration_01', {
      idempotencyKey: 'tx_retry_001',
      items: generateTestBill(2, 'retry'),
    })
    assert(summary2.success === true, 'Retry attempt should succeed')
    results.push({ name: 'Integration Test 5: Network Retry with Idempotency Key', passed: true })
  } catch (err) {
    results.push({ name: 'Integration Test 5: Network Retry with Idempotency Key', passed: false, error: err.message })
  } finally {
    restoreRetry()
  }

  // 6. Concurrent Commits Deadlock Sorting Simulation
  const restoreConcurrent = createSupabaseRpcMock(async (fn, args) => {
    return {
      data: {
        success: true,
        commit_id: `cmt_conc_${Math.random()}`,
        bill_id: `bill_conc_${Math.random()}`,
        household_id: args.p_payload.household_id,
        idempotency_key: args.p_payload.idempotency_key,
        is_duplicate: false,
        metrics: { bill_items_created: 4, inventory_updated: 4, batches_created: 4, transactions_recorded: 4 },
        committed_at: new Date().toISOString(),
      },
      error: null,
    }
  })

  try {
    const p1 = BillPersistenceService.commitBill('hh_conc_01', { idempotencyKey: 'tx_conc_1', items: generateTestBill(4, 'c1') })
    const p2 = BillPersistenceService.commitBill('hh_conc_01', { idempotencyKey: 'tx_conc_2', items: generateTestBill(4, 'c2') })
    const p3 = BillPersistenceService.commitBill('hh_conc_01', { idempotencyKey: 'tx_conc_3', items: generateTestBill(4, 'c3') })

    const [res1, res2, res3] = await Promise.all([p1, p2, p3])
    assert(res1.success && res2.success && res3.success, 'All concurrent commits should complete successfully')
    results.push({ name: 'Integration Test 6: Concurrent Commits Execution', passed: true })
  } catch (err) {
    results.push({ name: 'Integration Test 6: Concurrent Commits Execution', passed: false, error: err.message })
  } finally {
    restoreConcurrent()
  }

  // 7. Inventory Reconciliation Utility Verification
  try {
    const mockInventory = [
      { id: 'inv_1', canonical_name: 'Atta', quantity_grams: 5000 },
      { id: 'inv_2', canonical_name: 'Salt', quantity_grams: 1000 },
    ]
    const mockBatches = [
      { id: 'b_1', inventory_id: 'inv_1', remaining_grams: 5000, status: 'active' },
      { id: 'b_2', inventory_id: 'inv_2', remaining_grams: 1000, status: 'active' },
    ]

    const auditReport = await verifyInventoryReconciliation('hh_reconcile_01', mockInventory, mockBatches)
    assert(auditReport.isReconciled === true, 'Reconciliation audit should report 100% match')
    assert(auditReport.verifiedCount === 2, 'Should verify 2 items')
    results.push({ name: 'Integration Test 7: Inventory Reconciliation Audit Utility', passed: true })
  } catch (err) {
    results.push({ name: 'Integration Test 7: Inventory Reconciliation Audit Utility', passed: false, error: err.message })
  }

  // 8. AI Observation Foundation Generation
  try {
    const items = [
      { userEdits: { canonicalName: 'Basmati Rice', quantity: 5, unit: 'kg' } }, // New item + Unusual qty
    ]
    const obsResult = await AIObservationService.recordPostCommitObservations('hh_obs_01', items)
    assert(obsResult.success === true, 'Post commit observation service should succeed')
    assert(obsResult.observationsCount >= 2, 'Should generate new ingredient and unusual quantity observations')
    results.push({ name: 'Integration Test 8: AI Post-Commit Observation Foundation', passed: true })
  } catch (err) {
    results.push({ name: 'Integration Test 8: AI Post-Commit Observation Foundation', passed: false, error: err.message })
  }

  // Summary Report
  console.log('\n📊 Integration Test Suite Results:')
  let totalPassed = 0
  results.forEach((r, idx) => {
    if (r.passed) {
      totalPassed++
      console.log(`  ✓ ${r.name}`)
    } else {
      console.log(`  ✕ ${r.name} -> Error: ${r.error}`)
    }
  })

  console.log(`\nOverall: ${totalPassed} / ${results.length} integration tests passed cleanly.\n`)
  return totalPassed === results.length
}
