import Link from "next/link";

import { loadHouseholdGoals } from "@/lib/actions/goals";
import { createClient } from "@/lib/supabase/server";

import { GoalList } from "./goal-list";

export default async function GoalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return null;
  }

  const goals = await loadHouseholdGoals(membership.household_id);

  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-12">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        ← Back to dashboard
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Goals
      </h1>

      <section className="mt-8">
        <GoalList householdId={membership.household_id} initialGoals={goals} />
      </section>
    </main>
  );
}
