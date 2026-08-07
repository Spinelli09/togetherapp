"use client";

import { useActionState, useEffect, useRef } from "react";

import { invitePartner, type InviteState } from "@/lib/actions/invites";
import { fieldClass, fieldLabelClass, primaryButtonClass } from "../../ui";

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
        <label htmlFor="invite-email" className={fieldLabelClass}>
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
            className={fieldClass}
            placeholder="partner@example.com"
          />
          <button
            type="submit"
            disabled={isPending}
            className={primaryButtonClass}
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
