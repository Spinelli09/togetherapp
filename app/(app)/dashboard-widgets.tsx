// Home, composed as two cinematic beats rather than stacked sections.
//
//   Beat one — hero: what's spendable · supporting: the verdict ·
//              background: the most recent thing that happened
//   Beat two — hero: the goal · supporting: its progress ·
//              background: the rest of the week's activity
//
// Nothing shares visual weight with anything else in the same beat. That is
// the whole difference between a screen that is stacked and one that is
// composed.
//
// Every component here is a Server Component. The only client code is the
// <Reveal>/<ProgressFill> wrapper, which takes children and never sees data.
import Link from "next/link";

import type { BalanceSummary } from "@/lib/actions/dashboard";
import type { Goal } from "@/lib/actions/goals";
import type { Observation } from "@/lib/actions/insights";
import type { TransactionRow } from "@/lib/actions/transactions";

import { ProgressFill } from "./reveal";
import { Amount, cleanDescription, primaryButtonClass } from "./ui";

function money(amount: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(amount);
}

function relativeTime(value: string): { text: string; hours: number } {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  const hours = minutes / 60;
  if (minutes < 2) return { text: "just now", hours };
  if (minutes < 60) return { text: `${minutes} minutes ago`, hours };
  const h = Math.round(hours);
  if (h < 24) return { text: `${h} hour${h === 1 ? "" : "s"} ago`, hours };
  const days = Math.round(h / 24);
  return { text: days === 1 ? "yesterday" : `${days} days ago`, hours };
}

// Deliberately not personalised, and deliberately not "Friday morning"
// either. Timeless copy survives six months of mornings; copy that names
// the day is a trick you notice on the second reading and resent by the
// twentieth. Worth revisiting only when display_name becomes editable —
// it is currently auto-derived from the email local-part.
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

// The background element of both beats. Deliberately recessive: at 13px it
// sits below the supporting verdict in the weight ladder, so it registers
// without competing. It is also the only line on Home that is genuinely new
// each morning — which is exactly why it must not shout.
function Activity({ transaction }: { transaction: TransactionRow }) {
  const when = relativeTime(transaction.occurred_at);
  return (
    <Link
      href="/spending"
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-baseline justify-between gap-4">
        <span className="min-w-0 truncate text-[0.8125rem] leading-tight text-foreground">
          {transaction.merchant_name ?? cleanDescription(transaction.description)}
        </span>
        <span className="shrink-0 text-[0.8125rem] leading-tight tabular-nums text-foreground">
          {transaction.direction === "debit" ? "−" : "+"}
          {money(Math.abs(transaction.amount))}
        </span>
      </span>
      <span className="mt-1.5 block text-[0.6875rem] leading-tight text-muted-foreground/70">
        {transaction.account_name} · {when.text}
      </span>
    </Link>
  );
}

/* ── Beat one ───────────────────────────────────────────────────────────
   Composed to the viewport rather than sliced by device height: the figure
   opens at the top, the verdict answers it, and the day's activity sits at
   the foot with the air between them doing the work a divider would.

   The height is 100svh less the chrome this screen actually reserves —
   96px of top padding plus the tab bar and its clearance — rather than a
   guessed percentage. A flat 74svh put the foot behind the tab bar on an
   iPhone SE. On a short phone the content is taller than the floor and
   simply flows; on a tall one mt-auto opens the gap.

   Fixing the foot rather than letting it float matters more than it looks:
   the activity row lands in the same place every morning, so after six
   months the eye goes straight there without reading the screen. */

