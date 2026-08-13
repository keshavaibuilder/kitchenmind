// Minimal in-memory `.from()` mock for Deno tests — same purpose and shape as
// src/services/__tests__/mockSupabaseTable.js (the browser test suite's equivalent), reimplemented
// here rather than imported because that file's tests are wired into vitest's Node/jsdom
// environment, not Deno's test runner. Per this repo's established testing gotcha (mock
// supabaseClient.from(), not just .rpc(), or a test can silently try a real network call) this
// mock always intercepts .from() — nothing here ever reaches a real host.
type MockRow = Record<string, unknown>

interface MockQueryBuilder {
  select(): MockQueryBuilder
  eq(col: string, val: unknown): MockQueryBuilder
  not(): MockQueryBuilder
  lte(): MockQueryBuilder
  gte(): MockQueryBuilder
  ilike(col: string, pattern: string): MockQueryBuilder
  order(col: string, opts?: { ascending?: boolean }): MockQueryBuilder
  limit(n: number): MockQueryBuilder
  range(): MockQueryBuilder
  insert(rows: MockRow | MockRow[]): MockQueryBuilder
  update(patch: MockRow): MockQueryBuilder
  maybeSingle(): Promise<{ data: MockRow | null; error: unknown }>
  single(): Promise<{ data: MockRow | null; error: unknown }>
  then<T>(onFulfilled: (v: { data: MockRow[] | null; error: unknown }) => T, onRejected?: (e: unknown) => T): Promise<T>
}

export function createMockSupabaseFrom(seedData: Record<string, MockRow[]> = {}, options: { failTables?: string[] } = {}) {
  const store: Record<string, MockRow[]> = {}
  for (const [table, rows] of Object.entries(seedData)) store[table] = rows.map((r) => ({ ...r }))
  const failTables = new Set(options.failTables ?? [])
  const mockError = { message: 'Simulated Supabase failure', code: 'MOCK_FAILURE', details: null, hint: '' }

  function getTable(name: string) {
    if (!store[name]) store[name] = []
    return store[name]
  }

  // Monotonically increasing so `.order('created_at', ...)` can distinguish insertion order —
  // real Postgres's `DEFAULT now()` timestamps are similarly (if not perfectly) monotonic across
  // sequential inserts within one request.
  let insertCounter = 0

  function matchesFilters(row: MockRow, filters: [string, unknown][]) {
    return filters.every(([col, val]) => row[col] === val)
  }

  function from(tableName: string): MockQueryBuilder {
    const filters: [string, unknown][] = []
    let orderCol: string | null = null
    let orderAsc = true
    let limitN: number | null = null
    let pendingInsertRows: MockRow[] | null = null
    let pendingUpdate: MockRow | null = null
    const shouldFail = failTables.has(tableName)

    function makeRecord(row: MockRow): MockRow {
      const record: MockRow = {
        id: `mock_${tableName}_${getTable(tableName).length}_${Math.random().toString(36).slice(2, 8)}`,
      }
      if (!('created_at' in row)) record.created_at = new Date(Date.now() + insertCounter++).toISOString()
      return { ...record, ...row }
    }

    function queryResult(): MockRow[] {
      let rows = getTable(tableName).filter((r) => matchesFilters(r, filters))
      if (orderCol) {
        const col = orderCol
        rows = [...rows].sort((a, b) => {
          if (a[col] === b[col]) return 0
          const av = a[col] as string | number
          const bv = b[col] as string | number
          const cmp = av > bv ? 1 : -1
          return orderAsc ? cmp : -cmp
        })
      }
      if (limitN != null) rows = rows.slice(0, limitN)
      return rows
    }

    function execute(): { data: MockRow[] | null; error: unknown } {
      if (shouldFail) return { data: null, error: mockError }
      if (pendingInsertRows) {
        const table = getTable(tableName)
        const inserted = pendingInsertRows.map((r) => {
          const rec = makeRecord(r)
          table.push(rec)
          return rec
        })
        return { data: inserted, error: null }
      }
      if (pendingUpdate) {
        const update = pendingUpdate
        const table = getTable(tableName)
        const matching = table.filter((r) => matchesFilters(r, filters))
        for (const row of matching) Object.assign(row, update)
        return { data: matching, error: null }
      }
      return { data: queryResult(), error: null }
    }

    const builder: MockQueryBuilder = {
      select() { return builder },
      eq(col, val) { filters.push([col, val]); return builder },
      not() { return builder },
      lte() { return builder },
      gte() { return builder },
      ilike(col, pattern) {
        filters.push([col, pattern.replace(/%/g, '').toLowerCase()])
        return builder
      },
      order(col, opts = {}) { orderCol = col; orderAsc = opts.ascending !== false; return builder },
      limit(n) { limitN = n; return builder },
      range() { return builder },
      insert(rows) { pendingInsertRows = Array.isArray(rows) ? rows : [rows]; return builder },
      update(patch) { pendingUpdate = patch; return builder },
      maybeSingle() {
        const { data, error } = execute()
        return Promise.resolve({ data: (data && data[0]) || null, error })
      },
      single() {
        const { data, error } = execute()
        return Promise.resolve({ data: (data && data[0]) || null, error })
      },
      then(onFulfilled, onRejected) {
        return Promise.resolve(execute()).then(onFulfilled, onRejected)
      },
    }
    return builder
  }

  return { from, __store: store }
}
