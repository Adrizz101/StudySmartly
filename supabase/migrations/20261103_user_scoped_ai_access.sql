drop policy if exists "No direct client access to AI usage counters" on public.user_ai_usage;
drop policy if exists "No direct client access to encrypted AI keys" on public.user_ai_keys;

create policy "Users can read their own AI usage"
on public.user_ai_usage for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own daily AI usage row"
on public.user_ai_usage for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and date = (timezone('utc', now())::date)
  and count = 1
);

create policy "Users can increment their own daily AI usage"
on public.user_ai_usage for update to authenticated
using ((select auth.uid()) = user_id and date = (timezone('utc', now())::date))
with check ((select auth.uid()) = user_id and date = (timezone('utc', now())::date) and count between 1 and 15);

create policy "Users can read their own encrypted AI keys"
on public.user_ai_keys for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own encrypted AI keys"
on public.user_ai_keys for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own encrypted AI keys"
on public.user_ai_keys for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own encrypted AI keys"
on public.user_ai_keys for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update on public.user_ai_usage to authenticated;
grant select, insert, update, delete on public.user_ai_keys to authenticated;

create or replace function public.enforce_ai_usage_increment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.user_id <> old.user_id
    or new.date <> old.date
    or new.count <> old.count + 1
    or new.count > 15 then
    raise exception 'AI usage counters can only be incremented by one for the current user and day.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_ai_usage_increment_trigger on public.user_ai_usage;
create trigger enforce_ai_usage_increment_trigger
before update on public.user_ai_usage
for each row execute function public.enforce_ai_usage_increment();

drop function if exists public.increment_ai_usage(uuid, date);
create or replace function public.increment_ai_usage()
returns integer
language sql
security invoker
set search_path = public
as $$
  insert into public.user_ai_usage (user_id, date, count, updated_at)
  values ((select auth.uid()), (timezone('utc', now())::date), 1, now())
  on conflict (user_id, date)
  do update set count = public.user_ai_usage.count + 1, updated_at = now()
  where public.user_ai_usage.count < 15
  returning count;
$$;

revoke all on function public.increment_ai_usage() from public, anon;
grant execute on function public.increment_ai_usage() to authenticated;
