-- Milestone 7 design doc §7. Same conventions as every Milestone 5/6
-- privileged function: plpgsql, security definer, set search_path =
-- public, granted to authenticated only.
create function public.create_budget(
  p_household_id uuid,
  p_name text,
  p_monthly_limit numeric,
  p_category_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_budget_id uuid;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not_a_household_member';
  end if;

  if p_category_ids is null or array_length(p_category_ids, 1) is null then
    raise exception 'at_least_one_category_required';
  end if;

  insert into budgets (household_id, name, monthly_limit, created_by)
  values (p_household_id, p_name, p_monthly_limit, auth.uid())
  returning id into v_budget_id;

  insert into budget_categories (budget_id, category_id)
  select v_budget_id, cat_id
  from unnest(p_category_ids) as cat_id;

  return v_budget_id;
end;
$$;

revoke execute on function public.create_budget(uuid, text, numeric, uuid[]) from public;
revoke execute on function public.create_budget(uuid, text, numeric, uuid[]) from anon;
grant execute on function public.create_budget(uuid, text, numeric, uuid[]) to authenticated;

create function public.update_budget(
  p_budget_id uuid,
  p_name text,
  p_monthly_limit numeric,
  p_category_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  select household_id into v_household_id from budgets where id = p_budget_id;

  if v_household_id is null then
    raise exception 'budget_not_found';
  end if;

  if not public.is_household_member(v_household_id) then
    raise exception 'not_authorized';
  end if;

  if p_category_ids is null or array_length(p_category_ids, 1) is null then
    raise exception 'at_least_one_category_required';
  end if;

  update budgets
  set name = p_name,
      monthly_limit = p_monthly_limit,
      updated_at = now()
  where id = p_budget_id;

  delete from budget_categories where budget_id = p_budget_id;

  insert into budget_categories (budget_id, category_id)
  select p_budget_id, cat_id
  from unnest(p_category_ids) as cat_id;
end;
$$;

revoke execute on function public.update_budget(uuid, text, numeric, uuid[]) from public;
revoke execute on function public.update_budget(uuid, text, numeric, uuid[]) from anon;
grant execute on function public.update_budget(uuid, text, numeric, uuid[]) to authenticated;

create function public.deactivate_budget(p_budget_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  select household_id into v_household_id from budgets where id = p_budget_id;

  if v_household_id is null then
    raise exception 'budget_not_found';
  end if;

  if not public.is_household_member(v_household_id) then
    raise exception 'not_authorized';
  end if;

  update budgets
  set is_active = false,
      updated_at = now()
  where id = p_budget_id;
end;
$$;

revoke execute on function public.deactivate_budget(uuid) from public;
revoke execute on function public.deactivate_budget(uuid) from anon;
grant execute on function public.deactivate_budget(uuid) to authenticated;
