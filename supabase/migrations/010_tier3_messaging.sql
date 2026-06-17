-- =========================================================================
-- Tier 3: In-App Messaging tables
-- =========================================================================

-- conversations: one per artist-client pair
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  client_name text not null,
  client_email text not null,
  client_token uuid not null default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_conversations_client_token on conversations(client_token);
create index if not exists idx_conversations_artist on conversations(artist_id);
create index if not exists idx_conversations_email on conversations(artist_id, client_email);

-- messages
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('artist', 'client')),
  body text not null check (char_length(body) <= 5000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_conversation on messages(conversation_id, created_at);

-- RLS on conversations
alter table conversations enable row level security;

create policy "artists_own_conversations" on conversations
  for all using (
    artist_id in (select id from artists where user_id = auth.uid())
  );

create policy "clients_view_by_token" on conversations
  for select using (true);

-- RLS on messages
alter table messages enable row level security;

create policy "conversation_participants_messages" on messages
  for all using (
    conversation_id in (
      select id from conversations
      where artist_id in (select id from artists where user_id = auth.uid())
    )
  );

create policy "client_token_messages" on messages
  for select using (true);

-- Update email_logs CHECK to include new email type
alter table email_logs drop constraint if exists email_logs_email_type_check;
alter table email_logs add constraint email_logs_email_type_check
  check (email_type in (
    'booking_confirmation',
    'artist_notification',
    'reminder_48h',
    'reminder_7day',
    'aftercare',
    'deposit_receipt',
    'review_request',
    'cancellation_opening',
    'new_message_notification'
  ));

-- Enable realtime for messages
alter publication supabase_realtime add table messages;
