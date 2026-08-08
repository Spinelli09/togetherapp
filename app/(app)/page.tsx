import { currentMonthStartNZ, loadBalanceSummary } from "@/lib/actions/dashboard";
import { loadHouseholdGoals } from "@/lib/actions/goals";
import { loadInsights } from "@/lib/actions/insights";
import { loadRecentTransactions } from "@/lib/actions/transactions";
import { createClient } from "@/lib/supabase/server";

import { Building, ConnectBankPrompt, Standing } from "./dashboard-widgets";
import { Reveal } from "./reveal";
import { pageClass } from "./ui";

// Three loaded, split one/two across the beats: the first answers "what
// just happened?" in the opening glance, the other two carry the activity
// thread into the second beat.
const RECENT_COUNT = 3;

export default async function HomePage() {
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

  const householdId = membership.household_id;
  const monthStart = await currentMonthStartNZ();

  // Fetched concurrently — wall-clock is the slowest query, not the sum.
  // Every loader returns its error in-band rather than throwing, so one
  // failing beat degrades alone instead of taking down the page.
  const [balance, goals, recent, insights] = await Promise.all([
    loadBalanceSummary(householdId),
    loadHouseholdGoals(householdId),
    loadRecentTransactions(householdId, RECENT_COUNT),
    loadInsights(householdId, monthStart),
  ]);

  if (!balance.hasAnyConnection && !balance.error) {
    return (
      <main className={pageClass}>
        <ConnectBankPrompt />
      </main>
    );
  }

  return (
    <main className={pageClass}>
      {/*
        Two beats, not three sections. Beat one is composed to the height of
        the screen rather than to the height of its own content, so the
        figure, the verdict and the day's one event occupy the frame in
        fixed relation to each other on every phone.

        It renders unwrapped and unanimated. A number someone opens the app
        specifically to read should be there before they finish looking —
        the composure of the screen is the animation.
      */}
      <Standing
        balance={balance}
        observations={insights.observations}
        latest={recent.transactions[0]}
      />

      {/* Beat two sits a deliberate scroll away, and rises when reached. */}
      <div className="mt-20">
        <Reveal index={1}>
          <Building
            goals={goals}
            savings={balance.savingsBalance}
            rest={recent.transactions.slice(1)}
          />
        </Reveal>
      </div>
    </main>
  );
}
