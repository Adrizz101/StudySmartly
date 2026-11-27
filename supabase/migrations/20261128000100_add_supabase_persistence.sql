-- StudySmartly cross-device persistence.
-- Each row stores one app-level record in JSONB while keeping ownership and timestamps queryable.

create table if not exists public.tutor_sessions (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.presentation_documents (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.courses (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.schedule_events (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.tutor_sessions enable row level security;
alter table public.presentation_documents enable row level security;
alter table public.courses enable row level security;
alter table public.schedule_events enable row level security;

revoke all on public.tutor_sessions, public.presentation_documents, public.courses, public.schedule_events from anon;
grant select, insert, update, delete on public.tutor_sessions, public.presentation_documents, public.courses, public.schedule_events to authenticated;

create policy "Users manage their own tutor sessions"
  on public.tutor_sessions for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users manage their own presentation documents"
  on public.presentation_documents for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users manage their own courses"
  on public.courses for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users manage their own schedule events"
  on public.schedule_events for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create index if not exists tutor_sessions_user_created_idx on public.tutor_sessions (user_id, created_at);
create index if not exists presentation_documents_user_updated_idx on public.presentation_documents (user_id, updated_at desc);
create index if not exists courses_user_updated_idx on public.courses (user_id, updated_at desc);
create index if not exists schedule_events_user_updated_idx on public.schedule_events (user_id, updated_at desc);
