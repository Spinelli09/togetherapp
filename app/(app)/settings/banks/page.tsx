import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { ConnectBankForm } from "./connect-bank-form";
import { ConnectionActions } from "./connection-actions";

function StatusPill({ status }: { status: string }) {
  const isError = status === "error";
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-xs font-medium capitalize " +
        (isError
          ? "bg-destructive/10 text-destructive"
          : "bg-accent text-accent-foreground")
      }
    >
      {status}
    </span>
  );
}

function formatBalance(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(amount);
}

export default async function BanksSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return null;
  }

  const { data: connections } = await supabase
    .from("bank_connections")
    .select(
      "id, institution, status, last_sync_at, bank_accounts(id, account_name, account_type, currency, current_balance, available_balance)",
    )
    .eq("household_id", membership.household_id)
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-12">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        ← Back to dashboard
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Connected banks
      </h1>

      <section className="mt-8 space-y-4">
        {(connections ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No banks connected yet.
          </p>
        ) : (
          (connections ?? []).map((connection) => (
            <div
              key={connection.id}
              className="space-y-4 rounded-md border border-border p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">{connection.institution}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {connection.last_sync_at
                      ? `Last synced ${new Date(connection.last_sync_at).toLocaleString()}`
                      : "Never synced"}
                  </p>
                </div>
                <StatusPill status={connection.status} />
              </div>

              {connection.bank_accounts.length > 0 ? (
                <ul className="space-y-2">
                  {connection.bank_accounts.map((account) => (
                    <li
                      key={account.id}
                      className="flex items-center justify-between rounded-md bg-accent/40 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="text-foreground">{account.account_name}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {account.account_type.toLowerCase()}
                        </p>
                      </div>
                      <p className="font-medium tabular-nums text-foreground">
                        {formatBalance(account.current_balance, account.currency)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No accounts yet — try Sync now.</p>
              )}

              {connection.status === "active" ? (
                <div className="flex justify-end">
                  <ConnectionActions connectionId={connection.id} />
                </div>
              ) : (
                <p className="text-right text-sm text-muted-foreground">
                  Disconnected — accounts and transactions above are kept for your records.
                  Reconnect below to resume syncing.
                </p>
              )}
            </div>
          ))
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Connect a bank
        </h2>
        <div className="mt-3">
          <ConnectBankForm householdId={membership.household_id} />
        </div>
      </section>
    </main>
  );
}
