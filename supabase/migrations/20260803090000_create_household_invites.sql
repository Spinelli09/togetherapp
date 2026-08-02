-- Partner invitations, per the locked architecture (§5, §11). A household
-- can have at most one pending invite per email at a time; acceptance and
-- expiry are enforced by the functions in the next migration, not here.
create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email text not null,
  token uuid not null default gen_random_uuid(),
  invited_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  constraint household_invites_token_unique unique (token)
);

-- Prevents inviting the same email twice to the same household while a
-- prior invite is still pending. Partial (status = 'pending') so a new
-- invite can be sent after the old one is accepted or expires.
create unique index household_invites_household_email_pending_idx
  on public.household_invites (household_id, email)
  where status = 'pending';

alter table public.household_invites enable row level security;

-- Any current member can see invites for their own household (shared
-- transparency between partners), reusing the helper from Milestone 2.
create policy "Members can view invites for their household"
  on public.household_invites
  for select
  using (public.is_household_member(household_id));

-- Only the household's owner can create invites, and only in their own
-- name — this is a normal RLS-scoped insert (no bootstrap problem, since
-- the inviting owner is already a member and the SELECT policy above
-- already grants them visibility of the row they're about to insert).
create policy "Owners can invite to their household"
  on public.household_invites
  for insert
  to authenticated
  with check (
    public.is_household_owner(household_id)
    and invited_by = (select auth.uid())
  );

-- No UPDATE/DELETE policy: status transitions (accepted/expired) happen
-- only inside the SECURITY DEFINER function in the next migration, never
-- via a direct client-side update.
