"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { requestMagicLink, type MagicLinkState } from "@/lib/actions/auth";
import { fieldClass, fieldLabelClass, primaryButtonClass } from "@/app/(app)/ui";

const initialState: MagicLinkState = { status: "idle" };

// app/auth/callback/route.ts passes a specific reason on every failure.
// Collapsing them into one message told users the link had expired even
// when it hadn't — and for provisioning_failed it advised an action that
// cannot possibly help, leaving them looping on the sign-in screen.
const LINK_ERROR_MESSAGES: Record<string, string> = {
  missing_code: "That sign-in link isn't valid anymore. Request a new one below.",
  // PKCE keeps the verifier on the device that requested the link, so
  // opening it elsewhere fails even though the link itself is valid.
  // Requesting another link also fixes a genuinely reused code, so this
  // advice is right for both causes.
  exchange_failed:
    "We couldn't complete your sign-in. If you opened the link on a different device, request a new one and open it on the same device you requested it from.",
  // Server-side: the account exists but the household couldn't be created.
  // Deliberately does not suggest a new link, which would change nothing.
  provisioning_failed:
    "We couldn't finish setting up your account. Please try signing in again in a moment. If the problem continues, let us know.",
};

const FALLBACK_LINK_ERROR =
  "Something went wrong signing you in. Request a new sign-in link below.";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(
    requestMagicLink,
    initialState,
  );
  const [linkErrorCode, setLinkErrorCode] = useState<string | null>(null);
  const [next, setNext] = useState("");
  const [prefillEmail, setPrefillEmail] = useState("");
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setLinkErrorCode(params.get("error"));
    setNext(params.get("next") ?? "");
    setPrefillEmail(params.get("email") ?? "");
  }, []);

  useEffect(() => {
    if (state.status !== "idle" || linkErrorCode) {
      messageRef.current?.focus();
    }
  }, [state, linkErrorCode]);

  const linkErrorMessage = linkErrorCode
    ? (LINK_ERROR_MESSAGES[linkErrorCode] ?? FALLBACK_LINK_ERROR)
    : undefined;
  const displayMessage = state.message ?? linkErrorMessage;
  const displayIsError = state.status === "error" || linkErrorCode !== null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">
          Together
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Sign in with a magic link — no password needed.
        </p>

        <form
          action={formAction}
          onSubmit={() => setLinkErrorCode(null)}
          className="mt-8 space-y-4"
        >
          <input type="hidden" name="next" value={next} />
          <div className="space-y-2">
            <label
              htmlFor="email"
              className={fieldLabelClass}
            >
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={isPending}
              defaultValue={prefillEmail}
              aria-describedby={displayMessage ? "auth-message" : undefined}
              className={fieldClass}
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className={primaryButtonClass + " w-full"}
          >
            {isPending ? "Sending…" : "Send magic link"}
          </button>

          {displayMessage ? (
            <p
              id="auth-message"
              ref={messageRef}
              tabIndex={-1}
              role="status"
              aria-live="polite"
              className={
                displayIsError
                  ? "text-[0.8125rem] text-destructive"
                  : "text-[0.8125rem] text-muted-foreground"
              }
            >
              {displayMessage}
            </p>
          ) : null}
        </form>
      </div>
    </main>
  );
}