export function Standing({
  balance,
  observations,
  latest,
}: {
  balance: BalanceSummary;
  observations: Observation[];
  latest?: TransactionRow;
}) {
  const synced = balance.lastSyncedAt ? relativeTime(balance.lastSyncedAt) : null;

  // Warnings outrank good news: an honest "we're okay" means knowing where
  // you stand, not being told everything is fine.
  const verdict =
    observations.find((o) => o.tone === "warning") ??
    observations.find((o) => o.tone === "good") ??
    observations[0];

  // Freshness appears only when it is worth knowing. After six months of
  // mornings "updated 9 minutes ago" is a line you have stopped reading —
  // and its constant presence is what would make the real warning invisible
  // on the day it finally matters.
  const showSync = synced === null || synced.hours >= 6;
  const isStale = synced === null || synced.hours >= 24;

  return (
    <section className="flex min-h-[calc(100svh-13rem)] flex-col">
      <div>
        <p className="text-[0.8125rem] text-muted-foreground">{greeting()}</p>

        {/* HERO. Rendered outside <Reveal> so it is on screen at first
            paint — the one number they came for should never fade in. */}
        <Amount
          value={balance.spendableBalance}
          className="mt-8 block text-[4.75rem] font-semibold leading-[0.85] tracking-[-0.04em] text-foreground sm:text-[5.5rem]"
        />
        <p className="mt-5 text-[0.8125rem] text-muted-foreground">to spend</p>

        {/* SUPPORTING. Set to a short measure so it reads as placed rather
            than poured into the container, and marked with a dot instead of
            coloured text — colour is an accent here, never the voice. */}
        {balance.error ? (
          <p className="mt-12 max-w-[17rem] text-[0.9375rem] leading-[1.55] text-destructive">
            {balance.error}
          </p>
        ) : (
          <p className="mt-12 flex max-w-[17rem] gap-2.5 text-[0.9375rem] leading-[1.55] text-foreground">
            <span
              aria-hidden="true"
              className={
                "mt-[0.5rem] size-[0.4375rem] shrink-0 rounded-full " +
                (verdict?.tone === "warning"
                  ? "bg-warning"
                  : verdict?.tone === "good"
                    ? "bg-success"
                    : "bg-muted-foreground/50")
              }
            />
            <span>{verdict?.headline ?? "Nothing needs your attention."}</span>
          </p>
        )}
      </div>

      {/* BACKGROUND. Exactly one row: enough that the screen answers "what
          just happened?" in the same glance as "are we okay?", quiet enough
          that it never becomes a second subject. */}
      <div className="mt-auto pt-16">
        {latest ? <Activity transaction={latest} /> : null}

        {showSync ? (
          <p
            className={
              "mt-6 text-[0.6875rem] " + (isStale ? "text-warning" : "text-muted-foreground/70")
            }
          >
            {synced ? `Updated ${synced.text}` : "Never synced"}
            {isStale ? (
              <>
                {" · "}
                <Link href="/settings/banks" className="underline underline-offset-4">
                  sync
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/* ── Beat two ───────────────────────────────────────────────────────────
   Turning a page rather than continuing a list. The activity thread from
   beat one finishes here as background, then the screen goes quiet before
   the goal — which is the note Home ends on. */

export function Building({
  goals,
  savings,
  rest,
}: {
  goals: Goal[];
  savings: number;
  rest: TransactionRow[];
}) {
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

  const lead = [...active].sort(
    (a, b) =>
      (b.targetAmount > 0 ? b.currentAmount / b.targetAmount : 0) -
      (a.targetAmount > 0 ? a.currentAmount / a.targetAmount : 0),
  )[0];

  const remaining = lead ? Math.max(0, lead.targetAmount - lead.currentAmount) : 0;
  const percent =
    lead && lead.targetAmount > 0 ? (lead.currentAmount / lead.targetAmount) * 100 : 0;

  return (
    <>
      {rest.length > 0 ? (
        <div className="space-y-7">
          {rest.map((transaction) => (
            <Activity key={transaction.id} transaction={transaction} />
          ))}
        </div>
      ) : null}

      <div className="mt-24">
        {justCompleted ? (
          <Link
            href="/goals"
            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="text-[0.8125rem] text-muted-foreground">{justCompleted.name}</p>
            <p className="mt-2.5 text-[2.5rem] font-semibold leading-none tracking-[-0.03em] text-success">
              Reached
            </p>
            <p className="mt-2.5 text-[0.6875rem] text-muted-foreground/70">
              {money(justCompleted.targetAmount)} saved
              {active.length > 0 ? ` · ${active.length} more on the way` : ""}
            </p>
          </Link>
        ) : lead ? (
          <Link
            href="/goals"
            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* Quiet label, then the figure: the same composition as the
                hero at half scale, which is what makes one hand feel
                responsible for the whole screen. "$6,400 to go" is a finish
                line; "48% complete" is a metric. */}
            <p className="text-[0.8125rem] text-muted-foreground">{lead.name}</p>
            <Amount
              value={remaining > 0 ? remaining : lead.currentAmount}
              className="mt-2.5 block text-[2.5rem] font-semibold leading-none tracking-[-0.03em] text-foreground"
            />
            <p className="mt-2.5 text-[0.6875rem] text-muted-foreground/70">
              {remaining > 0 ? "to go" : "reached"}
              {active.length > 1
                ? ` · ${active.length - 1} other goal${active.length === 2 ? "" : "s"}`
                : ""}
            </p>

            {/* Bled rather than contained. Prototyped both at phone width:
                contained, the rule terminates where the text terminates and
                reads as one more line of type; bled, it becomes a horizontal
                axis the figure sits on, and the beat reads as composed
                rather than listed. */}
            <div className="mt-8">
              <ProgressFill percent={percent} bleed />
            </div>
          </Link>
        ) : (
          <Link
            href="/goals"
            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="text-[0.9375rem] text-foreground">What are you saving for?</p>
            <p className="mt-2 text-[0.8125rem] text-muted-foreground">
              Name it, and watch it grow here.
            </p>
          </Link>
        )}

        {savings > 0 ? (
          <p className="mt-8 text-[0.6875rem] text-muted-foreground/70">
            {money(savings)} saved across your accounts
          </p>
        ) : null}
      </div>
    </>
  );
}

export function ConnectBankPrompt() {
  return (
    <section className="flex min-h-[calc(100svh-13rem)] flex-col justify-center">
      <p className="text-[0.8125rem] text-muted-foreground">{greeting()}</p>
      <h1 className="mt-8 text-[2rem] font-semibold leading-tight tracking-tight text-foreground">
        Let&apos;s see where you stand.
      </h1>
      <p className="mt-5 max-w-[20rem] text-[0.9375rem] leading-relaxed text-muted-foreground">
        Connect a bank and you&apos;ll both see what&apos;s there to spend, what just went out,
        and what you&apos;re saving towards.
      </p>
      <Link href="/settings/banks" className={"mt-10 inline-block self-start " + primaryButtonClass}>
        Connect a bank
      </Link>
    </section>
  );
}
