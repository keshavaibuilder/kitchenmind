/**
 * In-memory Supabase `.from()` mock used by test suites and benchmarks so they exercise
 * real engine logic without making live network calls to Supabase/Postgres.
 *
 * @param {Object} seedData - Initial rows per table, e.g. { inventory: [...] }
 * @param {Object} [options]
 * @param {Array<string>} [options.failTables] - Table names that should return a PostgREST-style
 *   { data: null, error } response for every operation, so callers' non-blocking catch/error
 *   paths (e.g. ConsumptionProfileService.getIngredientProfile) can actually be exercised by tests.
 */
export function createMockSupabaseFrom(seedData = {}, options = {}) {
  const store = {}
  for (const [table, rows] of Object.entries(seedData)) {
    store[table] = rows.map((r) => ({ ...r }))
  }
  const failTables = new Set(options.failTables || [])
  const mockError = { message: 'Simulated Supabase failure', code: 'MOCK_FAILURE', details: null, hint: '' }

  function getTable(name) {
    if (!store[name]) store[name] = []
    return store[name]
  }

  function matchesFilters(row, filters) {
    return filters.every(([col, val]) => row[col] === val)
  }

  function from(tableName) {
    const filters = []
    let orderCol = null
    let orderAsc = true
    const shouldFail = failTables.has(tableName)

    const result = () => {
      let rows = getTable(tableName).filter((r) => matchesFilters(r, filters))
      if (orderCol) {
        rows = [...rows].sort((a, b) => {
          if (a[orderCol] === b[orderCol]) return 0
          const cmp = a[orderCol] > b[orderCol] ? 1 : -1
          return orderAsc ? cmp : -cmp
        })
      }
      return rows
    }

    const builder = {
      select() {
        return builder
      },
      eq(col, val) {
        filters.push([col, val])
        return builder
      },
      order(col, opts = {}) {
        orderCol = col
        orderAsc = opts.ascending !== false
        return builder
      },
      insert(row) {
        if (shouldFail) return Promise.resolve({ data: null, error: mockError })
        const table = getTable(tableName)
        const record = { id: `mock_${tableName}_${table.length}_${Math.random().toString(36).slice(2, 8)}`, ...row }
        table.push(record)
        return Promise.resolve({ data: [record], error: null })
      },
      upsert(row, opts = {}) {
        if (shouldFail) return Promise.resolve({ data: null, error: mockError })
        const table = getTable(tableName)
        const conflictCols = (opts.onConflict || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)

        const existingIdx =
          conflictCols.length > 0 ? table.findIndex((r) => conflictCols.every((c) => r[c] === row[c])) : -1

        let record
        if (existingIdx >= 0) {
          record = { ...table[existingIdx], ...row }
          table[existingIdx] = record
        } else {
          record = { id: `mock_${tableName}_${table.length}_${Math.random().toString(36).slice(2, 8)}`, ...row }
          table.push(record)
        }
        return Promise.resolve({ data: [record], error: null })
      },
      maybeSingle() {
        if (shouldFail) return Promise.resolve({ data: null, error: mockError })
        const rows = result()
        return Promise.resolve({ data: rows[0] || null, error: null })
      },
      then(onFulfilled, onRejected) {
        if (shouldFail) return Promise.resolve({ data: null, error: mockError }).then(onFulfilled, onRejected)
        return Promise.resolve({ data: result(), error: null }).then(onFulfilled, onRejected)
      },
    }

    return builder
  }

  return { from, __store: store }
}
