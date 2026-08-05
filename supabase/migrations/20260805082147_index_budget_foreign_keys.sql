-- Performance advisor flagged these three FK columns as uncovered after
-- the Milestone 7 schema migrations. Cheap at this app's real data volumes
-- (a household has a handful of budgets; categories/category_aliases are
-- small reference tables) but standard practice for FK constraint-check
-- and reverse-lookup performance, so fixing rather than leaving a known
-- advisor finding unresolved.
create index budget_categories_category_id_idx on public.budget_categories (category_id);
create index budgets_created_by_idx on public.budgets (created_by);
create index category_aliases_category_id_idx on public.category_aliases (category_id);
