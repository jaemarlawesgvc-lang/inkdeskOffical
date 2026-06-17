-- =========================================================================
-- Tier 3+: Interactive Consent Form submissions
-- =========================================================================

create table if not exists consent_form_submissions (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  client_name text not null,
  client_dob date not null,
  client_phone text,
  tattoo_description text not null,
  age_confirmed boolean not null default false,
  medical_answers jsonb not null default '{}'::jsonb,
  signature_name text not null,
  signed_at timestamptz not null default now(),
  ip_address text,
  pdf_path text,
  viewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_consent_submissions_artist on consent_form_submissions(artist_id, created_at desc);
create index if not exists idx_consent_submissions_booking on consent_form_submissions(booking_id);

alter table consent_form_submissions enable row level security;

create policy "artists_own_consent_submissions" on consent_form_submissions
  for select using (
    artist_id in (select id from artists where user_id = auth.uid())
  );

create policy "artists_update_own_consent_submissions" on consent_form_submissions
  for update using (
    artist_id in (select id from artists where user_id = auth.uid())
  );

-- Inserts happen server-side via the service-role client only (clients are
-- unauthenticated). No public insert/select policy is needed or wanted here.

-- Update email_logs CHECK to include the new notification type
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
    'new_message_notification',
    'consent_form_submitted'
  ));

-- Private storage bucket for the generated, signed consent PDFs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'consent-forms',
  'consent-forms',
  false,
  5242880,
  array['application/pdf']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Artists can read their own submitted consent PDFs (dashboard download)
create policy "consent_forms_artist_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'consent-forms'
    and (storage.foldername(name))[1] = (
      select id::text
      from public.artists
      where user_id    = auth.uid()
        and deleted_at is null
      limit 1
    )
  );

-- NOTE: no insert/update/delete policy for authenticated/anon — files are
-- written only by the service-role client in the submit API route.
