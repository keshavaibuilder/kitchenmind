# KitchenMind: Production Deployment Remediation — Authoritative Project Investigation

**Document Version:** 1.0.0
**Domain:** Production Infrastructure Remediation, Supabase Project Reconciliation
**Certified Release Under Remediation:** KitchenMind v0.5.0 (`v0.5.0-kitchen-intelligence`, commit `8874dd163ab92d785fc66882795c08d623408e0d`)
**Status:** **PRODUCTION HOLD — BLOCKED ON AUTHORITATIVE PROJECT DECISION**

---

## 1. Scope of This Remediation Pass

Following `docs/36_PRODUCTION_HYPERCARE_REPORT.md`'s **HYPERCARE FAILED — PRODUCTION HOLD** classification, this pass was directed to first establish the single authoritative Supabase production project (P0-1/P0-2) before any deployment is attempted, using project metadata, schema inspection, migrations, and RPC evidence — not a guess.

No application code, business logic, or architecture was modified. No migration was run against any project. No deployment was performed. Only read-only investigation was executed, per explicit instruction to stop before acting if the correct project cannot be established with certainty.

**Result: it cannot be established with certainty from this environment alone.** The evidence is reported in full below, and this document ends in a specific question back to the user rather than a unilateral choice, per the governing brief's own rule: *"If the correct production project cannot be established with certainty: STOP and report the evidence."*

---

## 2. The Two Candidate Projects

| | `jrfuyjemopkbntvaziab` (referenced by `.env`) | `pgwemjswxdlnshrfoggj` ("poonamkarn's Project") |
|---|---|---|
| Created | Unknown (not visible from this session) | 2026-07-24 |
| Owning org (this CLI session) | **Not a member of `poonamkarn's Org`** — not returned by `supabase projects list` at all | `poonamkarn's Org` (`fcqcqbioymjzipdskhnx`) |
| Reachable how | Public REST API only, via the anon/publishable key already in `.env` (RLS-gated, read-only) | Full Supabase CLI admin access (linked, authenticated) |
| Status | Unknown (no admin API access) | `ACTIVE_HEALTHY` (confirmed via `supabase projects list`) |

---

## 3. Evidence Gathered (Read-Only, No Mutations)

### 3.1 `pgwemjswxdlnshrfoggj` — via authenticated `supabase` CLI

`supabase link --project-ref pgwemjswxdlnshrfoggj && supabase migration list --linked`:

```
{"migrations":[
  {"local":"0001","remote":"","time":"0001"}, {"local":"0002","remote":"","time":"0002"},
  {"local":"0003","remote":"","time":"0003"}, {"local":"0004","remote":"","time":"0004"},
  {"local":"0005","remote":"","time":"0005"}, {"local":"0006","remote":"","time":"0006"},
  {"local":"0007","remote":"","time":"0007"}, {"local":"0008","remote":"","time":"0008"},
  {"local":"0009","remote":"","time":"0009"}, {"local":"0010","remote":"","time":"0010"},
  {"local":"0011","remote":"","time":"0011"}
]}
```

Every `remote` field is empty. **Zero of the 11 local migrations have ever been applied to this project's database.** It is a fully empty schema. The only thing actually deployed here is the `copilot-chat` Edge Function (independently reproduced in the prior hypercare report: unauthenticated POST → real `401`). A live Edge Function with no backing schema means every tool call it makes (inventory lookups, recipe lookups, etc.) would fail against this project.

### 3.2 `jrfuyjemopkbntvaziab` — via public REST API (anon key from `.env`, read-only, RLS-gated)

This project is **not owned by the authenticated CLI session's org** — `supabase projects list` (live API call) returns exactly two projects (`Psychometric`, INACTIVE, and `pgwemjswxdlnshrfoggj`, ACTIVE_HEALTHY) and `jrfuyjemopkbntvaziab` is not one of them. There is no DB password, no service-role key, and no CLI link available for it in this environment — it cannot be administered from here. Existence/schema was probed the only way available: unauthenticated `GET` requests against `/rest/v1/<table>` using the anon key already present in `.env`. A `200` (even with an empty `[]` body, expected under RLS for an anon caller) proves the table exists; a PostgREST `404 PGRST205` proves it does not.

