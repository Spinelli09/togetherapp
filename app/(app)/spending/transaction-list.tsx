"use client";

import { useState, useTransition } from "react";

import {
  loadTransactionPage,
  type TransactionPage,
  type TransactionRow,
} from "@/lib/actions/transactions";
import { Arrival, Settle } from "../reveal";
import { cleanDescription, quietLinkClass } from "../ui";

function money(amount: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(
    Math.abs(amount),
  );
}

// Recent entries read as activity ("2 hours ago"); older ones read as a
// record ("5 Aug"). A ledger stretching back a year needs both — relative
// time stops being useful past a week, and an absolute date tells you
// nothing about something that happened this morning.
function when(value: string): string {
  const date = new Date(value);
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

// Matches Home's Recent rows exactly: merchant dominant, amount scannable
// at the same size, metadata a genuine whisper. Borderless — the old rows
// were individually boxed, which is what made the ledger read as a table.
// The <li> lives at the call site so an arriving row can be an animated one
// without nesting two list items.
const rowClass = "flex items-baseline justify-between gap-4";

function Row({ transaction }: { transaction: TransactionRow }) {
  return (
    <>
      <span className="min-w-0">
        <span className="block truncate text-[1.0625rem] leading-tight text-foreground">
          {transaction.merchant_name ?? cleanDescription(transaction.description)}
        </span>
        <span className="mt-1.5 block text-[0.75rem] leading-tight text-muted-foreground/70">
          {transaction.account_name} · {when(transaction.occurred_at)}
        </span>
      </span>
      {/* Never coloured by sign (§05) — a grocery shop is not a failure. */}
      <span className="shrink-0 text-[1.0625rem] tabular-nums tracking-[-0.01em] text-foreground">
        {transaction.direction === "debit" ? "−" : "+"}
        {money(transaction.amount)}
      </span>
    </>
  );
}

export function TransactionList({
  householdId,
  initialPage,
}: {
  householdId: string;
  initialPage: TransactionPage;
}) {
  const [transactions, setTransactions] = useState(initialPage.transactions);
  const [cursor, setCursor] = useState(initialPage.nextCursor);
  const [error, setError] = useState<string | null>(initialPage.error ?? null);
  const [isPending, startTransition] = useTransition();
  // Where the ledger grew last time. Rows before this index are already on
  // screen and must not move or re-animate — appending is not a re-entrance
  // for the rows you were already reading.
  const [appendedFrom, setAppendedFrom] = useState<number | null>(null);

  function handleLoadMore() {
    if (!cursor) return;
    setError(null);
    startTransition(async () => {
      const page = await loadTransactionPage(householdId, cursor);
      setTransactions((current) => {
        setAppendedFrom(current.length);
        return [...current, ...page.transactions];
      });
      setCursor(page.nextCursor);
      setError(page.error ?? null);
    });
  }

  if (transactions.length === 0) {
    return (
      <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
        {error ?? "Nothing imported yet — connect a bank and sync to bring your history in."}
      </p>
    );
  }

  return (
    <div>
      <ul className="space-y-6">
        {transactions.map((transaction, index) => {
          // Arriving rows fade in where they landed, so the eye can find the
          // seam without the page scrolling or anything above it moving.
          // Staggered by position, capped at six, so a twenty-row page reads
          // as one arrival rather than twenty separate events.
          const arriving = appendedFrom !== null && index >= appendedFrom;
          return arriving ? (
            <Arrival
              key={transaction.id}
              index={Math.min(index - appendedFrom, 6)}
              className={rowClass}
            >
              <Row transaction={transaction} />
            </Arrival>
          ) : (
            <li key={transaction.id} className={rowClass}>
              <Row transaction={transaction} />
            </li>
          );
        })}
      </ul>

      {cursor ? (
        <div className="mt-10">
          {/* The label stays put. "Loading…" is narrower than "Show more",
              so swapping it made the control shrink away from the finger
              that was still on it. */}
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isPending}
            aria-busy={isPending}
            className={quietLinkClass}
          >
            Show more
          </button>
          {error ? (
            <Settle>
              <p
                role="status"
                aria-live="polite"
                className="mt-4 text-[0.8125rem] text-destructive"
              >
                {error}
              </p>
            </Settle>
          ) : null}
        </div>
      ) : (
        <p className="mt-10 text-[0.75rem] text-muted-foreground/70">That&apos;s everything.</p>
      )}
    </div>
  );
}
