"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, House, Settings, Target } from "lucide-react";

// Persistent app shell navigation. Client component only because it needs
// usePathname() for the active state — it holds no other state and fetches
// nothing.
const TABS = [
  { href: "/", label: "Home", Icon: House },
  { href: "/spending", label: "Spending", Icon: CreditCard },
  { href: "/goals", label: "Goals", Icon: Target },
  { href: "/settings", label: "Settings", Icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  // Home must match exactly or it would light up on every route; the rest
  // stay active across their nested pages (e.g. /spending/budgets).
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function BottomNav() {
  const pathname = usePathname();

  // Every screen here is server-rendered, so a tab press is a network round
  // trip. Without this the nav is dead from the moment your finger lifts
  // until the response lands — the most repeated interaction in the product,
  // and the only one with no acknowledgement at all.
  //
  // The feedback is not a spinner. The pressed tab takes the active
  // treatment immediately and the current one gives it up, so the answer to
  // "did that register?" is the nav behaving as though you have arrived. A
  // spinner says "wait"; this says "yes."
  //
  // Selection is tracked here rather than per-link (useLinkStatus) because
  // that hook only knows about its own link: mid-navigation both the old and
  // new tab would be lit, which reads as a rendering fault. Exactly one tab
  // is ever lit.
  const [pressed, setPressed] = useState<string | null>(null);

  useEffect(() => {
    setPressed(null);
  }, [pathname]);

  // If a navigation is abandoned or fails, the pressed tab must not stay lit
  // pointing at a screen you are not on.
  useEffect(() => {
    if (pressed === null) return;
    const timer = setTimeout(() => setPressed(null), 5000);
    return () => clearTimeout(timer);
  }, [pressed]);

  // Full-bleed on a phone, which is correct there. On anything wider it
  // becomes a centred pill floating clear of the bottom edge — a full-width
  // bar beneath a 40rem column reads as a mobile app stretched to fit
  // rather than something designed for the screen it is on.
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/85 backdrop-blur-lg sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:rounded-full sm:border sm:px-1"
    >
      {/* pb honours the iPhone home indicator; falls back to 0 elsewhere. */}
      <ul className="mx-auto flex max-w-lg pb-[env(safe-area-inset-bottom)] sm:max-w-none sm:pb-0">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          const lit = pressed === null ? active : pressed === href;
          return (
            <li key={href} className="flex-1 sm:flex-none">
              <Link
                href={href}
                // aria-current follows the real route, never the optimistic
                // one: assistive tech should not be told you have arrived
                // somewhere you have not.
                aria-current={active ? "page" : undefined}
                onClick={(event) => {
                  // Modified clicks open elsewhere; this tab is not going anywhere.
                  if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                  setPressed(href);
                }}
                className={
                  // min-h-14 keeps every tap target above the 44px guideline.
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[0.6875rem] font-medium transition-colors duration-150 active:opacity-70 sm:min-h-0 sm:min-w-[4.5rem] sm:rounded-full sm:py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring " +
                  (lit ? "text-foreground" : "text-muted-foreground hover:text-foreground")
                }
              >
                <Icon aria-hidden="true" className="size-6" strokeWidth={lit ? 2.25 : 1.75} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
