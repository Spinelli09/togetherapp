-- Milestone 9 design doc §5.1. The single new SQL function this milestone
-- introduces.
--
-- SECURITY INVOKER, matching list_household_transactions and
-- get_household_budget_progress — pure read, no elevated privilege needed,
-- so RLS on transactions applies exactly as it would for a direct query.
--
-- Why this function exists rather than a direct client-side aggregate:
-- it centralises the month-boundary timezone expression. Casting
-- p_month_start to `timestamp` (not `timestamptz`) before AT TIME ZONE
-- selects the correct operator overload — "interpret this naive local
-- time as being in this zone". Applying AT TIME ZONE to a bare `date`
-- routes through Postgres's implicit date->timestamptz cast, anchoring to
-- midnight in the *session's* timezone instead, which produces a wrong
-- boundary. That exact mistake was a real bug caught during Milestone 7
-- and fixed there; computing this boundary in TypeScript would duplicate
-- the error-prone logic in a second place. Both bounds do the month
-- arithmetic on the `date` before converting, rather than adding an
-- interval to an already-converted timestamptz (which would perform
-- calendar arithmetic in the session's timezone, a subtler version of the
-- same bug).
--
-- net is sum(amount) — the signed sum — rather than money_in - money_out.
-- The two are equal by construction since `direction` is a generated
-- column derived from amount's sign, but computing net directly removes
-- any chance of the two drifting.
create function public.get_household_monthly_summary(
  p_household_id uuid,
  p_month_start date
)
returns table (
  money_in numeric,
  money_out numeric,
  net numeric
)
language sql
security invoker
stable
set search_path = public
as $$
  select
    coalesce(sum(amount) filter (where direction = 'credit'), 0) as money_in,
    coalesce(sum(-amount) filter (where direction = 'debit'), 0) as money_out,
    coalesce(sum(amount), 0) as net
  from transactions
  where household_id = p_household_id
    and deleted_at is null
    and occurred_at >= (p_month_start::timestamp at time zone 'Pacific/Auckland')
    and occurred_at <  ((p_month_start + interval '1 month')::date::timestamp at time zone 'Pacific/Auckland');
$$;

revoke execute on function public.get_household_monthly_summary(uuid, date) from public;
revoke execute on function public.get_household_monthly_summary(uuid, date) from anon;
grant execute on function public.get_household_monthly_summary(uuid, date) to authenticated;
