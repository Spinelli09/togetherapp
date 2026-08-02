import Link from "next/link";

import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = user
    ? await supabase
        .from("household_members")
        .select("role, households(name)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle()
    : { data: null };

  const householdName = membership?.households?.name ?? "your household";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {householdName}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Dashboard coming soon
      </h1>
      <p className="mt-3 text-base text-muted-foreground">
        Signed in as {user?.email}
      </p>

      <Link
        href="/settings/household"
        className="mt-6 text-sm text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Manage household
      </Link>

      <form action={signOut} className="mt-8">
        <button
          type="submit"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
