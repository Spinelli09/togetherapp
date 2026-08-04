// Shared by sync-accounts and akahu-oauth-exchange so transaction sync
// has exactly one implementation, not two — see Milestone 6 design doc
// §15 ("shares the same internal sync logic ... rather than duplicating
// it").
import {
  AkahuFetchError,
  akahuIterateTransactionPages,
  mapAkahuTransaction,
} from "./akahu-client.ts";

export interface TransactionSyncResult {
  ok: boolean;
  message?: string;
  needsReconnect?: boolean;
}

// Deliberately minimal rather than the full generated client type — this
// helper is called from more than one Edge Function's ctx.supabase, and
// .rpc() is the only method it ever needs.
export interface RpcCapableClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }>;
}

// The boundary timestamp is captured before the fetch begins, not after
// it completes, and is only committed once every page has been upserted
// successfully — see design doc §4 (race-condition guard) and §7 (a
// failed sync is safe to retry from the same boundary; nothing is
// skipped, nothing is lost, at worst a page is harmlessly re-upserted).
export async function syncTransactionsForConnection(
  supabase: RpcCapableClient,
  appId: string,
  token: string,
  connectionId: string,
  sinceBoundary: string | null,
): Promise<TransactionSyncResult> {
  const syncStartedAt = new Date().toISOString();

  try {
    for await (
      const page of akahuIterateTransactionPages(appId, token, {
        start: sinceBoundary ?? undefined,
      })
    ) {
      if (page.length === 0) continue;

      const { error } = await supabase.rpc("record_transaction_sync", {
        p_connection_id: connectionId,
        p_transactions: page.map(mapAkahuTransaction),
        p_synced_up_to: null,
      });

      if (error) {
        return { ok: false, message: "Couldn't save synced transactions." };
      }
    }
  } catch (error) {
    if (error instanceof AkahuFetchError && (error.status === 401 || error.status === 403)) {
      return {
        ok: false,
        message: "Akahu rejected this connection. It may need to be reconnected.",
        needsReconnect: true,
      };
    }
    return { ok: false, message: "Couldn't fetch transactions from Akahu." };
  }

  // Advances the boundary in the same upsert function, with an empty
  // batch — only reached once every page above has succeeded.
  const { error: boundaryError } = await supabase.rpc("record_transaction_sync", {
    p_connection_id: connectionId,
    p_transactions: [],
    p_synced_up_to: syncStartedAt,
  });

  if (boundaryError) {
    return { ok: false, message: "Couldn't record the sync boundary." };
  }

  return { ok: true };
}
