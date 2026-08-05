-- Milestone 7 design doc §3/§14 (Phase A). Global, platform-defined, fixed
-- set — not household-scoped, not user-editable (no write policy, no
-- delete function exists for this table at all).
--
-- The 7 non-Uncategorized names below are an explicitly UNCONFIRMED
-- placeholder (see design doc §1/§14) — the "architecture document" and
-- "7 fixed categories" referenced in docs/HANDOVER.md and README.md do not
-- exist anywhere in this repo, and no replacement list was provided before
-- implementation was approved. Renaming later is a trivial follow-up
-- migration (update by id, no cascading impact on budgets/aliases, which
-- reference categories.id, not name).
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_order smallint not null,
  -- Marks the single system-managed fallback category. Not user-creatable,
  -- not user-deletable.
  is_uncategorized_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Guarantees at most one row can ever be the fallback, so
-- transaction_category_resolution's LEFT JOIN LATERAL can only ever find
-- zero or one row, never more than one.
create unique index categories_single_uncategorized_default
  on public.categories (is_uncategorized_default)
  where is_uncategorized_default;

alter table public.categories enable row level security;

create policy "Authenticated users can view categories" on public.categories
  for select to authenticated using (true);

insert into public.categories (name, display_order, is_uncategorized_default) values
  ('Groceries', 1, false),
  ('Dining & Takeaways', 2, false),
  ('Transport', 3, false),
  ('Utilities & Bills', 4, false),
  ('Shopping', 5, false),
  ('Entertainment', 6, false),
  ('Other', 7, false),
  ('Uncategorized', 99, true);
