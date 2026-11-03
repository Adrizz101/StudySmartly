-- Close the direct-write path for daily usage counters. The only quota
-- mutation exposed to authenticated clients is the no-argument RPC, which
-- derives the user from auth.uid() and increments atomically.
drop policy if exists "Users can read their own AI usage" on public.user_ai_usage;
drop policy if exists "Users can create their own daily AI usage row" on public.user_ai_usage;
drop policy if exists "Users can increment their own daily AI usage" on public.user_ai_usage;
revoke all on public.user_ai_usage from anon, authenticated;

-- Encrypted BYOK rows remain user-scoped. The encryption key is server-only,
-- so clients can only ever read their own ciphertext.
drop policy if exists "Users can read their own encrypted AI keys" on public.user_ai_keys;
drop policy if exists "Users can insert their own encrypted AI keys" on public.user_ai_keys;
drop policy if exists "Users can update their own encrypted AI keys" on public.user_ai_keys;
drop policy if exists "Users can delete their own encrypted AI keys" on public.user_ai_keys;
drop policy if exists "Users manage only their encrypted AI keys" on public.user_ai_keys;
create policy "Users manage only their encrypted AI keys"
on public.user_ai_keys for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
revoke all on public.user_ai_keys from anon, authenticated;
grant select, insert, update, delete on public.user_ai_keys to authenticated;

drop function if exists public.increment_ai_usage();
create function public.increment_ai_usage()
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
  do update
    set count = public.user_ai_usage.count + 1,
        updated_at = now()
    where public.user_ai_usage.count < 15
  returning count into v_count;

  return v_count;
end;
$$;
revoke all on function public.increment_ai_usage() from public, anon;
grant execute on function public.increment_ai_usage() to authenticated;
