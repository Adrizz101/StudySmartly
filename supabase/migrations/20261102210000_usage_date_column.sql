alter table public.user_ai_usage rename column usage_date to date;

create or replace function public.increment_ai_usage(p_user_id uuid, p_usage_date date)
returns integer
language sql
security invoker
set search_path = public
as $$
  insert into public.user_ai_usage (user_id, date, count, updated_at)
  values (p_user_id, p_usage_date, 1, now())
  on conflict (user_id, date)
  do update set count = public.user_ai_usage.count + 1, updated_at = now()
  where public.user_ai_usage.count < 15
  returning count;
$$;

revoke all on function public.increment_ai_usage(uuid, date) from public, anon, authenticated;
grant execute on function public.increment_ai_usage(uuid, date) to service_role;
