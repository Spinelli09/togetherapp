-- Adds defaults to the cursor parameters so Supabase's generated
-- TypeScript types correctly mark them optional/nullable (they're
-- genuinely optional — omitted/null means "first page") instead of
-- requiring a value the caller may not have. Same function body,
-- unchanged.
create or replace function public.list_household_transactions(
  p_household_id uuid,
  p_before_occurred_at timestamptz default null,
  p_before_id uuid default null,
  p_limit int default 50
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
