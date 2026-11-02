create table if not exists public.user_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (timezone('utc', now())::date),
  count integer not null default 0 check (count >= 0 and count <= 15),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create table if not exists public.user_ai_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gemini', 'openrouter')),
  encrypted_key text not null,
  iv text not null,
  auth_tag text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (char_length(event_name) between 1 and 100),
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_ai_usage_date_idx on public.user_ai_usage (usage_date);
create index if not exists analytics_events_user_created_idx on public.analytics_events (user_id, created_at desc);
create index if not exists analytics_events_name_created_idx on public.analytics_events (event_name, created_at desc);

alter table public.user_ai_usage enable row level security;
alter table public.user_ai_keys enable row level security;
alter table public.analytics_events enable row level security;

revoke all on public.user_ai_usage from anon, authenticated;
revoke all on public.user_ai_keys from anon, authenticated;
revoke all on public.analytics_events from anon, authenticated;
grant all on public.user_ai_usage to service_role;
grant all on public.user_ai_keys to service_role;
grant insert on public.analytics_events to authenticated;
grant all on public.analytics_events to service_role;

create policy "Users can insert their own analytics events"
on public.analytics_events
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create or replace function public.increment_ai_usage(p_user_id uuid, p_usage_date date)
returns integer
language sql
security invoker
set search_path = public
as $$
  insert into public.user_ai_usage (user_id, usage_date, count, updated_at)
  values (p_user_id, p_usage_date, 1, now())
  on conflict (user_id, usage_date)
  do update set count = public.user_ai_usage.count + 1, updated_at = now()
  where public.user_ai_usage.count < 15
  returning count;
$$;

revoke all on function public.increment_ai_usage(uuid, date) from public, anon, authenticated;
grant execute on function public.increment_ai_usage(uuid, date) to service_role;
