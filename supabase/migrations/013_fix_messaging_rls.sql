-- =========================================================================
-- Fix overly-permissive messaging RLS policies (security hole)
--
-- 010_tier3_messaging.sql added "clients_view_by_token" (conversations) and
-- "client_token_messages" (messages) as `for select using (true)` policies,
-- intending to let an unauthenticated client read their own conversation
-- via the public anon key. `using (true)` does not check the token at all —
-- it grants SELECT on every row to anyone holding the anon key, which is
-- public by design (shipped in the client bundle). In practice this means
-- the full contents of every conversation and every private message were
-- readable by anyone via Supabase's auto-generated REST API
-- (e.g. GET /rest/v1/messages?select=*), with no token required.
--
-- The application never actually relied on these policies: the public,
-- token-gated chat routes (app/api/conversations/client/route.ts) run
-- server-side using the service-role admin client, which bypasses RLS and
-- validates the token explicitly in application code. The browser/anon
-- Supabase client is never used against the conversations or messages
-- tables anywhere in the app. These policies can be dropped outright with
-- no loss of functionality.
-- =========================================================================

drop policy if exists "clients_view_by_token" on conversations;
drop policy if exists "client_token_messages" on messages;

-- artists_own_conversations (conversations) and
-- conversation_participants_messages (messages) remain unchanged and
-- continue to scope authenticated artist access to auth.uid().
--
-- No replacement "anon" policy is added: all unauthenticated client access
-- to conversations/messages must continue to go through the server-side
-- token-validated API routes using the admin client, never direct
-- PostgREST access with the anon key.
