-- Store the estimated effort for each learning topic.
alter table public.learning_topics
  add column if not exists estimated_hours numeric(6,2) not null default 1.00;

alter table public.learning_topics
  drop constraint if exists learning_topics_estimated_hours_check,
  add constraint learning_topics_estimated_hours_check
    check (estimated_hours > 0 and estimated_hours <= 40);
