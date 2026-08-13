-- KitchenMind — Migration 0010: AI Copilot conversation store (Sprint 6B)
--
-- Implements the "Conversation Store" persistence named in the frozen Sprint 6A design
-- (docs/21_AI_COPILOT_ARCHITECTURE_AND_DESIGN.md §5.1, roadmap row for Sprint 6B). Three tables,
-- household-isolated the same way every other tenant table in this schema is: RLS keyed on
-- auth_household_id() (0001), no application-level filtering required.
--
--   copilot_conversations — one row per chat thread.
--   copilot_messages      — one row per turn (user or assistant), household_id denormalized
--                            directly onto the row (not just reachable via conversation_id) so
--                            RLS and the chat UI's per-household message queries don't need a
--                            join, matching the precedent set for bill_items/stock_deductions.
--   copilot_tool_calls    — the tool execution log ("no household data duplication" — Sprint 6B
--                            brief's Conversation Store note). Read-only run trace: capability_id,
--                            input/output envelopes, timing, status. Isolated indirectly via
--                            message_id -> copilot_messages.household_id, the same "join through
--                            parent" pattern stock_deductions originally used (0001).
--
-- Nothing here stores raw LLM provider request/response payloads or bill images/OCR text — only
-- the conversation transcript and tool-call envelopes needed for the citation UI (Sprint 6C) and
-- evaluation harness (design doc §9), per the Trust Model's Evidence Ledger (§1.9) and the
-- Memory Model's privacy boundaries (§5.4).

CREATE TABLE IF NOT EXISTS public.copilot_conversations (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id  uuid NOT NULL REFERENCES public.household(id) ON DELETE CASCADE,
  summary       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS copilot_conversations_household_updated_idx
  ON public.copilot_conversations(household_id, updated_at DESC);

ALTER TABLE public.copilot_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "copilot_conversations: household isolation" ON public.copilot_conversations;
CREATE POLICY "copilot_conversations: household isolation"
  ON public.copilot_conversations FOR ALL
  USING (household_id = auth_household_id())
  WITH CHECK (household_id = auth_household_id());

CREATE TABLE IF NOT EXISTS public.copilot_messages (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id  uuid NOT NULL REFERENCES public.copilot_conversations(id) ON DELETE CASCADE,
  household_id     uuid NOT NULL REFERENCES public.household(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('user', 'assistant')),
  content          text NOT NULL,
  trust_verdict    text CHECK (trust_verdict IN ('pass', 'repair', 'block')),
  citations        jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS copilot_messages_conversation_created_idx
  ON public.copilot_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS copilot_messages_household_created_idx
  ON public.copilot_messages(household_id, created_at DESC);

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "copilot_messages: household isolation" ON public.copilot_messages;
CREATE POLICY "copilot_messages: household isolation"
  ON public.copilot_messages FOR ALL
  USING (household_id = auth_household_id())
  WITH CHECK (household_id = auth_household_id());

CREATE TABLE IF NOT EXISTS public.copilot_tool_calls (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id          uuid NOT NULL REFERENCES public.copilot_messages(id) ON DELETE CASCADE,
  capability_id       text NOT NULL,
  tool_name           text NOT NULL,
  capability_version  text NOT NULL DEFAULT '1.0.0',
  input               jsonb NOT NULL DEFAULT '{}'::jsonb,
  output              jsonb,
  as_of               timestamptz,
  duration_ms         integer,
  status              text NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS copilot_tool_calls_message_id_idx
  ON public.copilot_tool_calls(message_id);

ALTER TABLE public.copilot_tool_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "copilot_tool_calls: same household via message" ON public.copilot_tool_calls;
CREATE POLICY "copilot_tool_calls: same household via message"
  ON public.copilot_tool_calls FOR ALL
  USING (
    message_id IN (
      SELECT id FROM public.copilot_messages WHERE household_id = auth_household_id()
    )
  )
  WITH CHECK (
    message_id IN (
      SELECT id FROM public.copilot_messages WHERE household_id = auth_household_id()
    )
  );