| Table | Migration it comes from | Result |
|---|---|---|
| `household` | 0001 | `200` — exists |
| `inventory` | 0001 | `200` — exists |
| `inventory_batches` | 0001 | `200` — exists |
| `recipes` | 0001 | `200` — exists |
| `meal_log` | 0001 | `200` — exists |
| `custom_items` | 0002 | `200` — exists |
| `stock_deductions` | 0001 | `200` — exists |
| `ai_observations` | 0008 | `200` — exists |
| `ingredient_consumption_profile` | 0005 | `404 PGRST205` — **missing** |
| `purchase_patterns` | 0005 | `404 PGRST205` — **missing** |
| `prediction_cache` | 0005 | `404 PGRST205` — **missing** |
| `household_learning_profile` | 0005 | `404 PGRST205` — **missing** |
| `copilot_conversations` | 0010 | `404 PGRST205` — **missing** |
| `copilot_messages` | 0010 | `404 PGRST205` — **missing** |
| `copilot_tool_calls` | 0010 | `404 PGRST205` — **missing** |
| `copilot_memory` | 0011 | `404 PGRST205` — **missing** |

This project has a real, populated-looking base schema (household/inventory/recipes/meal_log — the actual application's core tables) but is missing **all four tables from migration `0005`** while having the table from migration `0008`, which is not consistent with migrations having been applied in the normal sequential order via this repo's migration files. It is also missing both Copilot-era migrations (`0010`, `0011`) entirely, so it has no Copilot backend, and the `copilot-chat` Edge Function is not deployed to it either (prior report: direct `curl` to its `functions/v1/copilot-chat` timed out).

RPC existence (`mark_meal_cooked`, `commit_scanned_bill`, etc.) was **not tested** on either project — PostgREST executes RPCs as real calls, and several of this codebase's RPCs are mutating; probing them anonymously to check existence was judged unsafe without service-role access, so this is reported as an open unknown rather than guessed at.

### 3.3 Source/deployment branch state (re-verified this pass)

```
git rev-parse HEAD        → 787e39c7f65026f2a0ab861bdb01d1622f70f4ec
git ls-remote origin main → 7683250bf30f0180dd86768a7e76ef89ab953327
```

`origin/main` is still 5 commits behind local `HEAD`. The certified commit `8874dd1` and everything after it (including this and the prior remediation/hypercare docs) exist only in this local working copy. **No push has been made.** `.env` is correctly listed in `.gitignore` and has never been committed, so its project reference has never varied across commits — whatever `jrfuyjemopkbntvaziab` is, it has been the app's target since before this investigation began, not something introduced by a stray edit.

---

## 4. Why This Cannot Be Resolved Without a Decision

Both candidates fail a straightforward "pick the complete one" test — **neither has the full `v0.5.0` migration set (`0001`–`0011`) applied**:

- `pgwemjswxdlnshrfoggj`: fully administrable, but **zero migrations applied** — an empty shell that only received the Edge Function push. Nothing suggests it was a deliberate choice rather than whatever project the CLI happened to be linked to when a prior session ran `supabase functions deploy`.
- `jrfuyjemopkbntvaziab`: has the real, long-lived application schema the shipped frontend has always pointed at (strong signal of being the actual dev/production database used throughout this project's history), but is **missing migration `0005`'s tables and both Copilot migrations (`0010`/`0011`)**, and **this session has no credentials to administer it at all** — it belongs to an account/org this authenticated Supabase CLI session is not a member of.

The governing brief explicitly forbids resolving this by default rule ("do not choose `pgwemjswxdlnshrfoggj` merely because the Edge Function exists there," "do not choose `jrfuyjemopkbntvaziab` merely because `.env` references it") and requires a STOP when project ownership is ambiguous. It is ambiguous here in a very concrete way: **the project with real application history is not accessible from this environment, and the project that is accessible has no application history.**

---

## 5. What Is Needed to Proceed

One of the following, from the user:

1. **Access to whatever account owns `jrfuyjemopkbntvaziab`** (its dashboard login, or a `supabase login` token for that account), so its exact migration state and RPCs can be fully inspected and — if it's confirmed as the intended production project — the missing migrations (`0005`'s tables, `0010`, `0011`) and the `copilot-chat` Edge Function can be deployed to *it* instead of `pgwemjswxdlnshrfoggj`; **or**
2. **An explicit decision to designate `pgwemjswxdlnshrfoggj` as the new authoritative production project**, with the understanding that this means starting from a schema with no pre-existing application data, running all 11 migrations fresh against it, and repointing `.env` (`VITE_SUPABASE_URL` and the anon key) to it — a materially different, higher-blast-radius action than "redeploying to the existing database," which is why it is not being assumed by default.

No further deployment action (migrations, Edge Function redeploy, frontend deploy, or `.env` changes) will be taken until this is resolved, per the brief's explicit "do not blindly run migrations" / "do not guess" / "STOP and report the exact blocker" rules.

---

## 6. Final Classification

> ### PRODUCTION HOLD
>
> Blocked on a decision only the user can make: which Supabase project is the authoritative production target, and (if `jrfuyjemopkbntvaziab`) whether access to its owning account can be provided. Nothing was deployed, migrated, or reconfigured this pass.

---

**Prepared by:** Claude (production deployment remediation session)
**Date:** 2026-08-13
