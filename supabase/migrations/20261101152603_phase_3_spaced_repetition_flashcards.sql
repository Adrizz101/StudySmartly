-- Phase 3: Spaced repetition and smart flashcards.
-- The remote migration was applied during the interrupted Phase 3 attempt;
-- this file restores the matching version-controlled migration history.
create table if not exists public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text not null default 'General',
  source text not null default 'manual' check (source in ('manual','ai_generated','mistake_analyzer','lecture_studio','whiteboard')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  answer text not null,
  explanation text not null default '',
  subject text not null default 'General',
  topic text not null default '',
  difficulty text not null default 'normal' check (difficulty in ('easy','normal','hard')),
  due_at timestamptz not null default timezone('utc', now()),
  interval_days integer not null default 0 check (interval_days >= 0),
  ease_factor numeric(4,2) not null default 2.50 check (ease_factor >= 1.30 and ease_factor <= 3.50),
  repetitions integer not null default 0 check (repetitions >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.flashcards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 0 and 3),
  previous_interval_days integer not null default 0,
  next_interval_days integer not null default 0,
  reviewed_at timestamptz not null default timezone('utc', now())
);
create index if not exists flashcard_decks_user_created_idx on public.flashcard_decks(user_id, created_at desc);
create index if not exists flashcards_user_due_idx on public.flashcards(user_id, due_at asc);
create index if not exists flashcards_deck_idx on public.flashcards(deck_id);
create index if not exists flashcard_reviews_user_reviewed_idx on public.flashcard_reviews(user_id, reviewed_at desc);
alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;
alter table public.flashcard_reviews enable row level security;
drop policy if exists "Users manage own flashcard decks" on public.flashcard_decks;
create policy "Users manage own flashcard decks" on public.flashcard_decks for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users manage own flashcards" on public.flashcards;
create policy "Users manage own flashcards" on public.flashcards for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.flashcard_decks d
    where d.id = deck_id and d.user_id = (select auth.uid())
  ));
drop policy if exists "Users manage own flashcard reviews" on public.flashcard_reviews;
create policy "Users manage own flashcard reviews" on public.flashcard_reviews for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.flashcards c
    where c.id = card_id and c.user_id = (select auth.uid())
  ));
grant select, insert, update, delete on public.flashcard_decks to authenticated;
grant select, insert, update, delete on public.flashcards to authenticated;
grant select, insert, update, delete on public.flashcard_reviews to authenticated;
