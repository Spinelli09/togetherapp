"use client";

import { useActionState, useEffect, useRef } from "react";

import { updatePassword, type AuthState } from "@/lib/actions/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { fieldClass, fieldLabelClass, primaryButtonClass } from "@/app/(app)/ui";

const initialState: AuthState = { status: "idle" };

// Reached only from /auth/callback, which has already verified the recovery
// token_hash and established a session. Setting the password here is
// therefore an ordinary authenticated update, not a second authentication
// step.
export default function ResetPasswordPage() {
  const [state, formAction, isPending] = useActionState(
    updatePassword,
    initialState,
  );
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.status === "error") {
      messageRef.current?.focus();
    }
  }, [state]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">
          Choose a password
        </h1>
        <p className="mt-3 text-center text-[0.8125rem] leading-relaxed text-muted-foreground">
          At least {MIN_PASSWORD_LENGTH} characters. You&apos;ll stay signed in on this
          device.
        </p>

        <form action={formAction} className="mt-10 space-y-6">
          <div className="space-y-2">
            <label htmlFor="password" className={fieldLabelClass}>
              New password
            </label>
            {/* new-password rather than current-password, so a password
                manager offers to generate one and then to save it. */}
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              disabled={isPending}
              aria-invalid={state.status === "error"}
              aria-describedby={state.message ? "password-message" : undefined}
              className={fieldClass}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            aria-busy={isPending}
            className={primaryButtonClass + " w-full"}
          >
            {isPending ? "Saving…" : "Save password"}
          </button>

          {state.message ? (
            <p
              id="password-message"
              ref={messageRef}
              tabIndex={-1}
              role="alert"
              aria-live="assertive"
              className="animate-in fade-in slide-in-from-bottom-1 text-[0.8125rem] text-destructive duration-200 ease-out motion-reduce:animate-none"
            >
              {state.message}
            </p>
          ) : null}
        </form>
      </div>
    </main>
  );
}
