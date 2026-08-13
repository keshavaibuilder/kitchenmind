import { assert, assertEquals } from '@std/assert'
import { buildBlockFallback, citationsFromLedger, evaluateTrust, extractClaims, findUntracedNumbers } from '../runtime/trustModel.ts'
import type { EvidenceLedgerEntry } from '../types.ts'

function ledgerEntry(overrides: Partial<EvidenceLedgerEntry> = {}): EvidenceLedgerEntry {
  return {
    tool: 'InventoryTool',
    capabilityId: 'inventory.read',
    data: { items: [{ canonical_name: 'Rice', quantity_grams: 500 }] },
    asOf: '2026-08-09T10:00:00Z',
    source: 'inventory',
    ...overrides,
  }
}

Deno.test('PASS: a claim whose number appears in the ledger', () => {
  const ledger = [ledgerEntry()]
  const result = evaluateTrust('You have 500 grams of rice left.', ledger)
  assertEquals(result.verdict, 'PASS')
  assert(result.citations.length === 1)
})

Deno.test('REPAIR: a claim with a number that appears nowhere in the ledger', () => {
  const ledger = [ledgerEntry()]
  const result = evaluateTrust('You have 9999 grams of rice left.', ledger)
  assertEquals(result.verdict, 'REPAIR')
  assert(result.repairInstruction?.includes('9999'))
})

Deno.test('PASS: trivial numbers (0, 1) below the floor are never flagged as claims', () => {
  const ledger = [ledgerEntry()]
  const result = evaluateTrust('You have 1 item that needs attention.', ledger)
  assertEquals(result.verdict, 'PASS')
})

Deno.test('REPAIR: an empty tool result with no disclosure language in the draft', () => {
  const ledger = [ledgerEntry({ tool: 'InventoryTool', data: { items: [] } })]
  const result = evaluateTrust('You have plenty of rice in stock.', ledger)
  assertEquals(result.verdict, 'REPAIR')
})

Deno.test('PASS: an empty tool result WITH disclosure language in the draft', () => {
  const ledger = [ledgerEntry({ tool: 'InventoryTool', data: { items: [] } })]
  const result = evaluateTrust("I don't have any inventory data for that item yet.", ledger)
  assertEquals(result.verdict, 'PASS')
})

Deno.test('REPAIR: a stale prediction with no disclosure', () => {
  const ledger = [ledgerEntry({ tool: 'PredictionTool', stale: true, data: { predictions: [{ canonical_name: 'Rice', days_remaining: 4 }] } })]
  const result = evaluateTrust('Rice will run out in 4 days.', ledger)
  assertEquals(result.verdict, 'REPAIR')
})

Deno.test('PASS: a stale prediction WITH disclosure', () => {
  const ledger = [ledgerEntry({ tool: 'PredictionTool', stale: true, data: { predictions: [{ canonical_name: 'Rice', days_remaining: 4 }] } })]
  const result = evaluateTrust('Rice may run out in about 4 days, though this prediction may be outdated.', ledger)
  assertEquals(result.verdict, 'PASS')
})

Deno.test('extractClaims: floors numbers below 2, dedupes, and matches known ledger names', () => {
  const claims = extractClaims('I found 1 apple and 500 grams of Rice.', ['Rice', 'Dal'])
  assertEquals(claims.numbers, [500])
  assertEquals(claims.mentionedNames, ['Rice'])
})

Deno.test('findUntracedNumbers tolerates integer/float formatting drift', () => {
  const ledger = [ledgerEntry({ data: { value: 500.0 } })]
  const untraced = findUntracedNumbers([500], ledger)
  assertEquals(untraced, [])
})

Deno.test('citationsFromLedger produces one citation per ledger entry, deterministically', () => {
  const ledger = [ledgerEntry(), ledgerEntry({ tool: 'PredictionTool', source: 'prediction_cache', data: { predictions: [] } })]
  const citations = citationsFromLedger(ledger)
  assertEquals(citations.length, 2)
  assertEquals(citations[0].tool, 'InventoryTool')
  assertEquals(citations[1].tool, 'PredictionTool')
})

