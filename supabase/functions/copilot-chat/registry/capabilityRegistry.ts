// Capability Registry runtime (§3.1) — the abstraction layer between the LLM orchestrator and
// the concrete Tool implementations. The orchestrator never talks to a hardcoded tool list; it
// asks this module.
import type { CapabilityEntry, ProviderToolSpec } from '../types.ts'
import { REGISTRY_ROWS, toProviderToolSpec } from './capabilities.ts'

export class CapabilityRegistry {
  #byId = new Map<string, CapabilityEntry>()

  constructor() {
    for (const row of REGISTRY_ROWS) {
      this.#byId.set(row.entry.capability_id, row.entry)
    }
  }

  /** Enabled, non-deprecated capabilities — what's actually offered to the orchestrator this
   * sprint. Sprint 6B: read-only, since no capability is both enabled and access_class 'write'. */
  listEnabled(): CapabilityEntry[] {
    return REGISTRY_ROWS
      .map((r) => r.entry)
      .filter((e) => e.enabled && !e.deprecated_at)
  }

  /** All registered capabilities, including disabled/write ones — for admin/audit tooling and
   * tests, never for orchestrator discovery (use listEnabled for that). */
  listAll(): CapabilityEntry[] {
    return REGISTRY_ROWS.map((r) => r.entry)
  }

  resolve(capabilityId: string): CapabilityEntry | undefined {
    return this.#byId.get(capabilityId)
  }

  /** Mechanically decides whether a capability requires the confirmation flow (§6.3/§6.4) —
   * a registry-level fact, never left to prompt-level convention. */
  requiresConfirmation(capabilityId: string): boolean {
    const entry = this.resolve(capabilityId)
    return entry?.access_class === 'write'
  }

  /** True only for a capability that is both registered AND enabled for this sprint's runtime —
   * the check every invocation path must pass before a tool executes (§6.3 "read-only runtime,
   * write capabilities rejected"). */
  isInvocable(capabilityId: string): boolean {
    const entry = this.resolve(capabilityId)
    return Boolean(entry && entry.enabled && !entry.deprecated_at)
  }

  /** Deterministic projection into the system prompt's tool catalogue block (§4.1 block 2,
   * §4.3) — never hand-maintained prompt text; always a function of this registry's current
   * enabled set, so it's also byte-identical (and therefore prompt-cacheable, §7.4) across every
   * request until the registry itself changes. */
  toProviderToolSpecs(): ProviderToolSpec[] {
    return REGISTRY_ROWS
      .filter((r) => r.entry.enabled && !r.entry.deprecated_at)
      .map(toProviderToolSpec)
  }
}

// Singleton for the life of the Edge Function isolate — the registry is static config, not
// per-request state, so one instance per cold start is correct and avoids re-validating the
// household-scope invariant (registry/capabilities.ts) on every request.
export const capabilityRegistry = new CapabilityRegistry()
