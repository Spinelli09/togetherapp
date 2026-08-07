"use client";

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
          return (
            <li key={href} className="flex-1 sm:flex-none">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={
                  // min-h-14 keeps every tap target above the 44px guideline.
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[0.6875rem] font-medium transition-colors active:opacity-70 sm:min-h-0 sm:min-w-[4.5rem] sm:rounded-full sm:py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring " +
                  (active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                <Icon
                  aria-hidden="true"
                  className="size-6"
                  strokeWidth={active ? 2.25 : 1.75}
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
