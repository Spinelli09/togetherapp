"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  archiveGoal,
  createGoal,
  recordGoalContribution,
  updateGoal,
  type Goal,
  type GoalFormState,
} from "@/lib/actions/goals";

const initialFormState: GoalFormState = { status: "idle" };

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(amount);
}

function GoalForm({
  householdId,
  goal,
  onDone,
}: {
  householdId?: string;
  goal?: Goal;
  onDone?: () => void;
}) {
  const action = goal ? updateGoal : createGoal;
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status !== "idle") {
      messageRef.current?.focus();
    }
    if (state.status === "success") {
      formRef.current?.reset();
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {householdId ? <input type="hidden" name="householdId" value={householdId} /> : null}
      {goal ? <input type="hidden" name="goalId" value={goal.id} /> : null}

      <div className="space-y-2">
        <label htmlFor={`name-${goal?.id ?? "new"}`} className="text-sm font-medium text-foreground">
          Name
        </label>
        <input
          id={`name-${goal?.id ?? "new"}`}
          name="name"
          type="text"
          required
          disabled={isPending}
          defaultValue={goal?.name}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          placeholder="e.g. Emergency fund"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor={`target-${goal?.id ?? "new"}`} className="text-sm font-medium text-foreground">
          Target amount
        </label>
        <input
          id={`target-${goal?.id ?? "new"}`}
          name="targetAmount"
          type="number"
          min="0.01"
          step="0.01"
          required
          disabled={isPending}
          defaultValue={goal?.targetAmount}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          placeholder="5000.00"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {isPending ? "Saving…" : goal ? "Save changes" : "Add goal"}
      </button>

      {state.message ? (
        <p
          ref={messageRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className={
            state.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function ContributionForm({ goalId }: { goalId: string }) {
  const [state, formAction, isPending] = useActionState(recordGoalContribution, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex items-start gap-2">
      <input type="hidden" name="goalId" value={goalId} />
      <div className="flex-1">
        <input
          name="amount"
          type="number"
          step="0.01"
          required
          disabled={isPending}
          aria-label="Contribution amount"
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          placeholder="50.00 (negative to correct)"
        />
        {state.status === "error" ? (
          <p role="status" aria-live="polite" className="mt-1 text-xs text-destructive">
            {state.message}
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {isPending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}

function ArchiveGoalButton({ goalId }: { goalId: string }) {
  const [state, formAction, isPending] = useActionState(archiveGoal, initialFormState);

  return (
    <form action={formAction}>
      <input type="hidden" name="goalId" value={goalId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {isPending ? "Removing…" : "Remove"}
      </button>
      {state.status === "error" ? (
        <p role="status" aria-live="polite" className="mt-1 text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const [isEditing, setIsEditing] = useState(false);
  // Clamped for the bar only — a goal can be saved past its target (§8.4
  // of the design doc), and the underlying numbers must keep saying so.
  const percent = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
  const clampedPercent = Math.min(100, Math.max(0, percent));

  if (isEditing) {
    return (
      <div className="rounded-md border border-border p-4">
        <GoalForm goal={goal} onDone={() => setIsEditing(false)} />
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="mt-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-foreground">{goal.name}</p>
          {goal.status !== "active" ? (
            <span className="mt-1 inline-block rounded-full bg-accent px-2 py-0.5 text-xs capitalize text-accent-foreground">
              {goal.status}
            </span>
          ) : null}
        </div>
        <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
          {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
        </p>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-accent">
        <div
          className="h-full rounded-full bg-foreground"
          style={{ width: `${clampedPercent}%` }}
        />
      </div>

      {goal.status !== "archived" ? (
        <ContributionForm goalId={goal.id} />
      ) : null}

      <div className="flex justify-end gap-2">
        {goal.status !== "archived" ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Edit
          </button>
        ) : null}
        {goal.status !== "archived" ? <ArchiveGoalButton goalId={goal.id} /> : null}
      </div>
    </div>
  );
}

export function GoalList({
  householdId,
  initialGoals,
}: {
  householdId: string;
  initialGoals: Goal[];
}) {
  const visibleGoals = initialGoals.filter((g) => g.status !== "archived");

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        {visibleGoals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No goals yet — add one below.</p>
        ) : (
          visibleGoals.map((goal) => <GoalCard key={goal.id} goal={goal} />)
        )}
      </div>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Add a goal
        </h2>
        <div className="mt-3">
          <GoalForm householdId={householdId} />
        </div>
      </section>
    </div>
  );
}
