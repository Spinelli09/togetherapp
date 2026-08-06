// Presentation-only widgets for the dashboard. Every one is a Server
// Component — no state, no event handlers, no client JS. See Milestone 9
// design doc §9: the dashboard has no mutations, so it needs no client
// components at all.
import Link from "next/link";

import type { BalanceSummary, MonthlySummary } from "@/lib/actions/dashboard";
import type { BudgetProgressRow } from "@/lib/actions/budgets";
import type { Goal } from "@/lib/actions/goals";
import type { InsightsResult } from "@/lib/actions/insights";
import type { TransactionRow } from "@/lib/actions/transactions";

import { InsightsNarrative } from "./insights-narrative";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(amount);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-NZ", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SectionHeading({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <Link
        href={href}
        className="text-sm text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {linkLabel}
      </Link>
    </div>
  );
}

function ProgressBar({ percent, isOver }: { percent: number; isOver: boolean }) {
  // Clamped for display only — the underlying figures are always shown
  // truthfully alongside, matching budget-list.tsx / goal-list.tsx.
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-accent">
      <div
        className={"h-full rounded-full " + (isOver ? "bg-destructive" : "bg-foreground")}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function BalanceHero({
  householdName,
  balance,
}: {
  householdName: string;
  balance: BalanceSummary;
}) {
  return (
    <section>
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {householdName}
      </p>
      <p className="mt-4 text-sm text-muted-foreground">Total balance</p>
      <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums text-foreground">
        {formatCurrency(balance.totalBalance)}
      </p>

      <p className="mt-2 text-xs text-muted-foreground">
        {balance.error
          ? balance.error
          : balance.lastSyncedAt
            ? `Across ${balance.accountCount} account${balance.accountCount === 1 ? "" : "s"} · Last synced ${formatDateTime(balance.lastSyncedAt)}`
            : `Across ${balance.accountCount} account${balance.accountCount === 1 ? "" : "s"} · Never synced`}
      </p>

      {balance.hasDisconnectedAccounts ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Plus {formatCurrency(balance.disconnectedBalance)} in disconnected accounts — no longer
          updating.
        </p>
      ) : null}

      {balance.hasConnectionError ? (
        <p className="mt-2 text-xs text-destructive">
          A bank connection needs attention —{" "}
          <Link href="/settings/banks" className="underline underline-offset-4">
            check your banks
          </Link>
          .
        </p>
      ) : null}
    </section>
  );
}

