"use client";

import { useState, useTransition } from "react";

import {
  loadTransactionPage,
  type TransactionPage,
  type TransactionRow,
} from "@/lib/actions/transactions";

function formatAmount(amount: number, direction: string | null) {
  const formatted = new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(Math.abs(amount));
  return direction === "debit" ? `-${formatted}` : `+${formatted}`;
}

function TransactionRowItem({ transaction }: { transaction: TransactionRow }) {
  return (
    <li className="flex items-center justify-between rounded-md border border-border px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="truncate text-foreground">
          {transaction.merchant_name ?? transaction.description}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {new Date(transaction.occurred_at).toLocaleDateString("en-NZ", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          {" · "}
          {transaction.account_name}
        </p>
      </div>
      <p
        className={
          "shrink-0 pl-4 font-medium tabular-nums " +
          (transaction.direction === "debit" ? "text-foreground" : "text-accent-foreground")
        }
      >
        {formatAmount(transaction.amount, transaction.direction)}
      </p>
    </li>
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

  function handleLoadMore() {
    if (!cursor) return;
    setError(null);
    startTransition(async () => {
      const page = await loadTransactionPage(householdId, cursor);
      setTransactions((current) => [...current, ...page.transactions]);
      setCursor(page.nextCursor);
      setError(page.error ?? null);
    });
  }

  if (transactions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {error ?? "No transactions yet — connect a bank and sync to import your history."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {transactions.map((transaction) => (
          <TransactionRowItem key={transaction.id} transaction={transaction} />
        ))}
      </ul>

      {cursor ? (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isPending}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {isPending ? "Loading…" : "Load more"}
          </button>
          {error ? (
            <p role="status" aria-live="polite" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          That&apos;s everything.
        </p>
      )}
    </div>
  );
}
