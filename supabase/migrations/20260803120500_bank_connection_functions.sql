-- Every function here is SECURITY DEFINER for the same reason as
-- Milestone 2/4's helpers: the caller's own RLS-scoped session can never
-- see vault.secrets directly (it isn't in an exposed API schema, and
-- shouldn't be), so reading/writing the encrypted token has to happen
-- inside a function that runs with the owner's elevated privileges. Each
-- function still enforces its own authorization check internally —
-- SECURITY DEFINER bypasses RLS, not authorization.

-- Creates the encrypted secret and the connection row atomically: if the
-- insert fails, the vault secret is rolled back with it (same
-- transaction), so there's no path to an orphaned secret.
create function public.connect_bank_account(
  p_household_id uuid,
  p_provider text,
  p_institution text,
  p_token text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret_id uuid;
  v_connection_id uuid;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not_a_household_member';
  end if;

  v_secret_id := vault.create_secret(p_token, gen_random_uuid()::text, 'bank connection token');

  insert into bank_connections (household_id, connected_by, provider, institution, vault_secret_id)
  values (p_household_id, auth.uid(), p_provider, p_institution, v_secret_id)
  returning id into v_connection_id;

  return v_connection_id;
end;
$$;

revoke execute on function public.connect_bank_account(uuid, text, text, text) from public;
revoke execute on function public.connect_bank_account(uuid, text, text, text) from anon;
grant execute on function public.connect_bank_account(uuid, text, text, text) to authenticated;

-- Returns the decrypted token so an Edge Function can call the provider's
-- API. Callable by any member of the connection's household (sync is a
-- shared action — see Settings UI), not just the member who connected it.
-- The token itself must never be returned to a browser; only Edge
-- Functions should ever call this.
create function public.get_bank_connection_token(p_connection_id uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_household_id uuid;
  v_secret_id uuid;
  v_token text;
begin
  select household_id, vault_secret_id into v_household_id, v_secret_id
  from bank_connections
  where id = p_connection_id;

  if v_household_id is null then
    raise exception 'connection_not_found';
  end if;

  if not public.is_household_member(v_household_id) then
    raise exception 'not_authorized';
  end if;

  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where id = v_secret_id;

  return v_token;
end;
$$;

revoke execute on function public.get_bank_connection_token(uuid) from public;
revoke execute on function public.get_bank_connection_token(uuid) from anon;
grant execute on function public.get_bank_connection_token(uuid) to authenticated;

-- Upserts synced accounts and stamps last_sync_at, in one transaction.
-- Callable by any household member (matches get_bank_connection_token's
-- shared-sync model).
create function public.record_bank_sync(p_connection_id uuid, p_accounts jsonb)
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
  where id = p_connection_id;

  if v_household_id is null then
    raise exception 'connection_not_found';
  end if;

  if not public.is_household_member(v_household_id) then
    raise exception 'not_authorized';
  end if;

  insert into bank_accounts (
    connection_id, external_account_id, account_name, account_type,
    currency, current_balance, available_balance, last_synced_at
  )
  select
    p_connection_id,
    a->>'external_account_id',
    a->>'account_name',
    a->>'account_type',
    a->>'currency',
    (a->>'current_balance')::numeric,
    nullif(a->>'available_balance', '')::numeric,
    now()
  from jsonb_array_elements(p_accounts) as a
  on conflict (connection_id, external_account_id) do update
  set account_name = excluded.account_name,
      account_type = excluded.account_type,
      currency = excluded.currency,
      current_balance = excluded.current_balance,
      available_balance = excluded.available_balance,
      last_synced_at = excluded.last_synced_at;

  update bank_connections
  set last_sync_at = now(), status = 'active'
  where id = p_connection_id;
end;
$$;

revoke execute on function public.record_bank_sync(uuid, jsonb) from public;
revoke execute on function public.record_bank_sync(uuid, jsonb) from anon;
grant execute on function public.record_bank_sync(uuid, jsonb) to authenticated;

-- Marks a connection as errored (e.g. Akahu rejected the token as
-- revoked/expired during a sync attempt) without tearing it down, so the
-- owner sees a clear status instead of a silently stale connection.
create function public.mark_bank_connection_error(p_connection_id uuid)
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
  where id = p_connection_id;

  if v_household_id is null then
    raise exception 'connection_not_found';
  end if;

  if not public.is_household_member(v_household_id) then
    raise exception 'not_authorized';
  end if;

  update bank_connections set status = 'error' where id = p_connection_id;
end;
$$;

revoke execute on function public.mark_bank_connection_error(uuid) from public;
revoke execute on function public.mark_bank_connection_error(uuid) from anon;
grant execute on function public.mark_bank_connection_error(uuid) to authenticated;

-- Disconnect is intentionally scoped to the connecting member only,
-- matching the architecture's stated per-partner ownership model — this
-- is a more consequential action than sync, so it isn't shared.
create function public.disconnect_bank_connection(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_connected_by uuid;
  v_secret_id uuid;
begin
  select connected_by, vault_secret_id into v_connected_by, v_secret_id
  from bank_connections
  where id = p_connection_id;

  if v_connected_by is null then
    raise exception 'connection_not_found';
  end if;

  if v_connected_by <> auth.uid() then
    raise exception 'not_authorized';
  end if;

  delete from bank_connections where id = p_connection_id;
  delete from vault.secrets where id = v_secret_id;
end;
$$;

revoke execute on function public.disconnect_bank_connection(uuid) from public;
revoke execute on function public.disconnect_bank_connection(uuid) from anon;
grant execute on function public.disconnect_bank_connection(uuid) to authenticated;