export function MonthlySummaryCard({
  summary,
  monthLabel,
}: {
  summary: MonthlySummary;
  monthLabel: string;
}) {
  return (
    <section>
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        This month · {monthLabel}
      </h2>

      {summary.error ? (
        <p className="mt-3 text-sm text-muted-foreground">{summary.error}</p>
      ) : (
        // Single column on phones — figures like $38,440.99 crowd badly in
        // three ~100px columns at 375px wide.
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <dt className="text-xs text-muted-foreground">Money in</dt>
            <dd className="mt-1 text-base font-medium tabular-nums text-foreground">
              {formatCurrency(summary.moneyIn)}
            </dd>
          </div>
          <div className="rounded-md border border-border p-3">
            <dt className="text-xs text-muted-foreground">Money out</dt>
            <dd className="mt-1 text-base font-medium tabular-nums text-foreground">
              {formatCurrency(summary.moneyOut)}
            </dd>
          </div>
          <div className="rounded-md border border-border p-3">
            <dt className="text-xs text-muted-foreground">Net</dt>
            <dd
              className={
                "mt-1 text-base font-medium tabular-nums " +
                (summary.net < 0 ? "text-destructive" : "text-foreground")
              }
            >
              {formatCurrency(summary.net)}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

export function InsightsWidget({
  insights,
  householdId,
  monthStart,
}: {
  insights: InsightsResult;
  householdId: string;
  monthStart: string;
}) {
  const { facts, observations, error } = insights;

  const toneClass = (tone: string) =>
    tone === "warning" ? "text-destructive" : "text-foreground";

  return (
    <section>
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Insights
      </h2>

      {error || !facts ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {error ?? "No insights available yet."}
        </p>
      ) : observations.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Not enough activity this month to say anything useful yet.
        </p>
      ) : (
        <>
          {/* The three-way split. Reporting a single "spent" figure would be
              misleading — a large share of this household's outflow is money
              moving between their own accounts. */}
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border p-3">
              <dt className="text-xs text-muted-foreground">Categorised spend</dt>
              <dd className="mt-1 text-base font-medium tabular-nums text-foreground">
                {formatCurrency(facts.categorised_spend)}
              </dd>
            </div>
            <div className="rounded-md border border-border p-3">
              <dt className="text-xs text-muted-foreground">Own transfers</dt>
              <dd className="mt-1 text-base font-medium tabular-nums text-foreground">
                {formatCurrency(facts.internal_transfers)}
              </dd>
            </div>
            <div className="rounded-md border border-border p-3">
              <dt className="text-xs text-muted-foreground">Uncategorised</dt>
              <dd className="mt-1 text-base font-medium tabular-nums text-foreground">
                {formatCurrency(facts.uncategorised_spend)}
              </dd>
            </div>
          </dl>

          <ul className="mt-4 space-y-2">
            {observations.map((observation, index) => (
              <li
                key={`${observation.kind}-${index}`}
                className={"text-sm leading-relaxed " + toneClass(observation.tone)}
              >
                {observation.text}
              </li>
            ))}
          </ul>

          {facts.top_expenses.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Largest expenses
              </p>
              <ul className="mt-2 space-y-1">
                {facts.top_expenses.map((expense) => (
                  <li
                    key={`${expense.description}-${expense.occurred_at}`}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="truncate text-foreground">
                      {expense.merchant_name ?? expense.description}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatCurrency(expense.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <InsightsNarrative householdId={householdId} monthStart={monthStart} />
        </>
      )}
    </section>
  );
}

export function BudgetsWidget({
  budgets,
  error,
}: {
  budgets: BudgetProgressRow[];
  error?: string;
}) {
  const overCount = budgets.filter((b) => b.netSpent > b.monthlyLimit).length;
  const totalLimit = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.netSpent, 0);

  return (
    <section>
      <SectionHeading title="Budgets" href="/budgets" linkLabel="View all →" />

      {error ? (
        <p className="mt-3 text-sm text-muted-foreground">{error}</p>
      ) : budgets.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No budgets yet —{" "}
          <Link href="/budgets" className="underline underline-offset-4">
            set one up
          </Link>{" "}
          to track spending.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground tabular-nums">
            {formatCurrency(totalSpent)} of {formatCurrency(totalLimit)}
            {overCount > 0 ? ` · ${overCount} over limit` : null}
          </p>
          <ul className="mt-3 space-y-3">
            {budgets.slice(0, 3).map((budget) => (
              <li key={budget.budgetId} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">{budget.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatCurrency(budget.netSpent)} / {formatCurrency(budget.monthlyLimit)}
                  </span>
                </div>
                <ProgressBar
                  percent={budget.percentUsed}
                  isOver={budget.netSpent > budget.monthlyLimit}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function GoalsWidget({ goals }: { goals: Goal[] }) {
  const activeGoals = goals.filter((g) => g.status === "active");
  const completedCount = goals.filter((g) => g.status === "completed").length;
  const shown = goals.filter((g) => g.status !== "archived");
  const totalSaved = shown.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalTarget = shown.reduce((sum, g) => sum + g.targetAmount, 0);

  return (
    <section>
      <SectionHeading title="Goals" href="/goals" linkLabel="View all →" />

      {shown.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No goals yet —{" "}
          <Link href="/goals" className="underline underline-offset-4">
            start saving
          </Link>{" "}
          toward something.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground tabular-nums">
            {formatCurrency(totalSaved)} of {formatCurrency(totalTarget)}
            {" · "}
            {activeGoals.length} active
            {completedCount > 0 ? ` · ${completedCount} completed` : null}
          </p>
          <ul className="mt-3 space-y-3">
            {shown.slice(0, 3).map((goal) => (
              <li key={goal.id} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">{goal.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                  </span>
                </div>
                <ProgressBar
                  percent={goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0}
                  isOver={false}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function RecentTransactionsWidget({
  transactions,
  error,
}: {
  transactions: TransactionRow[];
  error?: string;
}) {
  return (
    <section>
      <SectionHeading title="Recent transactions" href="/transactions" linkLabel="View all →" />

      {error ? (
        <p className="mt-3 text-sm text-muted-foreground">{error}</p>
      ) : transactions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing imported yet — try Sync now on{" "}
          <Link href="/settings/banks" className="underline underline-offset-4">
            your banks
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {transactions.map((transaction) => (
            <li
              key={transaction.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate text-foreground">
                  {transaction.merchant_name ?? transaction.description}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(transaction.occurred_at).toLocaleDateString("en-NZ", {
                    day: "numeric",
                    month: "short",
                  })}
                  {" · "}
                  {transaction.account_name}
                </p>
              </div>
              <p className="shrink-0 font-medium tabular-nums text-foreground">
                {transaction.direction === "debit" ? "−" : "+"}
                {formatCurrency(Math.abs(transaction.amount))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ConnectBankPrompt({ householdName }: { householdName: string }) {
  return (
    <section>
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {householdName}
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Connect a bank to get started
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Once a bank is connected, your balances, spending, budgets and goals all show up here.
      </p>
      <Link
        href="/settings/banks"
        className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Connect your bank
      </Link>
    </section>
  );
}
