-- Milestone 8 design doc §1/§3/§5. current_amount is a real stored column
-- (unlike Budgets' progress, which is deliberately never stored) — there is
-- no source of truth to compute it from; per docs/HANDOVER.md §8 this
-- milestone's progress is manually updated, not derived from transactions.
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  target_amount numeric not null check (target_amount > 0),
  current_amount numeric not null default 0 check (current_amount >= 0),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_by uuid not null references auth.users (id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Partial index scoped to the common "list a household's active goals"
-- query — mirrors budgets_household_id_idx exactly (confirmed via
-- pg_indexes not to have been flagged by the performance advisor despite
-- being partial, so this shape is already validated in this schema).
create index goals_household_id_idx on public.goals (household_id) where status = 'active';

-- FK-covering index applied proactively this time, rather than waiting for
-- the advisor to flag it as it did twice in Milestone 7
-- (budgets.created_by, category_aliases.category_id).
create index goals_created_by_idx on public.goals (created_by);

alter table public.goals enable row level security;

create policy "Members can view their household's goals" on public.goals
  for select using (public.is_household_member(household_id));
