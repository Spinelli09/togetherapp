"use client";

import { useActionState } from "react";

import { generateNarrative, type NarrativeState } from "@/lib/actions/insights";

const initialState: NarrativeState = { status: "idle" };

// The only client component on the dashboard. The insights themselves are
// server-rendered and deterministic; this just requests the optional
// written summary on demand, so no LLM call happens on page load.
export function InsightsNarrative({
  householdId,
  monthStart,
}: {
  householdId: string;
  monthStart: string;
}) {
  const [state, formAction, isPending] = useActionState(generateNarrative, initialState);

  return (
    <div className="mt-4">
      {state.status === "success" && state.narrative ? (
        <p className="rounded-md bg-accent/50 px-3 py-2.5 text-sm leading-relaxed text-foreground">
          {state.narrative}
        </p>
      ) : null}

      {state.status === "error" || state.status === "unavailable" ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {state.message}
        </p>
      ) : null}

      {state.status !== "success" ? (
        <form action={formAction} className="mt-2">
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="monthStart" value={monthStart} />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {isPending ? "Summarising…" : "Summarise this month"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
