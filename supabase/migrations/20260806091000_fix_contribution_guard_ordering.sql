-- Bug found during Milestone 8 verification: the negative-contribution
-- guard was evaluated AFTER the update, using the RETURNING value. That
-- meant the goals_current_amount_check constraint fired first and the
-- caller received a raw Postgres constraint-violation message instead of
-- the legible 'contribution_exceeds_balance' the design specified
-- (design doc §11 — the function-level raise is what produces a usable
-- error; the CHECK constraint is only the last line of defence).
--
-- Data integrity was never at risk (the constraint correctly rejected the
-- write and the transaction rolled back), but lib/actions/goals.ts maps
-- 'contribution_exceeds_balance' to a specific user-facing message, and
-- that mapping could never have matched.
--
-- Fix: compute the resulting amount from the already-locked row (the
-- SELECT ... FOR UPDATE above holds the row for the transaction, so this
-- read-then-write is race-free) and raise before attempting the update.
-- Only the guard's position changes; every other behaviour — atomic
-- increment, one-directional completion, archived guard — is unchanged.
create or replace function public.record_goal_contribution(
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
  v_current_amount numeric;
  v_new_amount numeric;
begin
  select household_id, status, target_amount, current_amount
  into v_household_id, v_status, v_target_amount, v_current_amount
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

  v_new_amount := v_current_amount + p_amount;

  if v_new_amount < 0 then
    raise exception 'contribution_exceeds_balance';
  end if;

  update goals
  set current_amount = v_new_amount,
      updated_at = now()
  where id = p_goal_id;

  if v_status = 'active' and v_new_amount >= v_target_amount then
    update goals
    set status = 'completed',
        completed_at = now()
    where id = p_goal_id;
  end if;
end;
$$;
