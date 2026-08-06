-- Milestone 8 design doc §4. Same conventions as every existing
-- privileged function: plpgsql, security definer, set search_path =
-- public, granted to authenticated only. Any household member can
-- manage goals — no owner-only gate, mirrors create_budget/update_budget
-- (see design doc §2), not disconnect_bank_connection's creator-only
-- restriction, which has no analogue here.
create function public.create_goal(
  p_household_id uuid,
  p_name text,
  p_target_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_goal_id uuid;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not_a_household_member';
  end if;

  insert into goals (household_id, name, target_amount, created_by)
  values (p_household_id, p_name, p_target_amount, auth.uid())
  returning id into v_goal_id;

  return v_goal_id;
end;
$$;

revoke execute on function public.create_goal(uuid, text, numeric) from public;
revoke execute on function public.create_goal(uuid, text, numeric) from anon;
grant execute on function public.create_goal(uuid, text, numeric) to authenticated;

-- Edits name/target only — never touches current_amount or status. See
-- design doc §8.5: editing target_amount below current_amount does not
-- retroactively evaluate completion; only record_goal_contribution does.
create function public.update_goal(
  p_goal_id uuid,
  p_name text,
  p_target_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_status text;
begin
  select household_id, status into v_household_id, v_status
  from goals
  where id = p_goal_id;

  if v_household_id is null then
    raise exception 'goal_not_found';
  end if;

  if not public.is_household_member(v_household_id) then
    raise exception 'not_authorized';
  end if;

  if v_status = 'archived' then
    raise exception 'goal_archived';
  end if;

  update goals
  set name = p_name,
      target_amount = p_target_amount,
      updated_at = now()
  where id = p_goal_id;
end;
$$;

revoke execute on function public.update_goal(uuid, text, numeric) from public;
revoke execute on function public.update_goal(uuid, text, numeric) from anon;
grant execute on function public.update_goal(uuid, text, numeric) to authenticated;

-- Atomic increment (current_amount = current_amount + p_amount in a
-- single UPDATE), not an absolute set — design doc §1.3. This is what
-- makes concurrent contributions from both household members safe:
-- Postgres serializes the UPDATE per-row automatically, so two
-- concurrent calls both land correctly regardless of interleaving,
-- with no explicit locking needed (contrast record_transaction_sync's
-- FOR UPDATE, which solves a different problem — an out-of-order
-- boundary advance — not applicable here).
--
-- p_amount may be negative (a correction/withdrawal). Completion is
-- one-directional (design doc §1.2): once current_amount reaches
-- target_amount and status flips to 'completed', a later negative
-- contribution that drops current_amount back below target does NOT
-- revert status to 'active'. A contribution to an already-completed
-- goal is deliberately allowed to keep accumulating (§8.4) — no guard
-- against that case.
create function public.record_goal_contribution(
  p_goal_id uuid,
  p_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_status text;
  v_target_amount numeric;
  v_new_amount numeric;
begin
  select household_id, status, target_amount
  into v_household_id, v_status, v_target_amount
  from goals
  where id = p_goal_id
  for update;

  if v_household_id is null then
    raise exception 'goal_not_found';
  end if;

  if not public.is_household_member(v_household_id) then
    raise exception 'not_authorized';
  end if;

  if v_status = 'archived' then
    raise exception 'goal_archived';
  end if;

  update goals
  set current_amount = current_amount + p_amount,
      updated_at = now()
  where id = p_goal_id
  returning current_amount into v_new_amount;

  if v_new_amount < 0 then
    raise exception 'contribution_exceeds_balance';
  end if;

  if v_status = 'active' and v_new_amount >= v_target_amount then
    update goals
    set status = 'completed',
        completed_at = now()
    where id = p_goal_id;
  end if;
end;
$$;

revoke execute on function public.record_goal_contribution(uuid, numeric) from public;
revoke execute on function public.record_goal_contribution(uuid, numeric) from anon;
grant execute on function public.record_goal_contribution(uuid, numeric) to authenticated;

-- Soft: preserves the row and history, matches deactivate_budget's
-- precedent exactly. No reactivate function, same as budgets.
create function public.archive_goal(p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  select household_id into v_household_id from goals where id = p_goal_id;

  if v_household_id is null then
    raise exception 'goal_not_found';
  end if;

  if not public.is_household_member(v_household_id) then
    raise exception 'not_authorized';
  end if;

  update goals
  set status = 'archived',
      updated_at = now()
  where id = p_goal_id;
end;
$$;

revoke execute on function public.archive_goal(uuid) from public;
revoke execute on function public.archive_goal(uuid) from anon;
grant execute on function public.archive_goal(uuid) to authenticated;
