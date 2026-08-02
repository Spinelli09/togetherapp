-- household_members links an auth.users row to a household and doubles
-- as the per-household user profile (display name, role) — the locked
-- architecture defines no separate profiles table.
create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  constraint household_members_household_user_unique unique (household_id, user_id)
);

-- The unique constraint above already provides an efficient index for
-- household_id-only lookups (it's the leading column), so only user_id
-- needs its own index. Both are read on every RLS check in the next
-- migration.
create index household_members_user_id_idx on public.household_members (user_id);
