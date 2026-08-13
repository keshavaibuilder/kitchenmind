-- KitchenMind — Migration 0011: AI Copilot Long-Term Memory (Sprint 6E)
--
-- Implements explicit, user-controlled Copilot Memory persistence (§5.4, Sprint 6E).
-- Explicitly distinct from:
--   1. Andaaza Learning (inferred purchase patterns, consumption velocity, prediction cache)
--   2. Structured Household Preferences (app settings: non-veg days, excluded items)
--   3. Session & Conversation History (copilot_conversations, copilot_messages)
--
-- Household-isolated via RLS keyed on auth_household_id() (0001).

CREATE TABLE IF NOT EXISTS public.copilot_memory (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id  uuid NOT NULL REFERENCES public.household(id) ON DELETE CASCADE,
  memory_type   text NOT NULL CHECK (memory_type IN ('preference', 'restriction', 'habit', 'instruction', 'context')),
  memory_key    text NOT NULL,
  memory_value  text NOT NULL,
  source        text NOT NULL DEFAULT 'user_explicit' CHECK (source IN ('user_explicit', 'ui_setting')),
  confidence    numeric NOT NULL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'expired', 'deleted')),
  expires_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS copilot_memory_household_status_idx
  ON public.copilot_memory(household_id, status, updated_at DESC);

ALTER TABLE public.copilot_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "copilot_memory: household isolation" ON public.copilot_memory;
CREATE POLICY "copilot_memory: household isolation"
  ON public.copilot_memory FOR ALL
  USING (household_id = auth_household_id())
  WITH CHECK (household_id = auth_household_id());
