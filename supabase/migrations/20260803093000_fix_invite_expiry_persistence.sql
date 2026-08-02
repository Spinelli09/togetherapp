-- Bug found in live testing: `raise exception` aborts the whole calling
-- transaction, which silently rolled back the `update ... status =
-- 'expired'` a few lines earlier in accept_household_invite — the
-- rejection worked correctly, but the row was left status='pending'
-- forever, which would then wrongly block re-inviting that email (the
-- partial unique index only excludes non-'pending' rows).
--
-- Fix: stop attempting the doomed update inside the exception path, and
-- instead sweep stale invites in their own successful (non-raising) call,
-- invoked before creating a new invite.

create or replace function public.accept_household_invite(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_caller_email text;
  v_display_name text;
begin
  select id, household_id, email, status, expires_at
  into v_invite
  from household_invites
  where token = invite_token
  for update;

  if not found then
    raise exception 'invite_not_found';
  end if;

  if v_invite.status = 'accepted' then
    raise exception 'invite_already_accepted';
  end if;

  if v_invite.status = 'expired' or v_invite.expires_at < now() then
    raise exception 'invite_expired';
  end if;

  select email into v_caller_email from auth.users where id = auth.uid();

  if v_caller_email is null or lower(v_caller_email) <> lower(v_invite.email) then
    raise exception 'email_mismatch';
  end if;

  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'already_in_household';
  end if;

  v_display_name := split_part(v_caller_email, '@', 1);

  insert into household_members (household_id, user_id, display_name, role)
  values (v_invite.household_id, auth.uid(), v_display_name, 'member');

  update household_invites set status = 'accepted' where id = v_invite.id;

  return v_invite.household_id;
end;
$$;

-- Marks this household's own past-expiry pending invites as expired.
-- No exceptions raised, so this always commits — called before creating
-- a new invite so a stale row never blocks re-inviting the same email.
create function public.expire_stale_household_invites(target_household_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update household_invites
  set status = 'expired'
  where household_id = target_household_id
    and status = 'pending'
    and expires_at < now();
$$;

revoke execute on function public.expire_stale_household_invites(uuid) from public;
grant execute on function public.expire_stale_household_invites(uuid) to authenticated;
