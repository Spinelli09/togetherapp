// Home. Three beats, in the order the question is actually asked:
//
//   Confidence  — how are we doing?
//   Awareness   — what just happened?
//   Hope        — what are we building together?
//
// Anything that answers a different question lives on a different screen.
// Hierarchy comes from type size and whitespace; there are no cards, no
// borders and no dividers anywhere on this screen.
//
// Every component here is a Server Component. The only client code is the
// <Reveal>/<ProgressFill> wrapper, which takes children and never sees data.
import Link from "next/link";

import type { BalanceSummary } from "@/lib/actions/dashboard";
import type { Goal } from "@/lib/actions/goals";
import type { Observation } from "@/lib/actions/insights";
import type { TransactionRow } from "@/lib/actions/transactions";

import { ProgressFill } from "./reveal";
import { Label, cleanDescription, primaryButtonClass } from "./ui";

function money(amount: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(amount);
}

// The hero drops cents. "$5,438" is a summary; "$5,438.22" is a receipt, and
// reading it takes longer than the glance this screen exists for.
function wholeMoney(amount: number) {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function relativeTime(value: string): { text: string; isStale: boolean } {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 2) return { text: "just now", isStale: false };
  if (minutes < 60) return { text: `${minutes} minutes ago`, isStale: false };
  const hours = Math.round(minutes / 60);
  if (hours < 24) return { text: `${hours} hour${hours === 1 ? "" : "s"} ago`, isStale: false };
  const days = Math.round(hours / 24);
  if (days === 1) return { text: "yesterday", isStale: true };
  return { text: `${days} days ago`, isStale: true };
}

// Deliberately not personalised. display_name is auto-derived from the
// email local-part ("spinelli") and there is no UI to change it, so a name
// here would read as a mistake more often than as warmth. Worth adding the
// moment display_name becomes editable.
function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-NZ", {
      timeZone: "Pacific/Auckland",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/* ── Confidence ─────────────────────────────────────────────────────────
   One number, large enough that nothing else can compete, and one sentence
   that turns it into a judgement. A figure alone can't answer "how are we
   doing" — it needs interpreting, and interpreting is work. */

export function Standing({
  balance,
  observations,
}: {
  balance: BalanceSummary;
  observations: Observation[];
}) {
  const synced = balance.lastSyncedAt ? relativeTime(balance.lastSyncedAt) : null;

  // Warnings outrank good news: an honest "we're okay" means knowing where
  // you stand, not being told everything is fine.
  const verdict =
    observations.find((o) => o.tone === "warning") ??
    observations.find((o) => o.tone === "good") ??
    observations[0];

  return (
    <section>
      <p className="text-sm text-muted-foreground">{greeting()}</p>

      <p className="mt-10 text-[4rem] font-semibold leading-[0.9] tracking-[-0.035em] tabular-nums text-foreground sm:text-[4.5rem]">
        {wholeMoney(balance.spendableBalance)}
      </p>

      <p
        className={
          "mt-4 text-[0.8125rem] leading-relaxed " +
          (synced?.isStale ? "text-warning" : "text-muted-foreground")
        }
      >
        to spend
        {synced ? ` · updated ${synced.text}` : " · never synced"}
        {synced?.isStale ? (
          <>
            {" · "}
            <Link href="/settings/banks" className="underline underline-offset-4">
              sync
            </Link>
          </>
        ) : null}
      </p>

      {balance.error ? (
        <p className="mt-10 text-[1.0625rem] leading-relaxed text-destructive">{balance.error}</p>
      ) : verdict ? (
        <p
          className={
            "mt-10 text-[1.0625rem] leading-[1.5] tracking-[-0.005em] " +
            (verdict.tone === "warning" ? "text-warning" : "text-foreground")
          }
        >
          {verdict.headline}
        </p>
      ) : (
        <p className="mt-10 text-[1.0625rem] leading-[1.5] tracking-[-0.005em] text-foreground">
          Nothing needs your attention.
        </p>
      )}
    </section>
  );
}

/* ── Awareness ──────────────────────────────────────────────────────────
   The moment the app stops being a report. Three rows, not one: a single
   row reads as a statistic, a short list reads as activity — and activity
   is what makes a shared account feel shared. */

