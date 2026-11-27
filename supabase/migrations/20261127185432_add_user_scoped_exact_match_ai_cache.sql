-- Store exact-match structured AI responses per user.
-- User scoping prevents one account from reading another student's source material.
create table if not exists public.ai_cache (
  hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  response jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.ai_cache enable row level security;

revoke all on public.ai_cache from anon, authenticated;
grant select, insert, update on public.ai_cache to authenticated;

create policy "Users can read their own AI cache entries"
on public.ai_cache
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can insert their own AI cache entries"
on public.ai_cache
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update their own AI cache entries"
on public.ai_cache
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create index if not exists ai_cache_created_at_idx
on public.ai_cache (created_at);
