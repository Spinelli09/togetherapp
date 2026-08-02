"use client";

import { useActionState, useEffect, useRef } from "react";

import { invitePartner, type InviteState } from "@/lib/actions/invites";

const initialState: InviteState = { status: "idle" };

export function InviteForm({ householdId }: { householdId: string }) {
  const [state, formAction, isPending] = useActionState(
    invitePartner,
    initialState,
  );
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.status !== "idle") {
      messageRef.current?.focus();
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="householdId" value={householdId} />
      <div className="space-y-2">
        <label htmlFor="invite-email" className="text-sm font-medium text-foreground">
          Partner&apos;s email
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="invite-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={isPending}
            className="w-full flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            placeholder="partner@example.com"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:w-auto"
          >
            {isPending ? "Sending…" : "Send invite"}
          </button>
        </div>
      </div>

      {state.message ? (
        <p
          ref={messageRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className={
            state.status === "error"
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
