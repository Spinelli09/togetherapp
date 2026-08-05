-- Milestone 7 design doc §5. security invoker (matches
-- list_household_transactions' precedent) — pure read, relies on RLS via
-- the view's own security_invoker = true rather than any elevated
-- privilege.
--
-- Month-boundary expression verified empirically against the live DB
-- across both NZDT and NZST (design doc §0): casting p_month_start to
-- `timestamp` (not `timestamptz`) before `at time zone` selects the
-- correct operator overload — "interpret this naive local time as being
-- in this zone". Applying `at time zone` to the bare `date` instead
-- routes through Postgres's implicit date->timestamptz cast, which
-- anchors to midnight in the *session's* timezone (UTC) first, producing
-- a wrong boundary. Both the start and end boundary do the month
-- arithmetic on the `date` before converting, rather than adding an
-- interval to an already-converted timestamptz, which would perform
-- calendar arithmetic in the session's timezone rather than Auckland's.
create function public.get_household_budget_progress(
  p_household_id uuid,
  p_month_start date
)
returns table (
  budget_id uuid,
  name text,
  monthly_limit numeric,
  net_spent numeric,
  gross_spent numeric
)
language sql
security invoker
stable
set search_path = public
as $$
  select
    b.id,
    b.name,
    b.monthly_limit,
    coalesce(sum(-t.amount), 0) as net_spent,
    coalesce(sum(-t.amount) filter (where t.direction = 'debit'), 0) as gross_spent
  from budgets b
  join budget_categories bc on bc.budget_id = b.id
  left join transaction_category_resolution t
    on t.category_id = bc.category_id
   and t.household_id = b.household_id
   and t.deleted_at is null
   and t.occurred_at >= (p_month_start::timestamp at time zone 'Pacific/Auckland')
   and t.occurred_at <  ((p_month_start + interval '1 month')::date::timestamp at time zone 'Pacific/Auckland')
  where b.household_id = p_household_id
    and b.is_active
  group by b.id, b.name, b.monthly_limit;
$$;

revoke execute on function public.get_household_budget_progress(uuid, date) from public;
revoke execute on function public.get_household_budget_progress(uuid, date) from anon;
grant execute on function public.get_household_budget_progress(uuid, date) to authenticated;
