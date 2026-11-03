-- Initial backend hardening for BYOK and shared AI quotas.
-- The following lock_down_ai_usage_direct_access migration removes legacy
-- direct counter policies and leaves the final restrictive policy set.
alter table public.user_ai_keys enable row level security;
revoke all on public.user_ai_keys from anon, authenticated;
grant select, insert, update, delete on public.user_ai_keys to authenticated;

drop policy if exists "Users manage only their encrypted AI keys" on public.user_ai_keys;
create policy "Users manage only their encrypted AI keys"
on public.user_ai_keys for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter table public.user_ai_usage enable row level security;
revoke all on public.user_ai_usage from anon, authenticated;

drop function if exists public.increment_ai_usage(uuid, date);
create or replace function public.increment_ai_usage()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
  v_date date := timezone('utc', now())::date;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  insert into public.user_ai_usage (user_id, date, count, updated_at)
  values (v_user_id, v_date, 1, now())
  on conflict (user_id, date)
  do update set count = public.user_ai_usage.count + 1, updated_at = now()
  where public.user_ai_usage.count < 15
  returning count into v_count;
  return v_count;
end;
$$;
revoke all on function public.increment_ai_usage() from public, anon;
grant execute on function public.increment_ai_usage() to authenticated;
