import { runAndaazaIntelligenceTests } from '../src/services/__tests__/AndaazaIntelligence.test.js'
import { runPhase3HIntegrationTests } from '../src/services/__tests__/Phase3HIntegration.test.js'
import { runBillPersistenceTests } from '../src/services/__tests__/BillPersistenceService.test.js'
import { createMockSupabaseFrom } from '../src/services/__tests__/mockSupabaseTable.js'
import { AndaazaLearningEngine } from '../src/services/AndaazaLearningEngine.js'
import { supabaseClient } from '../src/services/supabaseClient.js'

async function runLearningEngineBenchmarks() {
  console.log('\n⚡ Running Phase 4A Andaaza Intelligence Engine Benchmarks...\n')
  const benchmarkSizes = [10, 50, 100, 500]
  const benchmarkResults = []

  // Benchmarks measure the learning engine's own compute + serialization cost against an
  // in-memory data store. A live database's I/O latency is a separate, environment-dependent
  // concern and is intentionally excluded so these numbers reflect engine overhead only.
  const originalFrom = supabaseClient.from
  supabaseClient.from = createMockSupabaseFrom({
    inventory: [],
    bills: [{ bill_date: '2026-08-01' }, { bill_date: '2026-08-06' }],
  }).from

  for (const size of benchmarkSizes) {
    const items = []
    for (let i = 1; i <= size; i++) {
      items.push({
        status: 'confirmed',
        userEdits: {
          itemName: `item_${i}`,
          canonicalName: `Canonical_Ingredient_${i}`,
          quantity: (i % 3) + 1,
          unit: 'kg',
          price: 100,
          category: 'Staples',
        },
      })
    }

    const memBefore = process.memoryUsage().heapUsed
    const startTime = performance.now()

    const result = await AndaazaLearningEngine.processPostCommitLearning('hh_bench_4a', items, { billDate: '2026-08-06' })
    const totalTimeMs = performance.now() - startTime

    const memAfter = process.memoryUsage().heapUsed
    const memDeltaKb = Math.max(0, (memAfter - memBefore) / 1024)

    benchmarkResults.push({
      itemCount: size,
      totalLatencyMs: Number(totalTimeMs.toFixed(2)),
      avgPerItemMs: Number((totalTimeMs / size).toFixed(3)),
      memoryDeltaKb: Number(memDeltaKb.toFixed(2)),
      profilesUpdated: result.profilesUpdated || size,
      success: result.success,
    })
  }

  supabaseClient.from = originalFrom

  console.log('📈 Phase 4A Learning Engine Performance Benchmark:')
  console.log('─────────────────────────────────────────────────────────────────────────────────')
  console.log('Item Count | Total Latency (ms) | Avg/Item (ms) | Memory Delta (KB) | Profiles Updated')
  console.log('─────────────────────────────────────────────────────────────────────────────────')
  benchmarkResults.forEach((b) => {
    console.log(
      `${String(b.itemCount).padEnd(11)}| ${String(b.totalLatencyMs).padEnd(19)}| ${String(b.avgPerItemMs).padEnd(14)}| ${String(b.memoryDeltaKb).padEnd(18)}| ${b.profilesUpdated}`
    )
  })
  console.log('─────────────────────────────────────────────────────────────────────────────────\n')

  return benchmarkResults
}

async function main() {
  // BillPersistenceService fires the Andaaza learning hooks (fire-and-forget) on every commit.
  // Route those at real Supabase network calls in this offline test run and every suite pays for
  // O(items) failed DNS lookups. Install the in-memory mock for the whole run so all three suites
  // (and the benchmark below) exercise engine logic only.
  const originalFrom = supabaseClient.from
  supabaseClient.from = createMockSupabaseFrom({
    inventory: [],
    bills: [{ bill_date: '2026-08-01' }, { bill_date: '2026-08-06' }],
  }).from

  try {
    const billPassed = await runBillPersistenceTests()
    if (!billPassed) process.exit(1)

    const integrationPassed = await runPhase3HIntegrationTests()
    if (!integrationPassed) process.exit(1)

    const andaazaPassed = await runAndaazaIntelligenceTests()
    if (!andaazaPassed) process.exit(1)

    await runLearningEngineBenchmarks()

    console.log('✅ Phase 4A Andaaza Intelligence Engine All Tests & Benchmarks Passed!')
  } catch (err) {
    console.error('Fatal test runner error:', err)
    process.exit(1)
  } finally {
    supabaseClient.from = originalFrom
  }
}

main()
