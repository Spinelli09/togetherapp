import { currentMonthStartNZ, loadBalanceSummary } from "@/lib/actions/dashboard";
import { loadHouseholdGoals } from "@/lib/actions/goals";
import { loadInsights } from "@/lib/actions/insights";
import { loadRecentTransactions } from "@/lib/actions/transactions";
import { createClient } from "@/lib/supabase/server";

import { ConnectBankPrompt, Recent, Standing, Together } from "./dashboard-widgets";
import { Reveal } from "./reveal";

// Three, not five: one row reads as a statistic, a short list reads as
// activity. Activity is what makes a shared account feel shared.
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
      <main className="mx-auto max-w-[40rem] px-6 pb-16 pt-24">
        <Reveal rise={false}>
          <ConnectBankPrompt />
        </Reveal>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[40rem] px-6 pb-16 pt-24">
      {/*
        Confidence → Awareness → Hope. Separated by whitespace alone: no
        cards, no borders, no dividers. The gaps are large enough that each
        beat is read on its own before the next is noticed.

        The hero does not animate in — it is the anchor. Only the beats
        below rise, which leads the eye downward through the story.
      */}
      <Reveal rise={false}>
        <Standing
          balance={balance}
          observations={insights.observations}
        />
      </Reveal>

      <div className="mt-16">
        <Reveal index={1}>
          <Recent transactions={recent.transactions} />
        </Reveal>
      </div>

      <div className="mt-16">
        <Reveal index={2}>
          <Together goals={goals} savings={balance.savingsBalance} />
        </Reveal>
      </div>
    </main>
  );
}
