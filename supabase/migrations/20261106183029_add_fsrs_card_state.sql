-- Persist the FSRS scheduler state so reviews remain consistent across sessions.
alter table public.flashcards
  add column if not exists fsrs_card jsonb not null default '{}'::jsonb;
