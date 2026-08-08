"use client";

import { useActionState, useEffect, useRef } from "react";

import { connectBankAccount, type ConnectBankState } from "@/lib/actions/bank";
import { Settle } from "../../reveal";
import { fieldClass, fieldLabelClass, primaryButtonClass } from "../../ui";

const initialState: ConnectBankState = { status: "idle" };

export function ConnectBankForm({ householdId }: { householdId: string }) {
  const [state, formAction, isPending] = useActionState(
    connectBankAccount,
    initialState,
  );
  const messageRef = useRef<HTMLParagraphElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status !== "idle") {
      messageRef.current?.focus();
    }
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="householdId" value={householdId} />
      <div className="space-y-2">
        <label htmlFor="pastedToken" className={fieldLabelClass}>
          Akahu personal access token
        </label>
        <p className="text-sm text-muted-foreground">
          Connect ANZ (and any other bank) to your Akahu account first at{" "}
          <a
            href="https://my.akahu.nz"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            my.akahu.nz
          </a>
          , then paste your personal access token below.
        </p>
        <input
          id="pastedToken"
          name="pastedToken"
          type="password"
          autoComplete="off"
          required
          disabled={isPending}
          className={fieldClass}
          placeholder="Paste token"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className={primaryButtonClass}
      >
        {isPending ? "Connecting…" : "Connect bank"}
      </button>

      {state.message ? (
        <Settle>
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
        </Settle>
      ) : null}
    </form>
  );
}
