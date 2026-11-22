-- Restore failed shared AI actions and add idempotent daily image usage.
-- All quota-changing RPCs derive the account from auth.uid().

create or replace function public.refund_ai_usage()
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

  update public.user_ai_usage
     set count = greatest(count - 1, 0),
         updated_at = now()
   where user_id = v_user_id
     and date = v_date
  returning count into v_count;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.refund_ai_usage() from public, anon;
grant execute on function public.refund_ai_usage() to authenticated;

create table if not exists public.user_image_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  request_id text not null check (char_length(request_id) between 1 and 100),
  created_at timestamptz not null default now(),
  primary key (user_id, usage_date, request_id)
);

create index if not exists user_image_usage_date_idx
  on public.user_image_usage (usage_date, user_id);

alter table public.user_image_usage enable row level security;
drop policy if exists "Users can read their own image usage" on public.user_image_usage;
create policy "Users can read their own image usage"
  on public.user_image_usage
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.user_image_usage from anon, authenticated;
grant select on public.user_image_usage to authenticated;

-- Returns 1 when this request ID is newly charged, 0 when it was already
-- charged (a replay/retry), and the negative daily limit when it is reached.
create or replace function public.charge_image_usage(p_request_id text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_date date := timezone('utc', now())::date;
  v_count integer;
  v_daily_limit constant integer := 5;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_request_id is null or char_length(p_request_id) < 1 or char_length(p_request_id) > 100 then
    raise exception 'A valid image request ID is required' using errcode = '22023';
  end if;

  -- Serialize this user's quota checks to prevent concurrent requests
  -- from racing past the daily limit.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  if exists (
    select 1 from public.user_image_usage
     where user_id = v_user_id
       and usage_date = v_date
       and request_id = p_request_id
  ) then
    return 0;
  end if;

  select count(*)::integer
    into v_count
    from public.user_image_usage
   where user_id = v_user_id
     and usage_date = v_date;

  if v_count >= v_daily_limit then
    return -v_daily_limit;
  end if;

  insert into public.user_image_usage (user_id, usage_date, request_id)
  values (v_user_id, v_date, p_request_id);

  return 1;
end;
$$;

revoke all on function public.charge_image_usage(text) from public, anon;
grant execute on function public.charge_image_usage(text) to authenticated;

create or replace function public.refund_image_usage(p_request_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_date date := timezone('utc', now())::date;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_request_id is null or char_length(p_request_id) < 1 or char_length(p_request_id) > 100 then
    raise exception 'A valid image request ID is required' using errcode = '22023';
  end if;

  delete from public.user_image_usage
   where user_id = v_user_id
     and usage_date = v_date
     and request_id = p_request_id;

  return found;
end;
$$;

revoke all on function public.refund_image_usage(text) from public, anon;
grant execute on function public.refund_image_usage(text) to authenticated;
