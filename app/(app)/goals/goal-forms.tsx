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
import {
  fieldClass,
  fieldLabelClass,
  messageClass,
  primaryButtonClass,
  primaryButtonSmallClass,
  quietLinkClass,
} from "../ui";

// The only client code on Goals. Each form is rendered by the server *only
// when it is needed* — the page decides via search params — so the common
// path (just looking at your goals) ships almost no JavaScript.

const initialFormState: GoalFormState = { status: "idle" };

/* Contributing is the reason people open this screen, so it is the only
   always-visible control — a single field, no label chrome, no card. */
export function ContributeForm({ goalId }: { goalId: string }) {
  const [state, formAction, isPending] = useActionState(
    recordGoalContribution,
    initialFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="goalId" value={goalId} />
      <div className="flex items-center gap-3">
        <input
          name="amount"
          type="number"
          step="0.01"
          required
          disabled={isPending}
          aria-label="Amount to add"
          placeholder="Add an amount"
          className={fieldClass}
        />
        <button
          type="submit"
          disabled={isPending}
          className={"shrink-0 " + primaryButtonSmallClass}
        >
          {isPending ? "Adding…" : "Add"}
        </button>
      </div>
      {state.status === "error" ? (
        <p role="status" aria-live="polite" className="mt-4 text-[0.8125rem] text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function GoalFields({
  householdId,
  goal,
  submitLabel,
}: {
  householdId?: string;
  goal?: Goal;
  submitLabel: string;
}) {
  const action = goal ? updateGoal : createGoal;
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
      {goal ? <input type="hidden" name="goalId" value={goal.id} /> : null}

      <div>
        <label
          htmlFor={`name-${goal?.id ?? "new"}`}
          className={fieldLabelClass}
        >
          What are you saving for?
        </label>
        <input
          id={`name-${goal?.id ?? "new"}`}
          name="name"
          type="text"
          required
          disabled={isPending}
          defaultValue={goal?.name}
          placeholder="A trip, a deposit, a rainy day"
          className={fieldClass}
        />
      </div>

      <div>
        <label
          htmlFor={`target-${goal?.id ?? "new"}`}
          className={fieldLabelClass}
        >
          How much do you need?
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
          placeholder="5000"
          className={fieldClass}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className={primaryButtonClass}
      >
        {isPending ? "Saving…" : submitLabel}
      </button>

      {state.message ? (
        <p
          ref={messageRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className={messageClass(state.status === "error")}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/* Two-step, because removing a goal you've been funding is unrecoverable
   through the interface. Same pattern already used for disconnecting a bank. */
export function RemoveGoalButton({ goalId }: { goalId: string }) {
  const [state, formAction, isPending] = useActionState(archiveGoal, initialFormState);
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
        <input type="hidden" name="goalId" value={goalId} />
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
