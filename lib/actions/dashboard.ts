"use server";

import { createClient } from "@/lib/supabase/server";

// Every loader in this file follows the same convention as the existing
// Milestone 5–8 actions: swallow the Supabase error into a returned field,
// never throw. The dashboard fetches all of these with Promise.all, which
// rejects wholesale if any promise rejects — so a throwing loader would
// take down the entire page instead of degrading one widget. See
// Milestone 9 design doc §9.

export type BalanceSummary = {
  // Active connections only. Disconnected connections keep their last
  // known balance (Milestone 6 soft-disconnect), which is frozen at
  // whatever it was when syncing stopped — including it in a figure
  // labelled "Total balance" would present stale data as current. See
  // design doc §3.1.
  totalBalance: number;
  disconnectedBalance: number;
  hasDisconnectedAccounts: boolean;
  accountCount: number;
  hasAnyConnection: boolean;
  hasConnectionError: boolean;
  lastSyncedAt: string | null;
  error?: string;
};

export async function loadBalanceSummary(
  householdId: string,
): Promise<BalanceSummary> {
  const empty: BalanceSummary = {
    totalBalance: 0,
    disconnectedBalance: 0,
    hasDisconnectedAccounts: false,
    accountCount: 0,
    hasAnyConnection: false,
    hasConnectionError: false,
    lastSyncedAt: null,
  };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bank_connections")
    .select("status, last_sync_at, bank_accounts(current_balance)")
    .eq("household_id", householdId);

  if (error || !data) {
    return { ...empty, error: "Couldn't load balances." };
  }

  let totalBalance = 0;
  let disconnectedBalance = 0;
  let accountCount = 0;
  let hasDisconnectedAccounts = false;
  let hasConnectionError = false;
  let lastSyncedAt: string | null = null;

  for (const connection of data) {
    const connectionTotal = connection.bank_accounts.reduce(
      (sum, account) => sum + account.current_balance,
      0,
    );

    if (connection.status === "disconnected") {
      disconnectedBalance += connectionTotal;
      if (connection.bank_accounts.length > 0) {
        hasDisconnectedAccounts = true;
      }
      continue;
    }

    // 'active' and 'error' both count toward the headline: an errored
    // connection's balance is as fresh as its last successful sync, and
    // the error is surfaced separately rather than silently zeroing it.
    if (connection.status === "error") {
      hasConnectionError = true;
    }

    totalBalance += connectionTotal;
    accountCount += connection.bank_accounts.length;

    if (
      connection.last_sync_at &&
      (lastSyncedAt === null || connection.last_sync_at > lastSyncedAt)
    ) {
      lastSyncedAt = connection.last_sync_at;
    }
  }

  return {
    totalBalance,
    disconnectedBalance,
    hasDisconnectedAccounts,
    accountCount,
    hasAnyConnection: data.length > 0,
    hasConnectionError,
    lastSyncedAt,
  };
}

export type MonthlySummary = {
  moneyIn: number;
  moneyOut: number;
  net: number;
  error?: string;
};

export async function loadMonthlySummary(
  householdId: string,
  monthStart: string,
): Promise<MonthlySummary> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_household_monthly_summary", {
    p_household_id: householdId,
    p_month_start: monthStart,
  });

  const row = data?.[0];

  if (error || !row) {
    return { moneyIn: 0, moneyOut: 0, net: 0, error: "Couldn't load this month's totals." };
  }

  return { moneyIn: row.money_in, moneyOut: row.money_out, net: row.net };
}

// Shared by the dashboard and anything else needing "the current month"
// in NZ local terms. Matches the Pacific/Auckland calendar the SQL
// functions truncate against, so the month shown and the month summed are
// always the same one — the same helper shape budgets/page.tsx already uses.
export async function currentMonthStartNZ(): Promise<string> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}-01`;
}
