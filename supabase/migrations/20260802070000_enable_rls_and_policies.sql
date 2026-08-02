-- Membership checks are wrapped in SECURITY DEFINER functions rather
-- than inlined as subqueries directly in the policies below. A policy
-- on household_members that subqueries household_members re-triggers
-- that same policy on the inner query, and Postgres raises "infinite
-- recursion detected in policy for relation household_members" the
-- first time anyone actually selects a row. Wrapping the check in a
-- SECURITY DEFINER function makes the inner query run as the function's
-- owner (the migration role), which is exempt from RLS on tables it
-- owns, breaking the recursion. This also lets the households policies
-- reuse the same functions instead of duplicating the subquery.
create function public.is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from household_members
    where household_id = target_household_id
      and user_id = auth.uid()
  );
$$;

create function public.is_household_owner(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

revoke execute on function public.is_household_member(uuid) from public;
revoke execute on function public.is_household_owner(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;

-- households: readable by anyone with a membership row for it.
create policy "Members can view their household"
  on public.households
  for select
  using (public.is_household_member(id));

-- households: updatable only by the household's owner.
create policy "Owners can update their household"
  on public.households
  for update
  using (public.is_household_owner(id));

-- households: INSERT has no membership row to check against yet at
-- creation time — the very next statement in the app flow always
-- inserts the creator's own household_members row as owner. Any
-- authenticated user may create a household.
create policy "Authenticated users can create a household"
  on public.households
  for insert
  to authenticated
  with check (true);

-- household_members: a user can see every member row in a household
-- they themselves belong to.
create policy "Members can view co-members of their household"
  on public.household_members
  for select
  using (public.is_household_member(household_id));

-- household_members: a user may only ever create a membership row for
-- themself. This single rule covers both "create my own household" and
-- the future "accept an invite" flow without needing a bootstrap
-- exception, and it does not reference household_members from within
-- its own policy, so it carries no recursion risk.
create policy "Users can create their own membership"
  on public.household_members
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- household_members: a user may edit their own row (e.g. display name).
create policy "Users can update their own membership"
  on public.household_members
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No DELETE policy on either table: leaving a household or removing a
-- partner is out of scope for this milestone. RLS blocks all deletes by
-- default when a table has RLS enabled and no DELETE policy exists.
