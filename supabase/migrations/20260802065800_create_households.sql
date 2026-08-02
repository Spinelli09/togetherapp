-- Households are the tenant boundary for the whole app. Every other
-- household-scoped table (household_members, and later budgets, goals,
-- bills, etc.) hangs off households.id.
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
