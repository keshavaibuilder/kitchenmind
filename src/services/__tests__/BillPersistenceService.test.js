import { BillPersistenceService } from '../BillPersistenceService.js'
import { supabaseClient } from '../supabaseClient.js'
import { AndaazaLearningService } from '../AndaazaLearningService.js'

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
 * BillPersistenceService Automated Test Suite
 */
export async function runBillPersistenceTests() {
  const results = []
  
  function assert(condition, message) {
    if (!condition) {
      throw new Error(`ASSERTION FAILED: ${message}`)
    }
  }

  console.log('🧪 Starting BillPersistenceService Automated Tests...\n')

  // Test 1: Pre-commit Validation — Missing Household ID
  try {
    await BillPersistenceService.commitBill(null, { items: [{ userEdits: { quantity: 1, unit: 'kg' } }] })
    results.push({ name: 'Validation: Missing Household ID', passed: false, error: 'Expected error but succeeded' })
  } catch (err) {
    assert(err.code === 'PERSISTENCE_VALIDATION_ERROR', 'Should throw PERSISTENCE_VALIDATION_ERROR')
    results.push({ name: 'Validation: Missing Household ID', passed: true })
  }

  // Test 2: Pre-commit Validation — Zero Active Items
  try {
    await BillPersistenceService.commitBill('hh_123', { items: [{ status: 'removed' }] })
    results.push({ name: 'Validation: Zero Active Items', passed: false, error: 'Expected error but succeeded' })
  } catch (err) {
    assert(err.code === 'PERSISTENCE_VALIDATION_ERROR', 'Should throw PERSISTENCE_VALIDATION_ERROR')
    results.push({ name: 'Validation: Zero Active Items', passed: true })
  }

  // Test 3: Pre-commit Validation — Invalid Quantity <= 0
  try {
    await BillPersistenceService.commitBill('hh_123', {
      items: [{ status: 'confirmed', userEdits: { canonicalName: 'Salt', quantity: 0, unit: 'kg' } }],
    })
    results.push({ name: 'Validation: Invalid Quantity <= 0', passed: false, error: 'Expected error but succeeded' })
  } catch (err) {
    assert(err.code === 'PERSISTENCE_VALIDATION_ERROR', 'Should throw PERSISTENCE_VALIDATION_ERROR')
    results.push({ name: 'Validation: Invalid Quantity <= 0', passed: true })
  }

  // Test 4: Unit Conversion Math & Payload Normalization
  let capturedRpcPayload = null
  const restoreRpc = createSupabaseRpcMock(async (fnName, args) => {
    capturedRpcPayload = args.p_payload
    return {
      data: {
        success: true,
        commit_id: 'cmt_001',
        bill_id: 'bill_001',
        household_id: args.p_payload.household_id,
        idempotency_key: args.p_payload.idempotency_key,
        is_duplicate: false,
        metrics: {
          bill_items_created: args.p_payload.items.length,
          inventory_updated: args.p_payload.items.length,
          batches_created: args.p_payload.items.length,
          transactions_recorded: args.p_payload.items.length,
        },
        committed_at: new Date().toISOString(),
      },
      error: null,
    }
  })

  try {
    const summary = await BillPersistenceService.commitBill('hh_999', {
      idempotencyKey: 'tx_unit_test_001',
      merchant: 'Reliance Fresh',
      billDate: '2026-08-06',
      totalAmount: 193.00,
      items: [
        { status: 'confirmed', userEdits: { itemName: 'TATA SALT 1KG', canonicalName: 'Salt', quantity: 2, unit: 'kg', price: 56 } },
        { status: 'confirmed', userEdits: { itemName: 'FORTUNE OIL 1L', canonicalName: 'Cooking Oil', quantity: 1, unit: 'L', price: 137 } },
      ],
    })

    assert(summary.success === true, 'Summary success should be true')
    assert(summary.commitId === 'cmt_001', 'Should capture commitId')
    assert(summary.metrics.billItemsCreated === 2, 'Metrics should match 2 items')
    assert(capturedRpcPayload.items[0].unit_grams === 2000, '2 kg should convert to 2000 unit_grams')
    assert(capturedRpcPayload.items[1].unit_grams === 1000, '1 L should convert to 1000 unit_grams')

    results.push({ name: 'Fresh Commit Payload & Unit Normalization', passed: true })
  } catch (err) {
    results.push({ name: 'Fresh Commit Payload & Unit Normalization', passed: false, error: err.message })
  } finally {
    restoreRpc()
  }

  // Test 5: Idempotency Short-Circuit Handling
  const restoreRpcDuplicate = createSupabaseRpcMock(async (fnName, args) => {
    return {
      data: {
        success: true,
        commit_id: 'cmt_dup_002',
        bill_id: 'bill_existing_001',
        household_id: args.p_payload.household_id,
        idempotency_key: args.p_payload.idempotency_key,
        is_duplicate: true,
        metrics: {
          bill_items_created: 1,
          inventory_updated: 1,
          batches_created: 1,
          transactions_recorded: 1,
        },
        committed_at: new Date().toISOString(),
      },
      error: null,
    }
  })

  try {
    const summary = await BillPersistenceService.commitBill('hh_999', {
      idempotencyKey: 'tx_duplicate_key_123',
      items: [{ status: 'confirmed', userEdits: { canonicalName: 'Rice', quantity: 5, unit: 'kg' } }],
    })

    assert(summary.isDuplicate === true, 'isDuplicate should be true for existing key')
    assert(summary.billId === 'bill_existing_001', 'Should return existing billId')
    results.push({ name: 'Idempotency Duplicate Key Handling', passed: true })
  } catch (err) {
    results.push({ name: 'Idempotency Duplicate Key Handling', passed: false, error: err.message })
  } finally {
    restoreRpcDuplicate()
  }

  // Test 6: Non-blocking Async Post-Commit Failure Resilience
  const originalRecordObs = AndaazaLearningService.recordObservations
  AndaazaLearningService.recordObservations = async () => {
    throw new Error('Database connection reset during AI observation write')
  }

  const restoreRpcAsyncTest = createSupabaseRpcMock(async (fnName, args) => {
    return {
      data: {
        success: true,
        commit_id: 'cmt_async_003',
        bill_id: 'bill_async_001',
        household_id: args.p_payload.household_id,
        idempotency_key: args.p_payload.idempotency_key,
        is_duplicate: false,
        metrics: { bill_items_created: 1, inventory_updated: 1, batches_created: 1, transactions_recorded: 1 },
        committed_at: new Date().toISOString(),
      },
      error: null,
    }
  })

  try {
    const summary = await BillPersistenceService.commitBill('hh_999', {
      idempotencyKey: 'tx_async_test_456',
      items: [{ status: 'confirmed', userEdits: { canonicalName: 'Atta', quantity: 10, unit: 'kg' } }],
    })

    assert(summary.success === true, 'Bill commit must succeed even if async AI observation fails')
    results.push({ name: 'Non-Blocking Async Post-Commit Error Isolation', passed: true })
  } catch (err) {
    results.push({ name: 'Non-Blocking Async Post-Commit Error Isolation', passed: false, error: err.message })
  } finally {
    AndaazaLearningService.recordObservations = originalRecordObs
    restoreRpcAsyncTest()
  }

  // Test 7: Simulated Database Rollback Error Handling
  const restoreRpcRollback = createSupabaseRpcMock(async (fnName, args) => {
    return {
      data: null,
      error: { message: 'RPC_INVALID_ITEMS: Item unit_grams must be greater than 0', code: 'P0001' },
    }
  })

  try {
    await BillPersistenceService.commitBill('hh_999', {
      idempotencyKey: 'tx_rollback_test',
      items: [{ status: 'confirmed', userEdits: { canonicalName: 'Pepper', quantity: 1, unit: 'g' } }],
    })
    results.push({ name: 'Database Rollback Exception Handling', passed: false, error: 'Expected error but succeeded' })
  } catch (err) {
    assert(err.code === 'BILL_COMMIT_FAILED', 'Should map DB failure to BILL_COMMIT_FAILED')
    results.push({ name: 'Database Rollback Exception Handling', passed: true })
  } finally {
    restoreRpcRollback()
  }

  // Summary Report
  console.log('📊 Test Execution Summary:')
  let totalPassed = 0
  results.forEach((r, idx) => {
    if (r.passed) {
      totalPassed++
      console.log(`  ✓ Test ${idx + 1}: ${r.name}`)
    } else {
      console.log(`  ✕ Test ${idx + 1}: ${r.name} -> Error: ${r.error}`)
    }
  })

  console.log(`\nResults: ${totalPassed} / ${results.length} tests passed cleanly.\n`)
  return totalPassed === results.length
}
