-- Verification during implementation found that PostgREST's .or() filter
-- syntax (the only way to express a keyset predicate via the Supabase
-- client's query builder) compiles to a post-scan Filter, not an Index
-- Cond: EXPLAIN ANALYZE showed "Rows Removed by Filter" scaling linearly
-- with how deep the pagination cursor is (~5ms at 20,000 rows deep,
-- confirmed by index scan rather than seq scan, but not the flat,
-- depth-independent cost the design's acceptance criteria call for).
--
-- This function runs the same native (occurred_at, id) < (X, Y) row
-- comparison already proven fast via raw SQL (~0.9ms regardless of
-- cursor depth) as a proper index range condition instead.
--
-- Deliberately SECURITY INVOKER (Postgres's default, stated explicitly
-- here because every other function in this codebase is SECURITY
-- DEFINER) — it runs as the calling user, so RLS on transactions applies
-- exactly as it would for a direct table query. No internal
-- authorization check is needed, unlike the DEFINER functions elsewhere.
create function public.list_household_transactions(
  p_household_id uuid,
  p_before_occurred_at timestamptz,
  p_before_id uuid,
  p_limit int
)
returns table (
  id uuid,
  occurred_at timestamptz,
  description text,
  merchant_name text,
  amount numeric,
  direction text,
  account_name text
)
language sql
security invoker
stable
as $$
  select t.id, t.occurred_at, t.description, t.merchant_name, t.amount, t.direction, ba.account_name
  from transactions t
  join bank_accounts ba on ba.id = t.account_id
  where t.household_id = p_household_id
    and (
      p_before_occurred_at is null
      or (t.occurred_at, t.id) < (p_before_occurred_at, p_before_id)
    )
  order by t.occurred_at desc, t.id desc
  limit p_limit;
$$;

revoke execute on function public.list_household_transactions(uuid, timestamptz, uuid, int) from public;
revoke execute on function public.list_household_transactions(uuid, timestamptz, uuid, int) from anon;
grant execute on function public.list_household_transactions(uuid, timestamptz, uuid, int) to authenticated;
