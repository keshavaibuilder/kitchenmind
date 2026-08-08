-- KitchenMind — Migration 0008: AI Observation Timeline persistence
--
-- Discovered defect: AIObservationService.generateObservations() has produced observation
-- objects since Phase 3H, but recordPostCommitObservations() only ever logged them
-- (logger.info) and returned them to the caller — nothing was ever written to the database.
-- There was no table to write to. The Kitchen Intelligence Dashboard's "AI Observation
-- Timeline" module needs real history, so this adds one. Append-only, same pattern as
-- purchase_patterns (0005) — observations are an immutable event log, never updated in place.

CREATE TABLE IF NOT EXISTS public.ai_observations (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id      uuid NOT NULL REFERENCES public.household(id) ON DELETE CASCADE,
  observation_type  text NOT NULL,
  canonical_name    text,
  details           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_observations_household_created_idx ON public.ai_observations(household_id, created_at DESC);

ALTER TABLE public.ai_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_observations: household isolation" ON public.ai_observations;
CREATE POLICY "ai_observations: household isolation"
  ON public.ai_observations FOR ALL
  USING (household_id = auth_household_id());
