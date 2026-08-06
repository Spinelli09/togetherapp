"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  status: "active" | "completed" | "archived";
  completedAt: string | null;
};

// Plain RLS-protected select, not an RPC — unlike Budgets' progress, a
// goal's current_amount is a real stored column, not an aggregate over
// another table, so there's nothing to compute. See Milestone 8 design
// doc §4.
export async function loadHouseholdGoals(householdId: string): Promise<Goal[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("goals")
    .select("id, name, target_amount, current_amount, status, completed_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((goal) => ({
    id: goal.id,
    name: goal.name,
    targetAmount: goal.target_amount,
    currentAmount: goal.current_amount,
    status: goal.status as Goal["status"],
    completedAt: goal.completed_at,
  }));
}

export type GoalFormState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function createGoal(
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const householdId = String(formData.get("householdId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const targetAmount = Number(formData.get("targetAmount"));

  if (!name) {
    return { status: "error", message: "Enter a goal name." };
  }
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return { status: "error", message: "Enter a target amount greater than zero." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_goal", {
    p_household_id: householdId,
    p_name: name,
    p_target_amount: targetAmount,
  });

  if (error) {
    return { status: "error", message: "Couldn't create goal." };
  }

  revalidatePath("/goals");
  return { status: "success", message: "Goal created." };
}

export async function updateGoal(
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const goalId = String(formData.get("goalId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const targetAmount = Number(formData.get("targetAmount"));

  if (!name) {
    return { status: "error", message: "Enter a goal name." };
  }
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return { status: "error", message: "Enter a target amount greater than zero." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_goal", {
    p_goal_id: goalId,
    p_name: name,
    p_target_amount: targetAmount,
  });

  if (error) {
    return { status: "error", message: "Couldn't update goal." };
  }

  revalidatePath("/goals");
  return { status: "success", message: "Goal updated." };
}

// A single signed amount field carries the meaning — positive to
// contribute, negative to correct/withdraw — rather than two separate
// actions. See Milestone 8 design doc §6.
export async function recordGoalContribution(
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const goalId = String(formData.get("goalId") ?? "");
  const amount = Number(formData.get("amount"));

  if (!Number.isFinite(amount) || amount === 0) {
    return { status: "error", message: "Enter a non-zero amount." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_goal_contribution", {
    p_goal_id: goalId,
    p_amount: amount,
  });

  if (error) {
    return {
      status: "error",
      message:
        error.message === "contribution_exceeds_balance"
          ? "That would take this goal below zero."
          : "Couldn't record that contribution.",
    };
  }

  revalidatePath("/goals");
  return { status: "success" };
}

export async function archiveGoal(
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const goalId = String(formData.get("goalId") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_goal", {
    p_goal_id: goalId,
  });

  if (error) {
    return { status: "error", message: "Couldn't remove goal." };
  }

  revalidatePath("/goals");
  return { status: "success" };
}
