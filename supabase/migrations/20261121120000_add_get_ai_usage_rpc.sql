-- Read the authenticated user's UTC-day AI usage without exposing the table.
create or replace function public.get_ai_usage()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select coalesce(usage.count, 0)
    into v_count
    from public.user_ai_usage as usage
   where usage.user_id = v_user_id
     and usage.date = timezone('utc', now())::date;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.get_ai_usage() from public, anon;
grant execute on function public.get_ai_usage() to authenticated;
