"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  disconnectBankConnection,
  syncBankConnection,
  type BankActionState,
} from "@/lib/actions/bank";

const initialState: BankActionState = { status: "idle" };

export function ConnectionActions({ connectionId }: { connectionId: string }) {
  const [syncState, syncAction, isSyncing] = useActionState(
    syncBankConnection,
    initialState,
  );
  const [disconnectState, disconnectAction, isDisconnecting] = useActionState(
    disconnectBankConnection,
    initialState,
  );
  const messageRef = useRef<HTMLParagraphElement>(null);
  // Two-step confirm: disconnecting deletes the stored Akahu token from
  // Vault, so recovering means generating and pasting a new one from
  // my.akahu.nz. Cheap to guard, annoying to undo.
  const [isConfirmingDisconnect, setIsConfirmingDisconnect] = useState(false);

  const activeState = disconnectState.status === "error" ? disconnectState : syncState;

  useEffect(() => {
    if (activeState.status === "error") {
      messageRef.current?.focus();
    }
  }, [activeState]);

  return (
    <div className="flex flex-col items-end gap-2">
      {/* flex-wrap so the extra confirm/cancel buttons don't overflow on a phone */}
      <div className="flex flex-wrap justify-end gap-2">
        <form action={syncAction}>
          <input type="hidden" name="connectionId" value={connectionId} />
          <button
            type="submit"
            disabled={isSyncing || isDisconnecting}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {isSyncing ? "Syncing…" : "Sync now"}
          </button>
        </form>
        {isConfirmingDisconnect ? (
          <div className="flex items-center gap-2">
            <form action={disconnectAction}>
              <input type="hidden" name="connectionId" value={connectionId} />
              <button
                type="submit"
                disabled={isSyncing || isDisconnecting}
                className="rounded-md border border-destructive px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {isDisconnecting ? "Disconnecting…" : "Confirm disconnect"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => setIsConfirmingDisconnect(false)}
              disabled={isDisconnecting}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsConfirmingDisconnect(true)}
            disabled={isSyncing || isDisconnecting}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            Disconnect
          </button>
        )}
      </div>

      {activeState.status === "error" ? (
        <p
          ref={messageRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="text-sm text-destructive"
        >
          {activeState.message}
        </p>
      ) : null}
    </div>
  );
}
