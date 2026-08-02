-- Accepting an invite needs to happen atomically and needs to read across
-- household_invites, households, and auth.users — none of which the
-- accepting user has RLS visibility into yet (they're not a member of
-- anything). Same SECURITY DEFINER pattern as is_household_member from
-- Milestone 2, for the same reason.

create function public.get_invite_preview(invite_token uuid)
returns table (household_name text, invited_email text, status text, expires_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select h.name, i.email, i.status, i.expires_at
  from household_invites i
  join households h on h.id = i.household_id
  where i.token = invite_token;
$$;

revoke execute on function public.get_invite_preview(uuid) from public;
grant execute on function public.get_invite_preview(uuid) to anon, authenticated;

create function public.accept_household_invite(invite_token uuid)
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
    update household_invites set status = 'expired' where id = v_invite.id;
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

revoke execute on function public.accept_household_invite(uuid) from public;
revoke execute on function public.accept_household_invite(uuid) from anon;
grant execute on function public.accept_household_invite(uuid) to authenticated;
