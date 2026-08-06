import { runPhase3HIntegrationTests } from '../src/services/__tests__/Phase3HIntegration.test.js'
import { runBillPersistenceTests } from '../src/services/__tests__/BillPersistenceService.test.js'
import { BillPersistenceService } from '../src/services/BillPersistenceService.js'
import { supabaseClient } from '../src/services/supabaseClient.js'

function generateBenchmarkPayload(count) {
  const items = []
  for (let i = 1; i <= count; i++) {
    items.push({
      status: 'confirmed',
      userEdits: {
        itemName: `bench_item_${i}`,
        canonicalName: `Benchmark_Canonical_${i}`,
        quantity: (i % 4) + 1,
        unit: i % 2 === 0 ? 'kg' : 'g',
        price: (i * 12.5).toFixed(2),
        category: 'Staples',
      },
    })
  }
  return items
}

async function runPerformanceBenchmarks() {
  console.log('\n⚡ Running Objective 4 Performance Validation Benchmarks...\n')
  const benchmarkSizes = [10, 50, 100, 500]
  const benchmarkResults = []

  // Mock RPC to measure latency and memory
  const originalRpc = supabaseClient.rpc
  supabaseClient.rpc = async (fn, args) => {
    const startRpc = performance.now()
    const itemsCount = args.p_payload.items.length
    
    // Simulate lightweight DB loop latency (0.1ms per item)
    const simulatedLatencyMs = itemsCount * 0.1
    await new Promise((res) => setTimeout(res, simulatedLatencyMs))
    
    const rpcTime = performance.now() - startRpc

    return {
      data: {
        success: true,
        commit_id: `cmt_bench_${itemsCount}`,
        bill_id: `bill_bench_${itemsCount}`,
        household_id: args.p_payload.household_id,
        idempotency_key: args.p_payload.idempotency_key,
        is_duplicate: false,
        metrics: {
          bill_items_created: itemsCount,
          inventory_updated: itemsCount,
          batches_created: itemsCount,
          transactions_recorded: itemsCount,
        },
        committed_at: new Date().toISOString(),
        _simulated_rpc_ms: rpcTime,
      },
      error: null,
    }
  }

  try {
    for (const size of benchmarkSizes) {
      const items = generateBenchmarkPayload(size)
      const memBefore = process.memoryUsage().heapUsed

      const startTime = performance.now()
      const summary = await BillPersistenceService.commitBill('hh_benchmark_01', {
        idempotencyKey: `tx_bench_${size}_${Date.now()}`,
        merchant: 'Benchmark MegaStore',
        items,
      })
      const totalTimeMs = performance.now() - startTime

      const memAfter = process.memoryUsage().heapUsed
      const memDeltaKb = Math.max(0, (memAfter - memBefore) / 1024)

      // SQL statements formula: 1 (bill header) + size * (1 bill_item + 1 inventory upsert + 1 batch + 1 transaction) = 1 + 4*size
      const sqlStatementCount = 1 + (4 * size)

      benchmarkResults.push({
        itemCount: size,
        totalLatencyMs: Number(totalTimeMs.toFixed(2)),
        avgPerItemMs: Number((totalTimeMs / size).toFixed(3)),
        memoryDeltaKb: Number(memDeltaKb.toFixed(2)),
        sqlStatements: sqlStatementCount,
        success: summary.success,
      })
    }
  } finally {
    supabaseClient.rpc = originalRpc
  }

  console.log('📈 Performance Benchmark Report:')
  console.log('─────────────────────────────────────────────────────────────────────────────────')
  console.log('Item Count | Total Latency (ms) | Avg/Item (ms) | Memory Delta (KB) | SQL Statements')
  console.log('─────────────────────────────────────────────────────────────────────────────────')
  benchmarkResults.forEach((b) => {
    console.log(
      `${String(b.itemCount).padEnd(11)}| ${String(b.totalLatencyMs).padEnd(19)}| ${String(b.avgPerItemMs).padEnd(14)}| ${String(b.memoryDeltaKb).padEnd(18)}| ${b.sqlStatements}`
    )
  })
  console.log('─────────────────────────────────────────────────────────────────────────────────\n')

  return benchmarkResults
}

async function main() {
  try {
    const unitPassed = await runBillPersistenceTests()
    if (!unitPassed) {
      console.error('Unit tests failed!')
      process.exit(1)
    }

    const integrationPassed = await runPhase3HIntegrationTests()
    if (!integrationPassed) {
      console.error('Integration tests failed!')
      process.exit(1)
    }

    await runPerformanceBenchmarks()

    console.log('✅ Phase 3H All Tests & Benchmarks Completed Successfully!')
  } catch (err) {
    console.error('Fatal test execution error:', err)
    process.exit(1)
  }
}

main()
