"use client";

import { useActionState, useEffect, useRef } from "react";

import { setPasswordAndAcceptInvite, type AcceptInviteState } from "@/lib/actions/invites";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { fieldClass, fieldLabelClass, primaryButtonClass } from "@/app/(app)/ui";

const initialState: AcceptInviteState = { status: "idle" };

function Message({ message }: { message: string }) {
  return (
    <p
      role="alert"
      aria-live="assertive"
      className="animate-in fade-in slide-in-from-bottom-1 text-[0.8125rem] text-destructive duration-200 ease-out motion-reduce:animate-none"
    >
      {message}
    </p>
  );
}

/**
 * Signed in via the emailed invite link, no password set yet: choose one
 * and join, in one step.
 *
 * Reaching this form at all means /auth/callback already verified the
 * invite email's token_hash and established a session — the account exists
 * and this address is proven, both before this component ever renders. So
 * this only ever calls auth.updateUser() (via setPasswordAndAcceptInvite),
 * never anything account-creating.
 *
 * The email is shown read-only, not editable — it isn't a choice here —
 * mainly so a password manager has a username to associate the new
 * password with when it offers to save it.
 */
export function SetPasswordForm({
  token,
  email,
  householdName,
}: {
  token: string;
  email: string;
  householdName: string;
}) {
  const [state, formAction, isPending] = useActionState(
    setPasswordAndAcceptInvite,
    initialState,
  );
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "error") {
      messageRef.current?.focus();
    }
  }, [state]);

  return (
    <form action={formAction} className="mt-10 space-y-6 text-left">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-2">
        <label htmlFor="invite-email" className={fieldLabelClass}>
          Email
        </label>
        <input
          id="invite-email"
          type="email"
          autoComplete="username"
          value={email}
          readOnly
          className={fieldClass + " text-muted-foreground"}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="invite-password" className={fieldLabelClass}>
          Choose a password
        </label>
        <input
          id="invite-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          disabled={isPending}
          aria-invalid={state.status === "error"}
          aria-describedby="invite-password-hint"
          className={fieldClass}
        />
        <p id="invite-password-hint" className="text-[0.75rem] text-muted-foreground">
          At least {MIN_PASSWORD_LENGTH} characters.
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className={primaryButtonClass + " w-full"}
      >
        {isPending ? "Joining…" : `Join ${householdName}`}
      </button>

      <div ref={messageRef} tabIndex={-1}>
        {state.status === "error" && state.message ? (
          <Message message={state.message} />
        ) : null}
      </div>
    </form>
  );
}
