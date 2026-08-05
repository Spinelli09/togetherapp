"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type BudgetProgressRow = {
  budgetId: string;
  name: string;
  monthlyLimit: number;
  // The UI (budget-list.tsx) only ever renders netSpent — grossSpent is
  // carried through unrendered so a future dashboard/insights consumer
  // can read it without any redesign here. See Milestone 7 design doc §5.
  netSpent: number;
  grossSpent: number;
  remaining: number;
  percentUsed: number;
};

export type BudgetProgressResult = {
  budgets: BudgetProgressRow[];
  error?: string;
};

export async function loadBudgetProgress(
  householdId: string,
  monthStart: string,
): Promise<BudgetProgressResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_household_budget_progress", {
    p_household_id: householdId,
    p_month_start: monthStart,
  });

  if (error || !data) {
    return { budgets: [], error: "Couldn't load budgets." };
  }

  return {
    budgets: data.map((row) => {
      const monthlyLimit = row.monthly_limit;
      const netSpent = row.net_spent;
      return {
        budgetId: row.budget_id,
        name: row.name,
        monthlyLimit,
        netSpent,
        grossSpent: row.gross_spent,
        remaining: monthlyLimit - netSpent,
        percentUsed: monthlyLimit > 0 ? (netSpent / monthlyLimit) * 100 : 0,
      };
    }),
  };
}

export type CategoryOption = {
  id: string;
  name: string;
};

export async function loadCategoryOptions(): Promise<CategoryOption[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .order("display_order", { ascending: true });

  return data ?? [];
}

export type BudgetCategoryAssignment = {
  id: string;
  name: string;
  categories: CategoryOption[];
};

// The progress RPC returns only aggregates (§5) — category assignments
// come from a plain RLS-protected relational read, same pattern as the
// bank_accounts embed in settings/banks/page.tsx, not a second RPC.
export async function loadHouseholdBudgets(
  householdId: string,
): Promise<BudgetCategoryAssignment[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("budgets")
    .select("id, name, budget_categories(categories(id, name))")
    .eq("household_id", householdId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return (data ?? []).map((budget) => ({
    id: budget.id,
    name: budget.name,
    categories: budget.budget_categories
      .map((bc) => bc.categories)
      .filter((category): category is CategoryOption => category !== null),
  }));
}

export type BudgetFormState = {
  status: "idle" | "success" | "error";
  message?: string;
};

function parseBudgetForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const monthlyLimit = Number(formData.get("monthlyLimit"));
  const categoryIds = formData.getAll("categoryIds").map(String);

  if (!name) {
    return { error: "Enter a budget name." } as const;
  }
  if (!Number.isFinite(monthlyLimit) || monthlyLimit <= 0) {
    return { error: "Enter a monthly limit greater than zero." } as const;
  }
  if (categoryIds.length === 0) {
    return { error: "Select at least one category." } as const;
  }

  return { name, monthlyLimit, categoryIds } as const;
}

export async function createBudget(
  _prevState: BudgetFormState,
  formData: FormData,
): Promise<BudgetFormState> {
  const householdId = String(formData.get("householdId") ?? "");
  const parsed = parseBudgetForm(formData);

  if ("error" in parsed) {
    return { status: "error", message: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_budget", {
    p_household_id: householdId,
    p_name: parsed.name,
    p_monthly_limit: parsed.monthlyLimit,
    p_category_ids: parsed.categoryIds,
  });

  if (error) {
    return { status: "error", message: "Couldn't create budget." };
  }

  revalidatePath("/budgets");
  return { status: "success", message: "Budget created." };
}

export async function updateBudget(
  _prevState: BudgetFormState,
  formData: FormData,
): Promise<BudgetFormState> {
  const budgetId = String(formData.get("budgetId") ?? "");
  const parsed = parseBudgetForm(formData);

  if ("error" in parsed) {
    return { status: "error", message: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_budget", {
    p_budget_id: budgetId,
    p_name: parsed.name,
    p_monthly_limit: parsed.monthlyLimit,
    p_category_ids: parsed.categoryIds,
  });

  if (error) {
    return { status: "error", message: "Couldn't update budget." };
  }

  revalidatePath("/budgets");
  return { status: "success", message: "Budget updated." };
}

export async function deactivateBudget(
  _prevState: BudgetFormState,
  formData: FormData,
): Promise<BudgetFormState> {
  const budgetId = String(formData.get("budgetId") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.rpc("deactivate_budget", {
    p_budget_id: budgetId,
  });

  if (error) {
    return { status: "error", message: "Couldn't remove budget." };
  }

  revalidatePath("/budgets");
  return { status: "success" };
}
