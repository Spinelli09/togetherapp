"use client";

import { useActionState, useEffect, useRef } from "react";

import { acceptInvite, type AcceptInviteState } from "@/lib/actions/invites";

const initialState: AcceptInviteState = { status: "idle" };

export function AcceptForm({
  token,
  householdName,
}: {
  token: string;
  householdName: string;
}) {
  const [state, formAction, isPending] = useActionState(
    acceptInvite,
    initialState,
  );
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.status === "error") {
      messageRef.current?.focus();
    }
  }, [state]);

  return (
    <form action={formAction} className="mt-6 space-y-3">
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {isPending ? "Joining…" : `Join ${householdName}`}
      </button>

      {state.status === "error" ? (
        <p
          ref={messageRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="text-sm text-destructive"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
