// The answer to "how did we do this month?" — one figure, one sentence,
// everything else demoted. Previously this was six stacked sections of
// equal weight, which is what made Spending read as an analytics dashboard
// rather than an answer.
//
// Server Component. The only client code reached from here is the optional
// narrative button.
import type { MonthlySummary } from "@/lib/actions/dashboard";
import type { InsightsResult } from "@/lib/actions/insights";

import { InsightsNarrative } from "../insights-narrative";
import { Label, cleanDescription } from "../ui";

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

export function SpendingSummary({
  monthly,
  monthLabel,
  insights,
  householdId,
  monthStart,
}: {
  monthly: MonthlySummary;
  monthLabel: string;
  insights: InsightsResult;
  householdId: string;
  monthStart: string;
}) {
  const { facts, observations } = insights;

  if (!facts) {
    return (
      <section>
        <Label>{monthLabel}</Label>
        <p className="mt-6 text-[0.9375rem] text-muted-foreground">
          {insights.error ?? "Nothing to summarise yet."}
        </p>
      </section>
    );
  }

  // The month-over-month comparison already exists as a written headline —
  // reusing it avoids recomputing the same percentage in a second place.
  const trend = observations.find((o) => o.kind === "spending");
  const rest = observations.filter((o) => o !== trend).slice(0, 3);

  const aside: string[] = [];
  if (facts.uncategorised_spend > 0) {
    aside.push(`${wholeMoney(facts.uncategorised_spend)} uncategorised`);
  }
  if (facts.internal_transfers > 0) {
    aside.push(`${wholeMoney(facts.internal_transfers)} between your accounts`);
  }

  return (
    <section>
      <Label>{monthLabel}</Label>

      {/* The anchor is *categorised* spend, not total outflow. Leading with
          money-out would count transfers between their own accounts as
          spending, which is plainly wrong — the excluded figures are stated
          directly beneath rather than hidden. */}
      <p className="mt-6 text-[4rem] font-semibold leading-[0.9] tracking-[-0.035em] tabular-nums text-foreground sm:text-[4.5rem]">
        {wholeMoney(facts.categorised_spend)}
      </p>

      <p
        className={
          "mt-4 text-[0.8125rem] leading-relaxed " +
          (trend?.tone === "warning" ? "text-warning" : "text-muted-foreground")
        }
      >
        spent{trend ? ` · ${trend.headline.replace(/\.$/, "").toLowerCase()}` : ""}
      </p>

      {aside.length > 0 ? (
        <p className="mt-1.5 text-[0.75rem] leading-relaxed text-muted-foreground/70">
          {aside.join(" · ")}
        </p>
      ) : null}

      {!monthly.error ? (
        <p className="mt-1.5 text-[0.75rem] leading-relaxed text-muted-foreground/70">
          {money(monthly.moneyIn)} in · {money(monthly.net)} net
        </p>
      ) : null}

      {rest.length > 0 ? (
        <ul className="mt-10 space-y-4">
          {rest.map((observation, index) => (
            <li
              key={`${observation.kind}-${index}`}
              className={
                "text-[0.9375rem] leading-relaxed " +
                (observation.tone === "warning" ? "text-warning" : "text-muted-foreground")
              }
            >
              {observation.headline}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6">
        <InsightsNarrative householdId={householdId} monthStart={monthStart} />
      </div>
    </section>
  );
}

// Kept separate from the summary so the eye reads "how did we do" and
// "what was biggest" as two questions, not one block. Three, not five —
// the full ledger sits directly below.
export function LargestThisMonth({ insights }: { insights: InsightsResult }) {
  const expenses = insights.facts?.top_expenses.slice(0, 3) ?? [];
  if (expenses.length === 0) return null;

  return (
    <section>
      <Label>Largest this month</Label>
      <ul className="mt-6 space-y-6">
        {expenses.map((expense) => (
          <li
            key={`${expense.description}-${expense.occurred_at}`}
            className="flex items-baseline justify-between gap-4"
          >
            <span className="min-w-0 truncate text-[1.0625rem] leading-tight text-foreground">
              {expense.merchant_name ?? cleanDescription(expense.description)}
            </span>
            <span className="shrink-0 text-[1.0625rem] tabular-nums tracking-[-0.01em] text-foreground">
              −{money(expense.amount)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
