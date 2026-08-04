-- Batch-upserts one page of transactions and advances the connection's
-- sync boundary, atomically. Mirrors record_bank_sync's shape from
-- Milestone 5 (jsonb_array_elements + ON CONFLICT), extended with:
--   - a FOR UPDATE lock on the connection row, so two overlapping syncs
--     for the same connection (a double-click, or connect + immediate
--     manual sync) can't interleave and produce a confusing double-
--     advance of the sync boundary;
--   - resolving each transaction's local account_id via a join on
--     external_account_id, rather than requiring the caller to resolve
--     it - a transaction that doesn't match any of this connection's
--     known accounts is silently skipped (inner join), consistent with
--     "one malformed/unattributable record shouldn't block the rest of
--     a sync";
--   - an id/created_at-preserving upsert: ON CONFLICT updates every
--     normalized field and raw_payload, but never touches id or
--     created_at, so a transaction's identity is stable across every
--     future re-sync even if Akahu later changes it (see design doc §5).
create function public.record_transaction_sync(
  p_connection_id uuid,
  p_transactions jsonb,
  p_synced_up_to timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  select household_id into v_household_id
  from bank_connections
  where id = p_connection_id
  for update;

  if v_household_id is null then
    raise exception 'connection_not_found';
  end if;

  if not public.is_household_member(v_household_id) then
    raise exception 'not_authorized';
  end if;

  insert into transactions (
    household_id, account_id, external_transaction_id, occurred_at,
    amount, description, merchant_name, provider_category, status,
    raw_payload, provider_updated_at, updated_at
  )
  select
    v_household_id,
    ba.id,
    t->>'external_transaction_id',
    (t->>'occurred_at')::timestamptz,
    (t->>'amount')::numeric,
    t->>'description',
    t->>'merchant_name',
    t->>'provider_category',
    coalesce(t->>'status', 'posted'),
    t->'raw_payload',
    nullif(t->>'provider_updated_at', '')::timestamptz,
    now()
  from jsonb_array_elements(p_transactions) as t
  join bank_accounts ba
    on ba.connection_id = p_connection_id
    and ba.external_account_id = t->>'external_account_id'
  on conflict (account_id, external_transaction_id) do update
  set occurred_at = excluded.occurred_at,
      amount = excluded.amount,
      description = excluded.description,
      merchant_name = excluded.merchant_name,
      provider_category = excluded.provider_category,
      status = excluded.status,
      raw_payload = excluded.raw_payload,
      provider_updated_at = excluded.provider_updated_at,
      updated_at = excluded.updated_at;

  -- Only ever moves forward - guards against an out-of-order call (e.g.
  -- a slow retry landing after a newer sync already advanced it)
  -- regressing the boundary and re-fetching a window that's already done.
  if p_synced_up_to is not null then
    update bank_connections
    set last_transaction_synced_at = p_synced_up_to
    where id = p_connection_id
      and (last_transaction_synced_at is null or last_transaction_synced_at < p_synced_up_to);
  end if;
end;
$$;

revoke execute on function public.record_transaction_sync(uuid, jsonb, timestamptz) from public;
revoke execute on function public.record_transaction_sync(uuid, jsonb, timestamptz) from anon;
grant execute on function public.record_transaction_sync(uuid, jsonb, timestamptz) to authenticated;
