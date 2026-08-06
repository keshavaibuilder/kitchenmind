import { runPhase4BMealDeductionTests } from '../src/services/__tests__/Phase4BMealDeduction.test.js'

async function main() {
  try {
    const passed = await runPhase4BMealDeductionTests()
    if (!passed) process.exit(1)
    console.log('✅ Phase 4B Recipe Engine & Meal Deduction Tests Passed!')
  } catch (err) {
    console.error('Fatal test runner error:', err)
    process.exit(1)
  }
}

main()
