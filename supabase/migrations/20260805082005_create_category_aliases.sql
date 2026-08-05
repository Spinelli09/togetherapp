-- Milestone 7 design doc §3/§14 (Phase A) — schema only, deliberately no
-- seed rows here. Keyed on Akahu's stable NZFCC category id
-- (category._id, read out of transactions.raw_payload at query time — see
-- the resolution view in the next migration), not the display-name text,
-- since both fields are gated by the identical enrichment permission per
-- the design doc's verification, so there is no availability trade-off to
-- preferring the id.
--
-- Seed rows are deferred to a later migration until after Phase B: a real
-- Akahu sync, followed by inspecting the actual payload returned, so the
-- seed data reflects verified provider values rather than assumptions.
create table public.category_aliases (
  akahu_category_id text primary key,
  category_id uuid not null references public.categories (id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.category_aliases enable row level security;

create policy "Authenticated users can view category aliases" on public.category_aliases
  for select to authenticated using (true);
