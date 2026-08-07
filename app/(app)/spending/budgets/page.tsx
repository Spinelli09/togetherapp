import Link from "next/link";

import {
  loadBudgetProgress,
  loadCategoryOptions,
  loadHouseholdBudgets,
} from "@/lib/actions/budgets";
import { createClient } from "@/lib/supabase/server";

import { Reveal, ProgressFill } from "../../reveal";
import { Label, quietLinkClass} from "../../ui";
import { SpendingTabs } from "../spending-tabs";
import { BudgetFields, RemoveBudgetButton } from "./budget-forms";

// Budgets answers one question: how are we tracking this month?
//
// The anchor is the aggregate remainder, not any individual budget — a
// couple wants "are we going to blow it" before "which line item". Budgets
// themselves become a calm list beneath it. Editing is progressive, via
// search param, so the screen you read every day is never a form.

function money(amount: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(amount);
}

function wholeMoney(amount: number) {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function firstOfCurrentMonthNZ(): string {
  // Matches the server-side month math in get_household_budget_progress
  // (Pacific/Auckland local calendar, not UTC).
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-01`;
}

function shiftMonth(monthStart: string, delta: number): string {
  const [year, month] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 10);
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
  searchParams: Promise<{ month?: string; focus?: string; new?: string; edit?: string }>;
}) {
  const { month, focus, new: isCreating, edit } = await searchParams;
  const monthStart = month && isValidMonthStart(month) ? month : firstOfCurrentMonthNZ();
  const monthQuery = `month=${monthStart}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const householdId = membership.household_id;
  const [progress, categoryOptions, budgets] = await Promise.all([
    loadBudgetProgress(householdId, monthStart),
    loadCategoryOptions(),
    loadHouseholdBudgets(householdId),
  ]);

  const rows = progress.budgets;
  const assignmentOf = (id: string) => budgets.find((b) => b.id === id);

  /* ── Creating ─────────────────────────────────────────────────────── */

  if (isCreating || rows.length === 0) {
    const isFirst = rows.length === 0 && !isCreating;
    return (
      <main className="mx-auto max-w-[40rem] px-6 pb-16 pt-24">
        <Reveal rise={false}>
          <SpendingTabs />
        </Reveal>
        <div className="mt-16">
          <Reveal index={1} rise={false}>
            <section>
              <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">
                {isFirst ? "Set a limit, stay ahead of it." : "A new budget"}
              </h1>
              {isFirst ? (
                <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted-foreground">
                  Pick something you spend on each month and give it a number. You&apos;ll both see
                  how it&apos;s tracking.
                </p>
              ) : null}

              <div className="mt-10">
                <BudgetFields
                  householdId={householdId}
                  categoryOptions={categoryOptions}
                  submitLabel="Start tracking"
                />
              </div>

              {rows.length > 0 ? (
                <p className="mt-10">
                  <Link
                    href={`/spending/budgets?${monthQuery}`}
                    className={quietLinkClass}
                  >
                    Never mind
                  </Link>
                </p>
              ) : null}
            </section>
          </Reveal>
        </div>
      </main>
    );
  }

  /* ── Editing ──────────────────────────────────────────────────────── */

  const focused = rows.find((r) => r.budgetId === focus);

  if (edit && focused) {
    return (
      <main className="mx-auto max-w-[40rem] px-6 pb-16 pt-24">
        <Reveal rise={false}>
          <SpendingTabs />
        </Reveal>
        <div className="mt-16">
          <Reveal index={1} rise={false}>
            <section>
              <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">
                {focused.name}
              </h1>
              <div className="mt-10">
                <BudgetFields
                  categoryOptions={categoryOptions}
                  budget={assignmentOf(focused.budgetId)}
                  defaultLimit={focused.monthlyLimit}
                  submitLabel="Save changes"
                />
              </div>
              <p className="mt-10">
                <Link
                  href={`/spending/budgets?${monthQuery}&focus=${focused.budgetId}`}
                  className={quietLinkClass}
                >
                  Never mind
                </Link>
              </p>
            </section>
          </Reveal>
        </div>
      </main>
    );
  }

  /* ── Tracking ─────────────────────────────────────────────────────── */

  const totalLimit = rows.reduce((sum, r) => sum + r.monthlyLimit, 0);
  const totalSpent = rows.reduce((sum, r) => sum + r.netSpent, 0);
  const left = totalLimit - totalSpent;
  const over = rows.filter((r) => r.netSpent > r.monthlyLimit);

  return (
    <main className="mx-auto max-w-[40rem] px-6 pb-16 pt-24">
      <Reveal rise={false}>
        <SpendingTabs />
      </Reveal>

      <div className="mt-16">
        <Reveal index={1} rise={false}>
          <section>
            <div className="flex items-baseline justify-between gap-4">
              <Label>{formatMonthLabel(monthStart)}</Label>
              {/* Quiet text, not bordered buttons — month navigation is
                  occasional and shouldn't outweigh the figure below it. */}
              <span className="-mr-3 flex shrink-0 items-center">
                <Link
                  href={`/spending/budgets?month=${shiftMonth(monthStart, -1)}`}
                  aria-label="Previous month"
                  className="-my-3 inline-flex size-11 items-center justify-center text-[0.9375rem] text-muted-foreground transition-colors hover:text-foreground active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  ‹
                </Link>
                <Link
                  href={`/spending/budgets?month=${shiftMonth(monthStart, 1)}`}
                  aria-label="Next month"
                  className="-my-3 inline-flex size-11 items-center justify-center text-[0.9375rem] text-muted-foreground transition-colors hover:text-foreground active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  ›
                </Link>
              </span>
            </div>

            {/* Anchor: the remainder across everything, at Home's hero scale. */}
            <p
              className={
                "mt-6 text-[4rem] font-semibold leading-[0.9] tracking-[-0.035em] tabular-nums sm:text-[4.5rem] " +
                (left < 0 ? "text-warning" : "text-foreground")
              }
            >
              {wholeMoney(Math.abs(left))}
            </p>

            <p
              className={
                "mt-4 text-[0.8125rem] leading-relaxed " +
                (over.length > 0 ? "text-warning" : "text-muted-foreground")
              }
            >
              {left < 0 ? "over" : "left"} across {rows.length} budget
              {rows.length === 1 ? "" : "s"}
              {over.length > 0 && left >= 0 ? ` · ${over[0].name} is over` : ""}
            </p>

            <p className="mt-1.5 text-[0.75rem] leading-relaxed text-muted-foreground/70">
              {money(totalSpent)} of {money(totalLimit)}
            </p>
          </section>
        </Reveal>
      </div>

      <div className="mt-16">
        <Reveal index={2}>
          <ul className="space-y-10">
            {rows.map((row) => {
              const isOver = row.netSpent > row.monthlyLimit;
              const isFocused = row.budgetId === focus;
              const remaining = row.monthlyLimit - row.netSpent;
              return (
                <li key={row.budgetId}>
                  <Link
                    href={
                      isFocused
                        ? `/spending/budgets?${monthQuery}`
                        : `/spending/budgets?${monthQuery}&focus=${row.budgetId}`
                    }
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="truncate text-[1.0625rem] leading-tight text-foreground">
                        {row.name}
                      </span>
                      <span
                        className={
                          "shrink-0 text-[1.0625rem] tabular-nums tracking-[-0.01em] " +
                          (isOver ? "text-warning" : "text-foreground")
                        }
                      >
                        {isOver
                          ? `${money(Math.abs(remaining))} over`
                          : `${money(remaining)} left`}
                      </span>
                    </div>
                    <div className="mt-4">
                      {/* Neutral until it needs attention: a budget filling
                          toward its limit is consumption, not achievement. */}
                      <ProgressFill
                        percent={row.percentUsed}
                        tone={isOver ? "warning" : "neutral"}
                      />
                    </div>
                    <p className="mt-1.5 text-[0.75rem] text-muted-foreground/70">
                      {money(row.netSpent)} of {money(row.monthlyLimit)}
                    </p>
                  </Link>

                  {isFocused ? (
                    <div className="mt-4 flex items-center gap-4">
                      <Link
                        href={`/spending/budgets?${monthQuery}&focus=${row.budgetId}&edit=1`}
                        className={quietLinkClass}
                      >
                        Edit
                      </Link>
                      <RemoveBudgetButton budgetId={row.budgetId} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>

      <Reveal index={3}>
        <p className="mt-16">
          <Link
            href={`/spending/budgets?${monthQuery}&new=1`}
            className="text-[0.9375rem] text-foreground underline underline-offset-4 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Add a budget
          </Link>
        </p>
      </Reveal>
    </main>
  );
}
