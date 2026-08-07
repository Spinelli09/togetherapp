"use server";

import { loadBudgetProgress } from "@/lib/actions/budgets";
import { loadHouseholdGoals } from "@/lib/actions/goals";
import { createClient } from "@/lib/supabase/server";

// Milestone 10. Everything here is computed deterministically; the LLM
// only turns already-computed numbers into prose. No persistence, no
// caching — facts are recomputed per request (the RPC is ~1ms) and the
// narrative is generated on demand.

export type CategoryFact = { name: string; spent: number; prev_spent: number };
export type ExpenseFact = {
  description: string;
  merchant_name: string | null;
  amount: number;
  occurred_at: string;
};
export type UncategorisedFact = { description: string; amount: number; occurred_at: string };
export type TransferFact = { description: string; amount: number; txn_count: number };

export type InsightFacts = {
  month_start: string;
  categorised_spend: number;
  internal_transfers: number;
  uncategorised_spend: number;
  prev_categorised_spend: number;
  categories: CategoryFact[];
  top_expenses: ExpenseFact[];
  top_uncategorised: UncategorisedFact[];
  transfer_destinations: TransferFact[];
};

export type Observation = {
  kind: "spending" | "trend" | "budget" | "goal" | "savings" | "data";
  // The full sentence, with figures. Shown on Spending, where detail is the
  // point.
  text: string;
  // The same fact at a glance, for Home — where a sentence carrying three
  // numbers stops being reassurance and becomes homework. Copy only: no
  // threshold, tone or selection logic differs between the two.
  headline: string;
  tone: "neutral" | "warning" | "good";
};

export type InsightsResult = {
  facts: InsightFacts | null;
  observations: Observation[];
  error?: string;
};

const EMPTY_FACTS: InsightFacts = {
  month_start: "",
  categorised_spend: 0,
  internal_transfers: 0,
  uncategorised_spend: 0,
  prev_categorised_spend: 0,
  categories: [],
  top_expenses: [],
  top_uncategorised: [],
  transfer_destinations: [],
};

function money(amount: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(amount);
}

// Deterministic, rule-based. These are the actual insights — the LLM adds
// a summary on top but never produces or alters any of these numbers.
function deriveObservations(
  facts: InsightFacts,
  budgets: Awaited<ReturnType<typeof loadBudgetProgress>>,
  goals: Awaited<ReturnType<typeof loadHouseholdGoals>>,
): Observation[] {
  const observations: Observation[] = [];

  // 1. Spending vs last month (categorised only — transfers excluded, see
  // the RPC's comment on why counting them as spending is simply wrong).
  if (facts.prev_categorised_spend > 0) {
    const delta = facts.categorised_spend - facts.prev_categorised_spend;
    const pct = Math.round((delta / facts.prev_categorised_spend) * 100);
    if (Math.abs(pct) >= 5) {
      observations.push({
        kind: "spending",
        tone: pct > 0 ? "warning" : "good",
        headline: `Spending is ${pct > 0 ? "up" : "down"} ${Math.abs(pct)}% on last month.`,
        text:
          `Categorised spending is ${money(Math.abs(delta))} ${pct > 0 ? "higher" : "lower"} ` +
          `than last month (${money(facts.categorised_spend)} vs ${money(facts.prev_categorised_spend)}, ${pct > 0 ? "+" : ""}${pct}%).`,
      });
    } else {
      observations.push({
        kind: "spending",
        tone: "neutral",
        headline: "Spending is about the same as last month.",
        text: `Categorised spending is steady at ${money(facts.categorised_spend)}, about the same as last month.`,
      });
    }
  } else if (facts.categorised_spend > 0) {
    observations.push({
      kind: "spending",
      tone: "neutral",
      headline: `${money(facts.categorised_spend)} spent this month.`,
      text: `${money(facts.categorised_spend)} of categorised spending this month.`,
    });
  }

  // 2. Category trends — only flag moves large enough to be meaningful.
  for (const category of facts.categories) {
    if (category.prev_spent <= 0 || category.spent <= 0) continue;
    const pct = Math.round(((category.spent - category.prev_spent) / category.prev_spent) * 100);
    if (Math.abs(pct) >= 20 && Math.abs(category.spent - category.prev_spent) >= 50) {
      observations.push({
        kind: "trend",
        tone: pct > 0 ? "warning" : "good",
        headline: `${category.name} is ${pct > 0 ? "up" : "down"} ${Math.abs(pct)}% this month.`,
        text:
          `${category.name} is ${pct > 0 ? "up" : "down"} ${Math.abs(pct)}% ` +
          `(${money(category.spent)} vs ${money(category.prev_spent)} last month).`,
      });
    }
  }

  // 3. Budget warnings.
  for (const budget of budgets.budgets) {
    if (budget.netSpent > budget.monthlyLimit) {
      observations.push({
        kind: "budget",
        tone: "warning",
        headline: `${budget.name} is over budget by ${money(budget.netSpent - budget.monthlyLimit)}.`,
        text: `${budget.name} is over budget by ${money(budget.netSpent - budget.monthlyLimit)}.`,
      });
    } else if (budget.percentUsed >= 80) {
      observations.push({
        kind: "budget",
        tone: "warning",
        headline: `${budget.name} is at ${Math.round(budget.percentUsed)}% of its limit.`,
        text: `${budget.name} is at ${Math.round(budget.percentUsed)}% of its ${money(budget.monthlyLimit)} limit.`,
      });
    }
  }

  // 4. Goals progress.
  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.status === "completed");
  for (const goal of activeGoals) {
    const pct = goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0;
    observations.push({
      kind: "goal",
      tone: "neutral",
      headline: `${goal.name} is ${pct}% funded.`,
      text: `${goal.name} is ${pct}% funded (${money(goal.currentAmount)} of ${money(goal.targetAmount)}).`,
    });
  }
  if (completedGoals.length > 0) {
    observations.push({
      kind: "goal",
      tone: "good",
      headline: `${completedGoals.length} goal${completedGoals.length === 1 ? "" : "s"} reached.`,
      text: `${completedGoals.length} goal${completedGoals.length === 1 ? "" : "s"} reached.`,
    });
  }

  // 5. Savings observation — money moved into the household's own accounts
  // is saving, not spending. This is the single most useful correction the
  // transfer detection buys us.
  if (facts.internal_transfers > 0) {
    const top = facts.transfer_destinations[0];
    observations.push({
      kind: "savings",
      tone: "good",
      headline: `${money(facts.internal_transfers)} moved into your own accounts.`,
      text:
        `${money(facts.internal_transfers)} moved between your own accounts` +
        (top ? ` — the largest was ${money(top.amount)} to ${top.description} across ${top.txn_count} transfer${top.txn_count === 1 ? "" : "s"}.` : "."),
    });
  }

  // 6. Data-quality note — with ~47% of this household's real transactions
  // uncategorised by Akahu, staying quiet about it would overstate how
  // complete the category picture is.
  if (facts.uncategorised_spend > 0) {
    const total = facts.categorised_spend + facts.uncategorised_spend;
    const pct = total > 0 ? Math.round((facts.uncategorised_spend / total) * 100) : 0;
    observations.push({
      kind: "data",
      tone: "neutral",
      headline: `${money(facts.uncategorised_spend)} has no category from your bank.`,
      text:
        `${money(facts.uncategorised_spend)} (${pct}% of non-transfer spending) has no category from your bank, ` +
        `so it isn't in the category figures above.`,
    });
  }

  return observations;
}

