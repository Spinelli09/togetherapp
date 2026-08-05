"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  createBudget,
  deactivateBudget,
  updateBudget,
  type BudgetCategoryAssignment,
  type BudgetFormState,
  type BudgetProgressResult,
  type BudgetProgressRow,
  type CategoryOption,
} from "@/lib/actions/budgets";

const initialFormState: BudgetFormState = { status: "idle" };

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(amount);
}

function CategoryCheckboxes({
  categoryOptions,
  defaultSelected,
  disabled,
}: {
  categoryOptions: CategoryOption[];
  defaultSelected?: string[];
  disabled: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">Categories</legend>
      <div className="flex flex-wrap gap-2">
        {categoryOptions.map((category) => (
          <label
            key={category.id}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-foreground"
          >
            <input
              type="checkbox"
              name="categoryIds"
              value={category.id}
              disabled={disabled}
              defaultChecked={defaultSelected?.includes(category.id)}
              className="accent-foreground"
            />
            {category.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function BudgetForm({
  householdId,
  categoryOptions,
  budget,
  onDone,
}: {
  householdId?: string;
  categoryOptions: CategoryOption[];
  budget?: BudgetCategoryAssignment;
  onDone?: () => void;
}) {
  const action = budget ? updateBudget : createBudget;
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
    // onDone is stable-enough per render for this form's lifetime; omitting
    // it from deps avoids re-focusing on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {householdId ? <input type="hidden" name="householdId" value={householdId} /> : null}
      {budget ? <input type="hidden" name="budgetId" value={budget.id} /> : null}

      <div className="space-y-2">
        <label htmlFor={`name-${budget?.id ?? "new"}`} className="text-sm font-medium text-foreground">
          Name
        </label>
        <input
          id={`name-${budget?.id ?? "new"}`}
          name="name"
          type="text"
          required
          disabled={isPending}
          defaultValue={budget?.name}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          placeholder="e.g. Groceries budget"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor={`limit-${budget?.id ?? "new"}`} className="text-sm font-medium text-foreground">
          Monthly limit
        </label>
        <input
          id={`limit-${budget?.id ?? "new"}`}
          name="monthlyLimit"
          type="number"
          min="0.01"
          step="0.01"
          required
          disabled={isPending}
          defaultValue={undefined}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          placeholder="500.00"
        />
      </div>

      <CategoryCheckboxes
        categoryOptions={categoryOptions}
        defaultSelected={budget?.categories.map((c) => c.id)}
        disabled={isPending}
      />

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {isPending ? "Saving…" : budget ? "Save changes" : "Add budget"}
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

function RemoveBudgetButton({ budgetId }: { budgetId: string }) {
  const [state, formAction, isPending] = useActionState(deactivateBudget, initialFormState);

  return (
    <form action={formAction}>
      <input type="hidden" name="budgetId" value={budgetId} />
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

function BudgetCard({
  progress,
  assignment,
  categoryOptions,
}: {
  progress: BudgetProgressRow;
  assignment?: BudgetCategoryAssignment;
  categoryOptions: CategoryOption[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const isOverOrNear = progress.percentUsed >= 90;

  if (isEditing && assignment) {
    return (
      <div className="rounded-md border border-border p-4">
        <BudgetForm
          categoryOptions={categoryOptions}
          budget={assignment}
          onDone={() => setIsEditing(false)}
        />
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
          <p className="font-medium text-foreground">{progress.name}</p>
          {assignment && assignment.categories.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {assignment.categories.map((category) => (
                <span
                  key={category.id}
                  className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
                >
                  {category.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
          {formatCurrency(progress.netSpent)} / {formatCurrency(progress.monthlyLimit)}
        </p>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-accent">
        <div
          className={"h-full rounded-full " + (isOverOrNear ? "bg-destructive" : "bg-foreground")}
          style={{ width: `${Math.min(100, Math.max(0, progress.percentUsed))}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className={"text-xs " + (progress.remaining < 0 ? "text-destructive" : "text-muted-foreground")}>
          {progress.remaining < 0
            ? `${formatCurrency(Math.abs(progress.remaining))} over budget`
            : `${formatCurrency(progress.remaining)} remaining`}
        </p>
        <div className="flex gap-2">
          {assignment ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Edit
            </button>
          ) : null}
          <RemoveBudgetButton budgetId={progress.budgetId} />
        </div>
      </div>
    </div>
  );
}

export function BudgetList({
  householdId,
  initialProgress,
  budgets,
  categoryOptions,
}: {
  householdId: string;
  initialProgress: BudgetProgressResult;
  budgets: BudgetCategoryAssignment[];
  categoryOptions: CategoryOption[];
}) {
  const budgetsById = new Map(budgets.map((b) => [b.id, b]));

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        {initialProgress.budgets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {initialProgress.error ?? "No budgets yet — add one below."}
          </p>
        ) : (
          initialProgress.budgets.map((progress) => (
            <BudgetCard
              key={progress.budgetId}
              progress={progress}
              assignment={budgetsById.get(progress.budgetId)}
              categoryOptions={categoryOptions}
            />
          ))
        )}
      </div>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Add a budget
        </h2>
        <div className="mt-3">
          <BudgetForm householdId={householdId} categoryOptions={categoryOptions} />
        </div>
      </section>
    </div>
  );
}
