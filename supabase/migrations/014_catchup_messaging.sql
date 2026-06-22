-- ══════════════════════════════════════════════════════════════════════════════
--  InkDesk — Migration 014: Catch-up / sync messaging objects
--
--  Fully IDEMPOTENT, same pattern as 012_catch_up_missing_objects.sql. Safe to
--  run on a database where 010_tier3_messaging.sql and/or
--  013_fix_messaging_rls.sql were never applied (symptoms: the dashboard
--  Messages tab shows nothing / errors, "Failed to start conversation" or
--  "Failed to load conversations" toasts — PostgREST can't find the
--  'conversations' or 'messages' tables, or auto-generated REST queries
--  against them fail).
--
--  Re-creates only what may be missing, then converges the RLS policies on
--  `conversations` / `messages` to their final correct state regardless of
--  which (if any) of 010 / 013 already ran:
--    • public.conversations + public.messages   (from 010)
--    • artists_own_conversations / conversation_participants_messages
--      policies, scoped to auth.uid() (from 010, re-asserted here)
--    • the public "using (true)" policies from 010 are intentionally NOT
--      recreated — they were a security hole fixed by 013 (see that file
--      for the full explanation). All unauthenticated client access goes
--      through the token-validated, service-role API routes instead.
--    • messages added to the supabase_realtime publication (from 010)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── conversations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id       uuid        NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  client_name     text        NOT NULL,
  client_email    text        NOT NULL,
  client_token    uuid        NOT NULL DEFAULT gen_random_uuid(),
  booking_id      uuid        REFERENCES public.bookings(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT NOW(),
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_client_token ON public.conversations(client_token);
CREATE INDEX IF NOT EXISTS idx_conversations_artist ON public.conversations(artist_id);
CREATE INDEX IF NOT EXISTS idx_conversations_email ON public.conversations(artist_id, client_email);

-- ── messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_type     text        NOT NULL CHECK (sender_type IN ('artist', 'client')),
  body            text        NOT NULL CHECK (char_length(body) <= 5000),
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);

-- ── RLS: converge to the post-013 correct state regardless of starting point ──
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artists_own_conversations" ON public.conversations;
CREATE POLICY "artists_own_conversations" ON public.conversations
  FOR ALL USING (
    artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "conversation_participants_messages" ON public.messages;
CREATE POLICY "conversation_participants_messages" ON public.messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid())
    )
  );

-- Security fix from 013: do NOT recreate "clients_view_by_token" /
-- "client_token_messages" (`using (true)`) — explicitly dropped in case this
-- runs on a database where 013 hasn't executed yet.
DROP POLICY IF EXISTS "clients_view_by_token" ON public.conversations;
DROP POLICY IF EXISTS "client_token_messages" ON public.messages;

-- ── email_logs: ensure new_message_notification is an allowed type ───────────
ALTER TABLE public.email_logs DROP CONSTRAINT IF EXISTS email_logs_email_type_check;
ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_email_type_check
  CHECK (email_type IN (
    'booking_confirmation',
    'artist_notification',
    'reminder_48h',
    'reminder_7day',
    'aftercare',
    'payment_failed',
    'subscription_cancelled',
    'gdpr_export',
    'gdpr_deletion',
    'deposit_receipt',
    'review_request',
    'cancellation_opening',
    'new_message_notification',
    'consent_form_submitted'
  ));

-- ── Realtime: add messages to the publication if not already a member ────────
-- (ALTER PUBLICATION ... ADD TABLE errors if the table is already a member,
-- so this has to be guarded explicitly to stay idempotent.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

-- ── Reload PostgREST schema cache so new tables/columns are visible at once ──
NOTIFY pgrst, 'reload schema';
