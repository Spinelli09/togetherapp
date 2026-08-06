-- Bug found during Milestone 10 verification against real ANZ data.
--
-- The top_expenses / top_uncategorised CTEs selected
--   round(-amount, 2) as amount
-- and then ordered by `amount asc`. In Postgres the output alias takes
-- precedence over the source column in ORDER BY, so this sorted by the
-- POSITIVE rounded value ascending — i.e. smallest first. The "largest
-- expenses" list was returning the five *smallest* debits ($4.99, $4.00,
-- $1.00...) instead of the largest, and top_uncategorised returned $0.04 /
-- $0.11 rather than the known $5,408 transfer.
--
-- transfer_destinations had the same latent defect (`order by sum(-amount)
-- asc`), masked only because this household has just 4 transfer
-- destinations, all of which fit inside LIMIT 5. Fixed here too so it does
-- not silently surface once a household has more than five.
--
-- Smallest possible fix: the aliased value is already positive for debits,
-- so ordering by it DESC yields largest-first. Only the three ORDER BY
-- directions change; no other logic is touched.
create or replace function public.get_household_insight_facts(
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
    order by amount desc
    limit 5
  ),
  top_uncategorised as (
    select description, round(-amount, 2) as amount, occurred_at
    from scoped
    where is_this_month and direction = 'debit' and not is_transfer and is_uncategorized_default
    order by amount desc
    limit 5
  ),
  transfer_destinations as (
    select description, round(sum(-amount), 2) as amount, count(*) as txn_count
    from scoped
    where is_this_month and direction = 'debit' and is_transfer
    group by description
    order by sum(-amount) desc
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
