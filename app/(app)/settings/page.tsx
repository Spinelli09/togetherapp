import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";

const SECTIONS = [
  {
    href: "/settings/household",
    title: "Household",
    description: "Members and invitations",
  },
  {
    href: "/settings/banks",
    title: "Banks",
    description: "Connected accounts and syncing",
  },
] as const;

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto max-w-[40rem] px-6 pb-16 pt-24">
      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">
        Settings
      </h1>

      <nav aria-label="Settings sections" className="mt-8">
        <ul className="overflow-hidden rounded-lg border border-border">
          {SECTIONS.map((section, index) => (
            <li key={section.href}>
              <Link
                href={section.href}
                className={
                  "flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring " +
                  (index > 0 ? "border-t border-border" : "")
                }
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    {section.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {section.description}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="mt-8">
        <p className="text-xs text-muted-foreground">Signed in as {user.email}</p>
        <form action={signOut} className="mt-3">
          <button
            type="submit"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
