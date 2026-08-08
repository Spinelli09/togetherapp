"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { requestPasswordReset, type AuthState } from "@/lib/actions/auth";
import { fieldClass, fieldLabelClass, primaryButtonClass, quietLinkClass } from "@/app/(app)/ui";

const initialState: AuthState = { status: "idle" };

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordReset,
    initialState,
  );
  const [failedRecovery, setFailedRecovery] = useState(false);
  const messageRef = useRef<HTMLParagraphElement>(null);

  // /auth/callback sends people here when a recovery link can't be
  // verified — expired, already used, or opened on a different device than
  // it was requested from.
  useEffect(() => {
    setFailedRecovery(
      new URLSearchParams(window.location.search).get("error") !== null,
    );
  }, []);

  useEffect(() => {
    if (state.status !== "idle") {
      messageRef.current?.focus();
    }
  }, [state]);

  const isError = state.status === "error";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">
          Reset your password
        </h1>
        <p className="mt-3 text-center text-[0.8125rem] leading-relaxed text-muted-foreground">
          {failedRecovery
            ? "That reset link has expired or has already been used. Request a new one."
            : "We'll email you a link to choose a new one."}
        </p>

        <form action={formAction} className="mt-10 space-y-6">
          <div className="space-y-2">
            <label htmlFor="email" className={fieldLabelClass}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              disabled={isPending}
              aria-invalid={isError}
              aria-describedby={state.message ? "reset-message" : undefined}
              className={fieldClass}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            aria-busy={isPending}
            className={primaryButtonClass + " w-full"}
          >
            {isPending ? "Sending…" : "Send reset link"}
          </button>

          {state.message ? (
            <p
              id="reset-message"
              ref={messageRef}
              tabIndex={-1}
              role={isError ? "alert" : "status"}
              aria-live={isError ? "assertive" : "polite"}
              className={
                "animate-in fade-in slide-in-from-bottom-1 text-[0.8125rem] duration-200 ease-out motion-reduce:animate-none " +
                (isError ? "text-destructive" : "text-muted-foreground")
              }
            >
              {state.message}
            </p>
          ) : null}
        </form>

        <p className="mt-8 text-center">
          <Link href="/login" className={quietLinkClass}>
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
