-- Milestone 7 design doc §3. Any household member can manage budgets — no
-- owner-only gate, mirroring connect_bank_account's precedent rather than
-- disconnect_bank_connection's creator-only restriction (that restriction
-- exists because a bank connection is tied to one person's Akahu
-- credential; budgets have no analogous coupling).
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  monthly_limit numeric not null check (monthly_limit > 0),
  created_by uuid not null references auth.users (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index budgets_household_id_idx on public.budgets (household_id) where is_active;

alter table public.budgets enable row level security;

create policy "Members can view their household's budgets" on public.budgets
  for select using (public.is_household_member(household_id));

-- Many-to-many: a budget can target one or more categories, and the same
-- category can be targeted by more than one budget (a transaction in that
-- category then counts toward each budget independently — intentional,
-- not a bug, per design doc §5).
create table public.budget_categories (
  budget_id uuid not null references public.budgets (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  primary key (budget_id, category_id)
);

alter table public.budget_categories enable row level security;

create policy "Members can view their household's budget categories" on public.budget_categories
  for select using (
    exists (
      select 1 from budgets b
      where b.id = budget_categories.budget_id
        and public.is_household_member(b.household_id)
    )
  );
