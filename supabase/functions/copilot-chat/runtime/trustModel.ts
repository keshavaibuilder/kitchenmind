// AI Trust Model (§1.9) — the mandatory, blocking grounding & validation gate every draft answer
// must pass before it reaches the user. Five stages, exactly as frozen in the design doc.
//
// IMPORTANT — this is a heuristic implementation, not an NLI/entailment model: claim extraction
// is regex-based (standalone numbers + known canonical-name substring matches) and matching is a
// literal-value lookup against the turn's Evidence Ledger. This catches the failure mode the
// design doc is actually worried about — an LLM stating a number or entity that no tool result
// supports — but it is deliberately conservative rather than a rigorous fact-checker: it can
// under-flag claims phrased without a literal number ("about a week" from days_remaining=7) and,
// rarely, over-flag a coincidental number. Both failure directions are logged via the Trust
// verdict telemetry (§9.2 "Trust verdict distribution") so drift is visible, not silent.
import type { Citation, EvidenceLedgerEntry, TrustModelResult, TrustVerdict } from '../types.ts'

// ── Stage 1: Evidence Ledger ────────────────────────────────────────────────
export function buildEvidenceLedger(
  toolResults: Array<{ tool: string; capabilityId: string; result: { ok: boolean; data?: unknown; asOf: string; source: string; stale?: boolean } }>
): EvidenceLedgerEntry[] {
  return toolResults
    .filter((t) => t.result.ok)
    .map((t) => ({
      tool: t.tool,
      capabilityId: t.capabilityId,
      data: t.result.data,
      asOf: t.result.asOf,
      source: t.result.source,
      stale: t.result.stale,
    }))
}

// ── Stage 2: Claim Extraction ────────────────────────────────────────────────
export interface ExtractedClaims {
  numbers: number[]
  mentionedNames: string[]
}

const DISCLOSURE_KEYWORDS = [
  "don't have", 'do not have', "haven't", 'have not', 'no data', 'not available',
  'not populated', "isn't tracked", 'is not tracked', 'not tracked', "can't tell", 'cannot tell',
  'unknown', 'not yet', "doesn't have", 'does not have', 'may be outdated', 'stale', 'not up to date',
  "hasn't been", 'has not been', 'no record', 'not sure',
]

/** Standalone numeric tokens only (word-boundary), floor of 2 to avoid flagging trivial "a/1"
 * false positives — see module header for the documented precision/recall tradeoff. */
export function extractClaims(draftText: string, knownNames: string[] = []): ExtractedClaims {
  const numberMatches = draftText.match(/\b\d+(\.\d+)?\b/g) ?? []
  const numbers = [...new Set(numberMatches.map(Number).filter((n) => n >= 2))]

  const lowerDraft = draftText.toLowerCase()
  const mentionedNames = knownNames.filter((name) => name && lowerDraft.includes(name.toLowerCase()))

  return { numbers, mentionedNames }
}

function collectLedgerNumbers(ledger: EvidenceLedgerEntry[]): Set<number> {
  const nums = new Set<number>()
  const walk = (val: unknown) => {
    if (typeof val === 'number') nums.add(val)
    else if (typeof val === 'string' && /^\d+(\.\d+)?$/.test(val)) nums.add(Number(val))
    else if (Array.isArray(val)) val.forEach(walk)
    else if (val && typeof val === 'object') Object.values(val).forEach(walk)
  }
  for (const entry of ledger) walk(entry.data)
  return nums
}

export function collectLedgerNames(ledger: EvidenceLedgerEntry[]): string[] {
  const names = new Set<string>()
  const walk = (val: unknown, key?: string) => {
    if (typeof val === 'string') {
      const trimmed = val.trim()
      if (trimmed.length >= 2) {
        if (!key || /name|title|type|category|item|recipe|reason|day|source/i.test(key)) {
          names.add(trimmed)
        }
      }
    } else if (Array.isArray(val)) {
      val.forEach((v) => walk(v, key))
    } else if (val && typeof val === 'object') {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        walk(v, k)
      }
    }
  }
  for (const entry of ledger) walk(entry.data)
  return Array.from(names)
}

// ── Stage 3: Claim-to-Evidence Matching ─────────────────────────────────────
export function findUntracedNumbers(claimedNumbers: number[], ledger: EvidenceLedgerEntry[]): number[] {
  const ledgerNumbers = collectLedgerNumbers(ledger)
  // Tolerate integer/float formatting drift (e.g. LLM writes "500" for a stored 500.0).
  return claimedNumbers.filter((n) => !ledgerNumbers.has(n) && !ledgerNumbers.has(Math.round(n)))
}

/** Stage 3b: Validates that any mentioned entity/recipe/ingredient/pantry/planner/shopping/observation claim
 * is grounded in the Evidence Ledger or explicitly disclosed as unknown/absent. */