export async function loadInsights(
  householdId: string,
  monthStart: string,
): Promise<InsightsResult> {
  const supabase = await createClient();

  const [{ data, error }, budgets, goals] = await Promise.all([
    supabase.rpc("get_household_insight_facts", {
      p_household_id: householdId,
      p_month_start: monthStart,
    }),
    loadBudgetProgress(householdId, monthStart),
    loadHouseholdGoals(householdId),
  ]);

  if (error || !data) {
    return { facts: null, observations: [], error: "Couldn't work out this month's insights." };
  }

  const facts = { ...EMPTY_FACTS, ...(data as unknown as InsightFacts) };

  return { facts, observations: deriveObservations(facts, budgets, goals) };
}

export type NarrativeState = {
  status: "idle" | "success" | "error" | "unavailable";
  narrative?: string;
  message?: string;
};

// The LLM's only job: turn already-computed observations into 2–3
// sentences. It is given the derived observations as text and explicitly
// told not to compute or invent figures — and nothing it returns is ever
// parsed back into a number. Every figure on screen comes from the
// deterministic layer above.
export async function generateNarrative(
  _prevState: NarrativeState,
  formData: FormData,
): Promise<NarrativeState> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      status: "unavailable",
      message:
        "No ANTHROPIC_API_KEY is set, so the written summary is turned off. The insights above are unaffected.",
    };
  }

  const householdId = String(formData.get("householdId") ?? "");
  const monthStart = String(formData.get("monthStart") ?? "");

  const { facts, observations, error } = await loadInsights(householdId, monthStart);

  if (error || !facts) {
    return { status: "error", message: "Couldn't load the figures to summarise." };
  }

  if (observations.length === 0) {
    return { status: "error", message: "Not enough activity this month to summarise." };
  }

  const prompt = [
    "You are summarising a two-person household's finances for the month.",
    "Below are figures that have ALREADY been calculated. Do not calculate anything,",
    "do not add figures that are not listed, and do not restate every line.",
    "Write 2-3 short, plain sentences a couple would actually find useful.",
    "Be direct and specific. No greetings, no bullet points, no financial advice disclaimers.",
    "",
    "Figures:",
    ...observations.map((o) => `- ${o.text}`),
  ].join("\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      return { status: "error", message: "The summary service didn't respond. The insights above still apply." };
    }

    const body = (await response.json()) as { content?: { type: string; text?: string }[] };
    const narrative = (body.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("")
      .trim();

    if (!narrative) {
      return { status: "error", message: "The summary came back empty. The insights above still apply." };
    }

    return { status: "success", narrative };
  } catch {
    return { status: "error", message: "Couldn't reach the summary service. The insights above still apply." };
  }
}
