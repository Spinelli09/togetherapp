-- Milestone 10. The single new SQL object this milestone introduces: the
-- deterministic fact base for AI insights. No table, no persistence — the
-- Server Action calls this on demand and renders the result directly.
--
-- SECURITY INVOKER, matching list_household_transactions,
-- get_household_budget_progress and get_household_monthly_summary. RLS on
-- transactions applies directly, and transaction_category_resolution is
-- itself security_invoker = true, so category resolution is scoped to the
-- caller exactly as a direct query would be.
--
-- Month boundaries use the same verified expression as every other
-- month-scoped function here: cast the date to `timestamp` (not
-- `timestamptz`) before AT TIME ZONE, and do month arithmetic on the
-- `date` before converting. See the Milestone 7 bug and its Milestone 9
-- re-verification for why the naive form is wrong.
--
-- WHY TRANSFER DETECTION EXISTS: on real data, 76% of "spending" was
-- Uncategorized, dominated by money moving between the household's own
-- accounts (e.g. a weekly $550 into their own "Lil Dream" savings).
-- Reporting that as spending is plainly wrong — it is the opposite of
-- spending. A debit whose description begins with the name of one of THIS
-- household's own accounts is an internal transfer. That is an exact match
-- against known data, not a heuristic guess. Anything it does not match
-- stays honestly labelled "uncategorised" rather than being guessed at.
create function public.get_household_insight_facts(
  p_household_id uuid,
  p_month_start date
)
returns jsonb
language sql
security invoker
stable
set search_path = public
as $$
  with bounds as (
    select
      (p_month_start::timestamp at time zone 'Pacific/Auckland') as this_start,
      ((p_month_start + interval '1 month')::date::timestamp at time zone 'Pacific/Auckland') as this_end,
      ((p_month_start - interval '1 month')::date::timestamp at time zone 'Pacific/Auckland') as prev_start
  ),
  own_accounts as (
    select distinct ba.account_name
    from bank_accounts ba
    join bank_connections bc on bc.id = ba.connection_id
    where bc.household_id = p_household_id
  ),
  scoped as (
    select
      tx.description,
      tx.merchant_name,
      t.occurred_at,
      t.amount,
      t.direction,
      c.name as category_name,
      c.is_uncategorized_default,
      (oa.account_name is not null) as is_transfer,
      (t.occurred_at >= b.this_start) as is_this_month
    from transaction_category_resolution t
    join transactions tx on tx.id = t.transaction_id
    join categories c on c.id = t.category_id
    cross join bounds b
    left join own_accounts oa on tx.description ilike oa.account_name || '%'
    where t.household_id = p_household_id
      and t.deleted_at is null
      and t.occurred_at >= b.prev_start
      and t.occurred_at <  b.this_end
  ),
  totals as (
    select
      coalesce(round(sum(-amount) filter (
        where is_this_month and direction = 'debit' and not is_transfer and not is_uncategorized_default
      ), 2), 0) as categorised_spend,
      coalesce(round(sum(-amount) filter (
        where is_this_month and direction = 'debit' and is_transfer
      ), 2), 0) as internal_transfers,
      coalesce(round(sum(-amount) filter (
        where is_this_month and direction = 'debit' and not is_transfer and is_uncategorized_default
      ), 2), 0) as uncategorised_spend,
      coalesce(round(sum(-amount) filter (
        where not is_this_month and direction = 'debit' and not is_transfer and not is_uncategorized_default
      ), 2), 0) as prev_categorised_spend
    from scoped
  ),
  -- Category breakdown, this month vs last, excluding transfers and the
  -- Uncategorized bucket (both are reported separately above).
  categories_agg as (
    select
      category_name,
      coalesce(round(sum(-amount) filter (where is_this_month and direction = 'debit'), 2), 0) as spent,
      coalesce(round(sum(-amount) filter (where not is_this_month and direction = 'debit'), 2), 0) as prev_spent
    from scoped
    where not is_transfer and not is_uncategorized_default
    group by category_name
    having coalesce(sum(-amount) filter (where is_this_month and direction = 'debit'), 0) > 0
        or coalesce(sum(-amount) filter (where not is_this_month and direction = 'debit'), 0) > 0
  ),
  top_expenses as (
    select description, merchant_name, round(-amount, 2) as amount, occurred_at
    from scoped
    where is_this_month and direction = 'debit' and not is_transfer and not is_uncategorized_default
    order by amount asc
    limit 5
  ),
  -- Surfaced so the household can see what the uncategorised bucket
  -- actually contains, rather than it being an opaque lump sum.
  top_uncategorised as (
    select description, round(-amount, 2) as amount, occurred_at
    from scoped
    where is_this_month and direction = 'debit' and not is_transfer and is_uncategorized_default
    order by amount asc
    limit 5
  ),
  transfer_destinations as (
    select description, round(sum(-amount), 2) as amount, count(*) as txn_count
    from scoped
    where is_this_month and direction = 'debit' and is_transfer
    group by description
    order by sum(-amount) asc
    limit 5
  )
  select jsonb_build_object(
    'month_start', p_month_start,
    'categorised_spend', (select categorised_spend from totals),
    'internal_transfers', (select internal_transfers from totals),
    'uncategorised_spend', (select uncategorised_spend from totals),
    'prev_categorised_spend', (select prev_categorised_spend from totals),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('name', category_name, 'spent', spent, 'prev_spent', prev_spent)
             order by spent desc)
      from categories_agg
    ), '[]'::jsonb),
    'top_expenses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', description, 'merchant_name', merchant_name,
        'amount', amount, 'occurred_at', occurred_at) order by amount desc)
      from top_expenses
    ), '[]'::jsonb),
    'top_uncategorised', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', description, 'amount', amount, 'occurred_at', occurred_at) order by amount desc)
      from top_uncategorised
    ), '[]'::jsonb),
    'transfer_destinations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', description, 'amount', amount, 'txn_count', txn_count) order by amount desc)
      from transfer_destinations
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.get_household_insight_facts(uuid, date) from public;
revoke execute on function public.get_household_insight_facts(uuid, date) from anon;
grant execute on function public.get_household_insight_facts(uuid, date) to authenticated;
