-- Add structured MCQ support to spaced-repetition flashcards.
alter table public.flashcards
  add column if not exists type text not null default 'basic',
  add column if not exists options jsonb not null default '[]'::jsonb,
  add column if not exists correct_option_index integer;

alter table public.flashcards
  drop constraint if exists flashcards_type_check,
  add constraint flashcards_type_check check (type in ('basic', 'mcq')),
  drop constraint if exists flashcards_mcq_payload_check,
  add constraint flashcards_mcq_payload_check check (
    case
      when jsonb_typeof(options) <> 'array' then false
      when type = 'basic' then jsonb_array_length(options) = 0 and correct_option_index is null
      when type = 'mcq' then jsonb_array_length(options) = 4 and correct_option_index between 0 and 3
      else false
    end
  );