export function Recent({ transactions }: { transactions: TransactionRow[] }) {
  if (transactions.length === 0) return null;

  return (
    <section>
      <Label>Recent</Label>
      <ul className="mt-6 space-y-6">
        {transactions.map((transaction) => {
          const when = relativeTime(transaction.occurred_at);
          return (
            <li key={transaction.id}>
              <Link
                href="/spending"
                className="flex items-baseline justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[1.0625rem] leading-tight text-foreground">
                    {transaction.merchant_name ?? cleanDescription(transaction.description)}
                  </span>
                  <span className="mt-1.5 block text-[0.75rem] leading-tight text-muted-foreground/70">
                    {transaction.account_name} · {when.text}
                  </span>
                </span>
                <span className="shrink-0 text-[1.0625rem] tabular-nums tracking-[-0.01em] text-foreground">
                  {transaction.direction === "debit" ? "−" : "+"}
                  {money(Math.abs(transaction.amount))}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── Hope ───────────────────────────────────────────────────────────────
   The note the screen ends on. Framed forward: "$2,600 to go" is a finish
   line, "48% complete" is a metric. Savings sits here rather than beside the
   balance — as something built together, not an accounting footnote. */

export function Together({ goals, savings }: { goals: Goal[]; savings: number }) {
  const active = goals.filter((g) => g.status === "active");
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const justCompleted = goals
    .filter(
      (g) =>
        g.status === "completed" &&
        g.completedAt !== null &&
        Date.now() - new Date(g.completedAt).getTime() < THIRTY_DAYS_MS,
    )
    .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1))[0];

  const savingsLine =
    savings > 0 ? (
      <p className="mt-6 text-[0.75rem] text-muted-foreground/70">
        {money(savings)} saved across your accounts
      </p>
    ) : null;

  if (justCompleted) {
    return (
      <section>
        <Label>Together</Label>
        <Link
          href="/goals"
          className="mt-6 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p className="text-[0.9375rem] text-success">{justCompleted.name} — reached</p>
          <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
            {money(justCompleted.targetAmount)} saved
            {active.length > 0
              ? ` · ${active.length} more on the way`
              : ""}
          </p>
        </Link>
        {savingsLine}
      </section>
    );
  }

  if (active.length === 0) {
    return (
      <section>
        <Label>Together</Label>
        <Link
          href="/goals"
          className="mt-6 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p className="text-[0.9375rem] text-foreground">What are you saving for?</p>
          <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
            Name it, and watch it grow here.
          </p>
        </Link>
        {savingsLine}
      </section>
    );
  }

  const lead = [...active].sort(
    (a, b) =>
      (b.targetAmount > 0 ? b.currentAmount / b.targetAmount : 0) -
      (a.targetAmount > 0 ? a.currentAmount / a.targetAmount : 0),
  )[0];
  const percent = lead.targetAmount > 0 ? (lead.currentAmount / lead.targetAmount) * 100 : 0;
  const remaining = Math.max(0, lead.targetAmount - lead.currentAmount);

  return (
    <section>
      <Label>Together</Label>
      <Link
        href="/goals"
        className="mt-6 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className="text-[0.8125rem] text-muted-foreground">{lead.name}</p>
        <p className="mt-1.5 text-[2rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground">
          {remaining > 0 ? wholeMoney(remaining) : wholeMoney(lead.currentAmount)}
        </p>
        <p className="mt-1.5 text-[0.75rem] text-muted-foreground/70">
          {remaining > 0 ? "to go" : "reached"}
          {active.length > 1
            ? ` · ${active.length - 1} other goal${active.length === 2 ? "" : "s"}`
            : ""}
        </p>
        <div className="mt-6">
          <ProgressFill percent={percent} />
        </div>
      </Link>
      {savingsLine}
    </section>
  );
}

export function ConnectBankPrompt() {
  return (
    <section>
      <p className="text-sm text-muted-foreground">{greeting()}</p>
      <h1 className="mt-10 text-3xl font-semibold leading-tight tracking-tight text-foreground">
        Let&apos;s see where you stand.
      </h1>
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted-foreground">
        Connect a bank and you&apos;ll both see what&apos;s there to spend, what just went out,
        and what you&apos;re saving towards.
      </p>
      <Link
        href="/settings/banks"
        className={"mt-10 inline-block " + primaryButtonClass}
      >
        Connect a bank
      </Link>
    </section>
  );
}
