-- Preserve the original in-app ordering of each user's collections.
alter table public.tutor_sessions add column if not exists position integer not null default 0;
alter table public.presentation_documents add column if not exists position integer not null default 0;
alter table public.courses add column if not exists position integer not null default 0;
alter table public.schedule_events add column if not exists position integer not null default 0;

create index if not exists tutor_sessions_user_position_idx on public.tutor_sessions (user_id, position);
create index if not exists presentation_documents_user_position_idx on public.presentation_documents (user_id, position);
create index if not exists courses_user_position_idx on public.courses (user_id, position);
create index if not exists schedule_events_user_position_idx on public.schedule_events (user_id, position);
