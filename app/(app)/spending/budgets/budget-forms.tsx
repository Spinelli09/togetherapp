"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  createBudget,
  deactivateBudget,
  updateBudget,
  type BudgetCategoryAssignment,
  type BudgetFormState,
  type CategoryOption,
} from "@/lib/actions/budgets";
import { Settle } from "../../reveal";
import {
  fieldClass,
  fieldLabelClass,
  messageClass,
  primaryButtonClass,
  quietLinkClass,
} from "../../ui";

// The only client code on Budgets. The page renders these solely when a
// search param asks for them, so simply reading your budgets — which is
// almost every visit — ships no form JavaScript at all.

const initialFormState: BudgetFormState = { status: "idle" };

// Chips rather than bordered checkboxes: the real input stays for
// accessibility, the visible state is carried by fill. Ten bordered boxes
// was the single noisiest element on the old screen.
function CategoryChips({
  categoryOptions,
  defaultSelected,
  disabled,
}: {
  categoryOptions: CategoryOption[];
  defaultSelected?: string[];
  disabled: boolean;
}) {
  return (
    <fieldset>
      <legend className={fieldLabelClass}>
        Which spending counts towards it?
      </legend>
      <div className="mt-4 flex flex-wrap gap-2">
        {categoryOptions.map((category) => (
          <label
            key={category.id}
            className="cursor-pointer select-none rounded-full bg-muted px-3.5 py-1.5 text-[0.8125rem] text-muted-foreground transition-colors has-[:checked]:bg-foreground has-[:checked]:text-background has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
          >
            <input
              type="checkbox"
              name="categoryIds"
              value={category.id}
              disabled={disabled}
              defaultChecked={defaultSelected?.includes(category.id)}
              className="sr-only"
            />
            {category.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function BudgetFields({
  householdId,
  categoryOptions,
  budget,
  defaultLimit,
  submitLabel,
}: {
  householdId?: string;
  categoryOptions: CategoryOption[];
  budget?: BudgetCategoryAssignment;
  defaultLimit?: number;
  submitLabel: string;
}) {
  const action = budget ? updateBudget : createBudget;
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.status !== "idle") {
      messageRef.current?.focus();
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      {householdId ? <input type="hidden" name="householdId" value={householdId} /> : null}
      {budget ? <input type="hidden" name="budgetId" value={budget.id} /> : null}

      <div>
        <label
          htmlFor={`name-${budget?.id ?? "new"}`}
          className={fieldLabelClass}
        >
          What are you keeping an eye on?
        </label>
        <input
          id={`name-${budget?.id ?? "new"}`}
          name="name"
          type="text"
          required
          disabled={isPending}
          defaultValue={budget?.name}
          placeholder="Groceries, eating out, transport"
          className={fieldClass}
        />
      </div>

      <div>
        <label
          htmlFor={`limit-${budget?.id ?? "new"}`}
          className={fieldLabelClass}
        >
          How much a month?
        </label>
        <input
          id={`limit-${budget?.id ?? "new"}`}
          name="monthlyLimit"
          type="number"
          min="0.01"
          step="0.01"
          required
          disabled={isPending}
          defaultValue={defaultLimit}
          placeholder="500"
          className={fieldClass}
        />
      </div>

      <CategoryChips
        categoryOptions={categoryOptions}
        defaultSelected={budget?.categories.map((c) => c.id)}
        disabled={isPending}
      />

      <button
        type="submit"
        disabled={isPending}
        className={primaryButtonClass}
      >
        {isPending ? "Saving…" : submitLabel}
      </button>

      {state.message ? (
        <Settle>
          <p
            ref={messageRef}
            tabIndex={-1}
            role="status"
            aria-live="polite"
            className={messageClass(state.status === "error")}
          >
            {state.message}
          </p>
        </Settle>
      ) : null}
    </form>
  );
}

// Two-step. Removing a budget is unrecoverable through the interface, and
// this was previously a single tap — the same pattern already used for
// goals and for disconnecting a bank.
export function RemoveBudgetButton({ budgetId }: { budgetId: string }) {
  const [state, formAction, isPending] = useActionState(deactivateBudget, initialFormState);
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <button type="button" onClick={() => setIsConfirming(true)} className={quietLinkClass}>
        Remove
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-3">
      <form action={formAction} className="inline">
        <input type="hidden" name="budgetId" value={budgetId} />
        <button
          type="submit"
          disabled={isPending}
          className="text-[0.8125rem] text-destructive underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {isPending ? "Removing…" : "Really remove"}
        </button>
      </form>
      <button type="button" onClick={() => setIsConfirming(false)} className={quietLinkClass}>
        Keep
      </button>
      {state.status === "error" ? (
        <span role="status" aria-live="polite" className="text-[0.8125rem] text-destructive">
          {state.message}
        </span>
      ) : null}
    </span>
  );
}
