-- Milestone 7 design doc §4/§6. security_invoker = true is not optional
-- here — verified against the Postgres 17 docs that the default
-- (security_invoker = false) evaluates transactions' RLS policy as the
-- VIEW OWNER, not the querying user, which would leak every household's
-- transactions to every authenticated user. With security_invoker = true
-- this view behaves, per the docs' own wording, "as if the base relations
-- had been referenced directly from the query" — i.e. exactly as safe as
-- querying transactions directly. Re-verified empirically in this
-- migration's SQL verification pass, not just trusted from the docs.
--
-- left join lateral (not a plain cross join) for the Uncategorized
-- fallback: a cross join to a subquery that ever returned zero rows would
-- silently drop every row from this view. left join lateral degrades to
-- category_id = null instead — visibly wrong rather than silently wrong —
-- if the single-row invariant enforced by categories_single_uncategorized_default
-- were ever violated.
create view public.transaction_category_resolution
  with (security_invoker = true) as
select
  t.id as transaction_id,
  t.household_id,
  t.occurred_at,
  t.amount,
  t.direction,
  t.deleted_at,
  t.provider_category,
  coalesce(ca.category_id, u.id) as category_id
from public.transactions t
left join public.category_aliases ca
  on ca.akahu_category_id = t.raw_payload -> 'category' ->> '_id'
left join lateral (
  select id from public.categories where is_uncategorized_default limit 1
) u on true;
