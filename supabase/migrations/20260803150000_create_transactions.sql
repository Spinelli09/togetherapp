-- Milestone 6: transaction import. household_id is denormalized onto
-- this table deliberately (not joined through account_id -> bank_accounts
-- -> bank_connections) so RLS and the primary list query stay a single
-- indexed lookup at 50,000+ rows per household. It is never accepted as
-- caller input — only record_transaction_sync (next migration) writes
-- this table, and it always derives household_id server-side.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  account_id uuid not null references public.bank_accounts (id) on delete cascade,
  external_transaction_id text not null,
  occurred_at timestamptz not null,
  amount numeric not null,
  -- Generated, not stored redundantly by hand: keeps 'debit'/'credit'
  -- queryable/indexable without recomputing amount < 0 everywhere, and
  -- can never drift out of sync with amount.
  direction text generated always as (
    case when amount < 0 then 'debit' else 'credit' end
  ) stored,
  description text not null,
  merchant_name text,
  -- Akahu's own category, deliberately NOT named "category" — Milestone
  -- 7 will add the app's own budget-category column, and this name
  -- reserves that slot so M7 adds a column instead of renaming one.
  provider_category text,
  -- Not confirmed present in Akahu's actual API response as of this
  -- migration (see Milestone 6 design doc §18) — defaults to 'posted'
  -- until verified against real data.
  status text not null default 'posted' check (status in ('pending', 'posted')),
  raw_payload jsonb not null,
  provider_updated_at timestamptz,
  -- Reserved for the future webhook DELETE case (soft delete). Nothing
  -- in this milestone populates it - manual sync only ever upserts.
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_account_external_unique unique (account_id, external_transaction_id)
);

-- The dominant query pattern: a household's transactions, most recent
-- first, paginated. Every dashboard/report query in the design doc leans
-- on this one index.
create index transactions_household_id_occurred_at_idx
  on public.transactions (household_id, occurred_at desc);

-- Per-account chronological view - genuinely distinct from the unique
-- constraint's index above, which is sorted by external_transaction_id,
-- not date.
create index transactions_account_id_occurred_at_idx
  on public.transactions (account_id, occurred_at desc);

alter table public.transactions enable row level security;

-- SELECT-only at the RLS/PostgREST layer, matching bank_accounts: every
-- write goes through record_transaction_sync (SECURITY DEFINER, next
-- migration) instead of a direct policy, so there is no client-reachable
-- path to insert or edit a transaction except code reviewed for exactly
-- that purpose.
create policy "Members can view their household's transactions"
  on public.transactions
  for select
  using (public.is_household_member(household_id));
