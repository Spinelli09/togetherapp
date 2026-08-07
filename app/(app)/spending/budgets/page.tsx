import Link from "next/link";

import {
  loadBudgetProgress,
  loadCategoryOptions,
  loadHouseholdBudgets,
} from "@/lib/actions/budgets";
import { createClient } from "@/lib/supabase/server";

import { BudgetList } from "./budget-list";

function firstOfCurrentMonthNZ(): string {
  // Matches the server-side month math in get_household_budget_progress
  // (Pacific/Auckland local calendar, not UTC) — see Milestone 7 design
  // doc §5/§0.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}-01`;
}

function shiftMonth(monthStart: string, delta: number): string {
  const [year, month] = monthStart.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return date.toISOString().slice(0, 10);
}

function formatMonthLabel(monthStart: string): string {
  const [year, month] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-NZ", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function isValidMonthStart(value: string): boolean {
  return /^\d{4}-\d{2}-01$/.test(value);
}

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const monthStart = month && isValidMonthStart(month) ? month : firstOfCurrentMonthNZ();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return null;
  }

  const [progress, categoryOptions, budgets] = await Promise.all([
    loadBudgetProgress(membership.household_id, monthStart),
    loadCategoryOptions(),
    loadHouseholdBudgets(membership.household_id),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-12">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        ← Back to dashboard
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Budgets
      </h1>

      <div className="mt-6 flex items-center justify-between">
        <Link
          href={`/budgets?month=${shiftMonth(monthStart, -1)}`}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← Previous
        </Link>
        <p className="text-sm font-medium text-foreground">{formatMonthLabel(monthStart)}</p>
        <Link
          href={`/budgets?month=${shiftMonth(monthStart, 1)}`}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Next →
        </Link>
      </div>

      <section className="mt-6">
        <BudgetList
          householdId={membership.household_id}
          initialProgress={progress}
          budgets={budgets}
          categoryOptions={categoryOptions}
        />
      </section>
    </main>
  );
}
