-- Revises Milestone 5's disconnect_bank_connection to soft-disconnect
-- instead of deleting the connection row: historical accounts and
-- transactions must survive a disconnect so budgeting/reporting survives
-- a later reconnect (Milestone 6 design doc §10). The Vault secret is
-- still deleted immediately - there's no reason to keep an encrypted
-- token around for a connection no longer in use.
create or replace function public.disconnect_bank_connection(p_connection_id uuid)
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

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;

  update bank_connections
  set status = 'disconnected',
      vault_secret_id = null
  where id = p_connection_id;
end;
$$;

-- get_bank_connection_token is now the single gate that prevents a
-- disconnected connection from ever being synced again: a NULL
-- vault_secret_id (set above) means there is nothing to decrypt, so this
-- raises a clear, specific error instead of returning NULL and letting a
-- downstream Akahu API call fail with a confusing error.
create or replace function public.get_bank_connection_token(p_connection_id uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_household_id uuid;
  v_status text;
  v_secret_id uuid;
  v_token text;
begin
  select household_id, status, vault_secret_id
  into v_household_id, v_status, v_secret_id
  from bank_connections
  where id = p_connection_id;

  if v_household_id is null then
    raise exception 'connection_not_found';
  end if;

  if not public.is_household_member(v_household_id) then
    raise exception 'not_authorized';
  end if;

  if v_status <> 'active' or v_secret_id is null then
    raise exception 'connection_not_active';
  end if;

  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where id = v_secret_id;

  return v_token;
end;
$$;
