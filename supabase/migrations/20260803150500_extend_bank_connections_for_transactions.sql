-- Tracks the transaction-sync window boundary separately from
-- last_sync_at (account-balance freshness) - the two concerns already
-- diverge in cadence (one is a simple "when did we last refresh", the
-- other is a strict, gap-free incremental cursor) and will diverge
-- further once scheduled/background sync exists.
alter table public.bank_connections
  add column last_transaction_synced_at timestamptz;

-- A disconnected connection has no token (see the soft-disconnect
-- change to disconnect_bank_connection in the next migration) - the row
-- itself now persists after disconnect instead of being deleted, so this
-- column must be able to represent "no secret" rather than always being
-- populated.
alter table public.bank_connections
  alter column vault_secret_id drop not null;
