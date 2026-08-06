import Link from "next/link";

import { signOut } from "@/lib/actions/auth";
import { loadBudgetProgress } from "@/lib/actions/budgets";
import {
  currentMonthStartNZ,
  loadBalanceSummary,
  loadMonthlySummary,
} from "@/lib/actions/dashboard";
import { loadHouseholdGoals } from "@/lib/actions/goals";
import { loadInsights } from "@/lib/actions/insights";
import { loadRecentTransactions } from "@/lib/actions/transactions";
import { createClient } from "@/lib/supabase/server";

import {
  BalanceHero,
  BudgetsWidget,
  ConnectBankPrompt,
  GoalsWidget,
  InsightsWidget,
  MonthlySummaryCard,
  RecentTransactionsWidget,
} from "./dashboard-widgets";

const RECENT_TRANSACTION_COUNT = 5;

function formatMonthLabel(monthStart: string): string {
  const [year, month] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-NZ", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, households(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return null;
  }

  const householdId = membership.household_id;
  const householdName = membership.households?.name ?? "your household";
  const monthStart = await currentMonthStartNZ();

  // Fetched concurrently — wall-clock is the slowest query, not the sum.
  // Every loader returns its error in-band rather than throwing, so a
  // single failing widget degrades on its own instead of rejecting this
  // Promise.all and taking down the page. See design doc §9.
  const [balance, monthly, budgetProgress, goals, recent, insights] = await Promise.all([
    loadBalanceSummary(householdId),
    loadMonthlySummary(householdId, monthStart),
    loadBudgetProgress(householdId, monthStart),
    loadHouseholdGoals(householdId),
    loadRecentTransactions(householdId, RECENT_TRANSACTION_COUNT),
    loadInsights(householdId, monthStart),
  ]);

  // A household with no bank connected has no balances, no transactions,
  // and therefore nothing meaningful in any downstream widget — showing
  // five empty cards is noise, not information (design doc §7).
  if (!balance.hasAnyConnection && !balance.error) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
        <ConnectBankPrompt householdName={householdName} />
        <DashboardFooter />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <div className="space-y-10">
        <BalanceHero householdName={householdName} balance={balance} />
        <MonthlySummaryCard summary={monthly} monthLabel={formatMonthLabel(monthStart)} />
        <InsightsWidget insights={insights} householdId={householdId} monthStart={monthStart} />
        <BudgetsWidget budgets={budgetProgress.budgets} error={budgetProgress.error} />
        <GoalsWidget goals={goals} />
        <RecentTransactionsWidget transactions={recent.transactions} error={recent.error} />
      </div>
      <DashboardFooter />
    </main>
  );
}

function DashboardFooter() {
  return (
    <footer className="mt-12 flex flex-wrap items-center gap-4 border-t border-border pt-6">
      <Link
        href="/settings/household"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Manage household
      </Link>
      <Link
        href="/settings/banks"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Banks
      </Link>
      <form action={signOut} className="ml-auto">
        <button
          type="submit"
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Sign out
        </button>
      </form>
    </footer>
  );
}
