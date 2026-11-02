create policy "No direct client access to AI usage counters"
on public.user_ai_usage
for all
to anon, authenticated
using (false)
with check (false);

create policy "No direct client access to encrypted AI keys"
on public.user_ai_keys
for all
to anon, authenticated
using (false)
with check (false);