export function findUntracedEntities(draftText: string, ledger: EvidenceLedgerEntry[]): string[] {
  if (draftHasDisclosure(draftText)) return []

  const ledgerNames = collectLedgerNames(ledger)
  const lowerLedgerNames = ledgerNames.map((n) => n.toLowerCase())

  // Extract candidate multi-word or single-word proper/entity assertions from draft text
  // e.g. Recipe names ("Chicken Biryani"), Ingredients ("Saffron"), Pantry Items, Recommendations
  const untraced: string[] = []

  // 1. Check capitalized entity phrases in draft (e.g., "Chicken Tikka", "Dal Tadka", "Spaghetti Carbonara")
  const capitalizedPhrases = draftText.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) ?? []
  for (const phrase of [...new Set(capitalizedPhrases)]) {
    // Ignore common english words at start of sentence if single-word
    const lowerPhrase = phrase.toLowerCase()
    if (['I', 'You', 'The', 'A', 'An', 'If', 'This', 'That', 'These', 'Those', 'Our', 'Your', 'My', 'We', 'What', 'When', 'Where', 'Why', 'How', 'Note', 'Also', 'Here', 'There', 'Today', 'Tonight', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].includes(phrase)) {
      continue
    }

    const matchesLedger = lowerLedgerNames.some(
      (lname) => lname.includes(lowerPhrase) || lowerPhrase.includes(lname)
    )
    if (!matchesLedger) {
      untraced.push(phrase)
    }
  }

  return [...new Set(untraced)]
}

// ── Stage 4: Disclosure Enforcement ─────────────────────────────────────────
function ledgerHasUndisclosedGap(ledger: EvidenceLedgerEntry[], failedTools: string[] = []): boolean {
  if (failedTools.length > 0) return true

  return ledger.some((entry) => {
    if (entry.stale) return true
    const data = entry.data as Record<string, unknown> | undefined
    if (!data) return false
    // Every tool's array field is empty -> "no data" state (§2.9 InventoryTool.getExpiringBatches
    // being permanently [] is the canonical example this stage exists for).
    const arrayFields = Object.values(data).filter(Array.isArray)
    return arrayFields.length > 0 && arrayFields.every((arr) => (arr as unknown[]).length === 0)
  })
}

function draftHasDisclosure(draftText: string): boolean {
  const lower = draftText.toLowerCase()
  return DISCLOSURE_KEYWORDS.some((kw) => lower.includes(kw))
}

// ── Stage 5: Citation Attachment ────────────────────────────────────────────
export function citationsFromLedger(ledger: EvidenceLedgerEntry[]): Citation[] {
  return ledger.map((entry) => ({
    tool: entry.tool,
    source: entry.source,
    asOf: entry.asOf,
    summary: summarizeForCitation(entry),
  }))
}

function summarizeForCitation(entry: EvidenceLedgerEntry): string {
  const data = entry.data as Record<string, unknown> | undefined
  if (!data) return `${entry.tool} (${entry.source})`
  const firstArrayKey = Object.keys(data).find((k) => Array.isArray(data[k]))
  if (firstArrayKey) {
    const arr = data[firstArrayKey] as unknown[]
    return `${entry.tool}: ${arr.length} ${firstArrayKey}${entry.stale ? ' (stale)' : ''}`
  }
  return `${entry.tool} (${entry.source})${entry.stale ? ' — stale' : ''}`
}

// ── Orchestration entry point ───────────────────────────────────────────────
export function evaluateTrust(
  draftText: string,
  ledger: EvidenceLedgerEntry[],
  failedTools: string[] = []
): TrustModelResult {
  const knownNames = collectLedgerNames(ledger)
  const claims = extractClaims(draftText, knownNames)
  const untracedNumbers = findUntracedNumbers(claims.numbers, ledger)
  const untracedEntities = findUntracedEntities(draftText, ledger)

  if (untracedNumbers.length > 0) {
    return {
      verdict: 'REPAIR',
      citations: [],
      repairInstruction:
        `Your answer states ${untracedNumbers.join(', ')} which do${untracedNumbers.length === 1 ? 'es' : ''} not ` +
        `appear in any tool result from this turn. Cite only numbers returned by your tools, or remove the claim ` +
        `and say you don't have that information.`,
    }
  }

  if (untracedEntities.length > 0) {
    return {
      verdict: 'REPAIR',
      citations: [],
      repairInstruction:
        `Your answer mentions entity/recipe/item claim(s) "${untracedEntities.join(', ')}" which do not appear ` +
        `in any tool result from this turn. Cite only items, recipes, and facts returned by your tools, or explicitly ` +
        `disclose that you don't have this data.`,
    }
  }

  if (ledgerHasUndisclosedGap(ledger, failedTools) && !draftHasDisclosure(draftText)) {
    return {
      verdict: 'REPAIR',
      citations: [],
      repairInstruction:
        'One or more tools returned no data, failed, or returned stale values, but your answer does not disclose this. ' +
        'Add an explicit caveat (e.g. "I don\'t have that data yet") rather than presenting the answer as complete.',
    }
  }

  return { verdict: 'PASS', citations: citationsFromLedger(ledger) }
}

/** Called only when a REPAIR attempt has already been used (config.trustModelMaxRepairAttempts)
 * and the re-evaluated draft still fails — §1.9 "BLOCK: repair still fails ... discarded and
 * replaced with a safe, generic disclosure; logged as a hard failure, not silently swallowed." */
export function buildBlockFallback(): TrustModelResult {
  return {
    verdict: 'BLOCK',
    citations: [],
    fallbackText:
      "I wasn't able to put together a fully grounded answer to that from your kitchen data just now. " +
      'Could you try rephrasing, or check the Dashboard/Planner directly for this?',
  }
}

export type { TrustVerdict }
