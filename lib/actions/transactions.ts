"use server";

import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 50;

export type TransactionRow = {
  id: string;
  occurred_at: string;
  description: string;
  merchant_name: string | null;
  amount: number;
  // Nullable to match the generated column's inferred type — in practice
  // it's never null (amount, which it's derived from, is NOT NULL), but
  // the type shouldn't claim a guarantee Postgres's own type inference
  // doesn't make.
  direction: string | null;
  account_name: string;
};

export type TransactionPage = {
  transactions: TransactionRow[];
  nextCursor: { occurredAt: string; id: string } | null;
  error?: string;
};

// Keyset (cursor) pagination, not offset/limit — see Milestone 6 design
// doc §6b. Calls list_household_transactions rather than expressing the
// (occurred_at, id) < (X, Y) comparison via the query builder's .or() —
// verification found .or() compiles to a post-scan Filter that scales
// with cursor depth, not a proper index range condition (confirmed via
// EXPLAIN ANALYZE: ~5ms and 20,001 rows filtered at a 20,000-row-deep
// cursor). The RPC gets the true depth-independent plan already proven
// via raw SQL (~0.3ms regardless of depth). RLS still applies — the
// function is SECURITY INVOKER, not DEFINER.
export async function loadTransactionPage(
  householdId: string,
  cursor: { occurredAt: string; id: string } | null,
): Promise<TransactionPage> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("list_household_transactions", {
    p_household_id: householdId,
    p_before_occurred_at: cursor?.occurredAt,
    p_before_id: cursor?.id,
    p_limit: PAGE_SIZE,
  });

  if (error || !data) {
    // Keep the same cursor on failure (not null) so "Load more" remains
    // a valid retry, rather than being silently mistaken for reaching
    // the end of the list.
    return { transactions: [], nextCursor: cursor, error: "Couldn't load more transactions." };
  }

  const last = data[data.length - 1];
  const nextCursor =
    data.length === PAGE_SIZE && last
      ? { occurredAt: last.occurred_at, id: last.id }
      : null;

  return { transactions: data, nextCursor };
}
