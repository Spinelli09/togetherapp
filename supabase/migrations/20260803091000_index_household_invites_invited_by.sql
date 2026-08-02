-- Flagged by the performance advisor after the previous migration: the
-- invited_by foreign key had no covering index.
create index household_invites_invited_by_idx on public.household_invites (invited_by);
