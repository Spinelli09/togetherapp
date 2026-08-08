"use client";

import { useEffect, useState } from "react";
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

  // A sliding thumb is the canonical treatment here, and it is the wrong
  // one: both segments are real routes, so the thumb could not begin
  // travelling until the server responded and you would watch it jump, then
  // slide. What the tap needs to say is "registered" — so the pressed
  // segment takes the thumb immediately and the navigation catches up.
  const [pressed, setPressed] = useState<string | null>(null);

  useEffect(() => {
    setPressed(null);
  }, [pathname]);

  useEffect(() => {
    if (pressed === null) return;
    const timer = setTimeout(() => setPressed(null), 5000);
    return () => clearTimeout(timer);
  }, [pressed]);

  return (
    <div
      role="tablist"
      aria-label="Spending views"
      className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5"
    >
      {VIEWS.map(({ href, label }) => {
        // Exact match: /spending must not stay active on /spending/budgets.
        const active = pathname === href;
        const lit = pressed === null ? active : pressed === href;
        return (
          <Link
            key={href}
            href={href}
            role="tab"
            // Follows the real route, not the optimistic one.
            aria-selected={active}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey) return;
              setPressed(href);
            }}
            className={
              "rounded-[0.4rem] px-3.5 py-1.5 text-center text-[0.8125rem] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
              (lit
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
