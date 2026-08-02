-- pgcrypto is already installed on this project as part of Supabase's
-- standard bootstrap (alongside uuid-ossp and supabase_vault), so this
-- is a no-op today. Declared explicitly anyway so a fresh `db reset` is
-- fully reproducible from migrations alone, independent of what a given
-- Postgres image happens to ship pre-installed.
create extension if not exists pgcrypto with schema extensions;