Deno.test('REPAIR: hallucinated recipe name not in evidence ledger', () => {
  const ledger = [ledgerEntry({ tool: 'RecipeTool', data: { recipes: [{ name: 'Dal Tadka' }] } })]
  const result = evaluateTrust('I recommend making Chicken Biryani for dinner.', ledger)
  assertEquals(result.verdict, 'REPAIR')
  assert(result.repairInstruction?.includes('Chicken Biryani'))
})

Deno.test('PASS: grounded recipe name in evidence ledger', () => {
  const ledger = [ledgerEntry({ tool: 'RecipeTool', data: { recipes: [{ name: 'Dal Tadka' }] } })]
  const result = evaluateTrust('I recommend making Dal Tadka for dinner.', ledger)
  assertEquals(result.verdict, 'PASS')
})

Deno.test('REPAIR: hallucinated ingredient not in evidence ledger', () => {
  const ledger = [ledgerEntry({ tool: 'RecipeTool', data: { recipes: [{ name: 'Dal Tadka', ingredients: ['Lentils', 'Turmeric'] }] } })]
  const result = evaluateTrust('Add Saffron and Truffle Oil to your Dal Tadka.', ledger)
  assertEquals(result.verdict, 'REPAIR')
  assert(result.repairInstruction?.includes('Saffron'))
})

Deno.test('REPAIR: fabricated pantry item not in inventory ledger', () => {
  const ledger = [ledgerEntry({ tool: 'InventoryTool', data: { items: [{ canonical_name: 'Rice' }] } })]
  const result = evaluateTrust('Your pantry currently contains Quinoa and Olive Oil.', ledger)
  assertEquals(result.verdict, 'REPAIR')
  assert(result.repairInstruction?.includes('Quinoa'))
})

Deno.test('REPAIR: unsupported shopping suggestion not in planning/prediction ledger', () => {
  const ledger = [ledgerEntry({ tool: 'ShoppingTool', data: { suggestions: [{ canonicalName: 'Onions', reason: 'low stock' }] } })]
  const result = evaluateTrust('You should buy Almond Milk and Avocado tomorrow.', ledger)
  assertEquals(result.verdict, 'REPAIR')
  assert(result.repairInstruction?.includes('Almond Milk'))
})

Deno.test('REPAIR: invalid prediction reference not in prediction cache ledger', () => {
  const ledger = [ledgerEntry({ tool: 'PredictionTool', data: { predictions: [{ canonical_name: 'Rice', days_remaining: 5 }] } })]
  const result = evaluateTrust('Your Butter Chicken will run out soon.', ledger)
  assertEquals(result.verdict, 'REPAIR')
  assert(result.repairInstruction?.includes('Butter Chicken'))
})

Deno.test('REPAIR: missing/empty evidence with ungrounded assertion', () => {
  const ledger: EvidenceLedgerEntry[] = []
  const result = evaluateTrust('You have plenty of Pasta and Cheese.', ledger)
  assertEquals(result.verdict, 'REPAIR')
})

Deno.test('PASS: empty evidence WITH explicit uncertainty disclosure', () => {
  const ledger: EvidenceLedgerEntry[] = []
  const result = evaluateTrust("I don't have any inventory or recipe data available for that.", ledger)
  assertEquals(result.verdict, 'PASS')
})

Deno.test('REPAIR: partial evidence where one tool failed', () => {
  const ledger = [ledgerEntry({ tool: 'InventoryTool', data: { items: [{ canonical_name: 'Rice' }] } })]
  const failedTools = ['RecipeTool']
  const result = evaluateTrust('You have Rice in stock.', ledger, failedTools)
  assertEquals(result.verdict, 'REPAIR')
  assert(result.repairInstruction?.includes('failed'))
})

Deno.test('PASS: partial evidence WITH disclosure of failed tool', () => {
  const ledger = [ledgerEntry({ tool: 'InventoryTool', data: { items: [{ canonical_name: 'Rice' }] } })]
  const failedTools = ['RecipeTool']
  const result = evaluateTrust("You have Rice in stock, but I don't have recipe data because that search failed.", ledger, failedTools)
  assertEquals(result.verdict, 'PASS')
})

Deno.test('BLOCK: buildBlockFallback produces safe fallback text', () => {
  const blocked = buildBlockFallback()
  assertEquals(blocked.verdict, 'BLOCK')
  assert(blocked.fallbackText?.includes("wasn't able to put together a fully grounded answer"))
})
