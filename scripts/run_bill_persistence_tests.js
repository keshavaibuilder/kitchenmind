import { runBillPersistenceTests } from '../src/services/__tests__/BillPersistenceService.test.js'

async function main() {
  try {
    const passed = await runBillPersistenceTests()
    if (!passed) {
      process.exit(1)
    }
  } catch (err) {
    console.error('Fatal test runner error:', err)
    process.exit(1)
  }
}

main()
