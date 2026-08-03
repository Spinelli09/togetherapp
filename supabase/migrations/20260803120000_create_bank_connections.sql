-- Milestone 5: bank connections, per the locked architecture's Akahu
-- integration (§8) plus this milestone's explicit schema. Table names
-- are provider-agnostic ("bank_connections"/"bank_accounts") rather than
-- "akahu_*" — a naming choice, not a security or RLS-model change.
--
-- Ownership follows the architecture's existing per-partner model
-- (households data model, §7): each connection belongs to the member who
-- created it (connected_by), while both partners can see all of a
-- household's connections and accounts, matching how the rest of the
-- app treats shared financial data.
create table public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  connected_by uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'akahu' check (provider in ('akahu')),
  institution text not null,
  vault_secret_id uuid not null,
  status text not null default 'active' check (status in ('active', 'disconnected', 'error')),
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);

create index bank_connections_household_id_idx on public.bank_connections (household_id);
create index bank_connections_connected_by_idx on public.bank_connections (connected_by);

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.bank_connections (id) on delete cascade,
  external_account_id text not null,
  account_name text not null,
  account_type text not null,
  currency text not null,
  current_balance numeric not null,
  available_balance numeric,
  last_synced_at timestamptz not null default now(),
  constraint bank_accounts_connection_external_unique unique (connection_id, external_account_id)
);

-- connection_id is already the leading column of the unique constraint's
-- index above, so no separate index is needed for connection_id-only
-- lookups (same reasoning as household_members in Milestone 2).

alter table public.bank_connections enable row level security;
alter table public.bank_accounts enable row level security;

-- Both tables are SELECT-only at the RLS/PostgREST layer. Every write
-- (create, sync, disconnect) goes through a narrow SECURITY DEFINER
-- function in the next migration instead of a direct INSERT/UPDATE/DELETE
-- policy — those functions are the only path that ever touches the
-- encrypted token, so there is no client-reachable way to create or
-- mutate a connection except through code that has been reviewed for
-- exactly that purpose.
create policy "Members can view their household's bank connections"
  on public.bank_connections
  for select
  using (public.is_household_member(household_id));

create policy "Members can view their household's bank accounts"
  on public.bank_accounts
  for select
  using (
    exists (
      select 1
      from public.bank_connections c
      where c.id = bank_accounts.connection_id
        and public.is_household_member(c.household_id)
    )
  );
