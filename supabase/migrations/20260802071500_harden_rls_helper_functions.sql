-- Corrections found by running the Supabase security/performance advisors
-- against the previous migration's live schema (see Milestone 2
-- verification) — not caught by static review.

-- 1) `revoke execute ... from public` in the prior migration does not
-- remove `anon`'s access: Supabase grants EXECUTE on newly created
-- public-schema functions to anon/authenticated/service_role via
-- project-level default privileges, which is a separate, direct grant.
-- These functions are internal RLS helpers, not public API — anon has
-- no business calling them.
revoke execute on function public.is_household_member(uuid) from anon;
revoke execute on function public.is_household_owner(uuid) from anon;

-- 2) auth.uid() called inline in a policy is re-evaluated once per row.
-- Wrapping it as a scalar subquery lets Postgres evaluate it once per
-- statement instead — same behavior, better plan.
alter policy "Users can create their own membership"
  on public.household_members
  with check ((select auth.uid()) = user_id);

alter policy "Users can update their own membership"
  on public.household_members
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
