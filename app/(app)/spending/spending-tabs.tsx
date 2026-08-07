"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Segmented control for the two views of Spending: what actually happened
// (Transactions) and what was planned (Budgets). Real routes rather than
// client state, so the back button, deep links and the budgets month param
// all keep working.
//
// Understated by design: a control is the one place the language permits a
// container (§08), but it earns that only by staying quiet. No shadow — §08
// forbids elevation outright, and the old `shadow-sm` was the single
// non-compliant surface on this screen.
const VIEWS = [
  { href: "/spending", label: "Transactions" },
  { href: "/spending/budgets", label: "Budgets" },
] as const;

export function SpendingTabs() {
  const pathname = usePathname();

  return (
    <div
      role="tablist"
      aria-label="Spending views"
      className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5"
    >
      {VIEWS.map(({ href, label }) => {
        // Exact match: /spending must not stay active on /spending/budgets.
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            role="tab"
            aria-selected={active}
            className={
              "rounded-[0.4rem] px-3.5 py-1.5 text-center text-[0.8125rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
              (active
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
