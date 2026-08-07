import { currentMonthStartNZ, loadMonthlySummary } from "@/lib/actions/dashboard";
import { loadInsights } from "@/lib/actions/insights";
import { loadTransactionPage } from "@/lib/actions/transactions";
import { createClient } from "@/lib/supabase/server";

import { Reveal } from "../reveal";
import { Label } from "../ui";
import { SpendingTabs } from "./spending-tabs";
import { LargestThisMonth, SpendingSummary } from "./spending-summary";
import { TransactionList } from "./transaction-list";

function formatMonthLabel(monthStart: string): string {
  const [year, month] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-NZ", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function SpendingPage() {
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

  const [initialPage, monthly, insights] = await Promise.all([
    loadTransactionPage(householdId, null),
    loadMonthlySummary(householdId, monthStart),
    loadInsights(householdId, monthStart),
  ]);

  return (
    <main className="mx-auto max-w-[40rem] px-6 pb-16 pt-24">
      {/*
        No "Spending" heading: the tab bar already names this screen and the
        segmented control names the view. A third label would be the
        duplicated heading the language warns about.

        Rhythm matches Home exactly — 96 top, 64 between sections, 40
        inside a group.
      */}
      <Reveal rise={false}>
        <SpendingTabs />
      </Reveal>

      <div className="mt-16">
        <Reveal index={1} rise={false}>
          <SpendingSummary
            monthly={monthly}
            monthLabel={formatMonthLabel(monthStart)}
            insights={insights}
            householdId={householdId}
            monthStart={monthStart}
          />
        </Reveal>
      </div>

      <div className="mt-16">
        <Reveal index={2}>
          <LargestThisMonth insights={insights} />
        </Reveal>
      </div>

      <div className="mt-16">
        <Reveal index={3}>
          <section>
            <Label>Activity</Label>
            <div className="mt-6">
              <TransactionList householdId={householdId} initialPage={initialPage} />
            </div>
          </section>
        </Reveal>
      </div>
    </main>
  );
}
