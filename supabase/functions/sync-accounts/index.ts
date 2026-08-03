// Re-fetches accounts for one existing bank connection ("Sync now").
// Callable by any member of the connection's household, matching
// get_bank_connection_token's shared-sync authorization model.
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { akahuListAccounts, mapAkahuAccount } from "../_shared/akahu-client.ts";

interface SyncPayload {
  connectionId?: string;
}

const handler = {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const { supabase, userClaims } = ctx;

    if (!userClaims?.id) {
      return Response.json({ ok: false, message: "Not authenticated." }, { status: 401 });
    }

    let payload: SyncPayload;
    try {
      payload = await req.json();
    } catch {
      return Response.json({ ok: false, message: "Invalid request body." }, { status: 400 });
    }

    if (!payload.connectionId) {
      return Response.json({ ok: false, message: "Missing connectionId." }, { status: 400 });
    }

    const appId = Deno.env.get("AKAHU_APP_ID");
    if (!appId) {
      return Response.json(
        { ok: false, message: "Bank connections aren't configured yet." },
        { status: 503 },
      );
    }

    const { data: token, error: tokenError } = await supabase.rpc("get_bank_connection_token", {
      p_connection_id: payload.connectionId,
    });

    if (tokenError || !token) {
      return Response.json(
        { ok: false, message: "Connection not found." },
        { status: 404 },
      );
    }

    const accountsResult = await akahuListAccounts(appId, token);

    if (!accountsResult.ok) {
      if (accountsResult.status === 401 || accountsResult.status === 403) {
        await supabase.rpc("mark_bank_connection_error", {
          p_connection_id: payload.connectionId,
        });
        return Response.json(
          { ok: false, message: "Akahu rejected this connection. It may need to be reconnected." },
          { status: 401 },
        );
      }

      return Response.json({ ok: false, message: "Couldn't reach Akahu." }, { status: 502 });
    }

    const { error: syncError } = await supabase.rpc("record_bank_sync", {
      p_connection_id: payload.connectionId,
      p_accounts: accountsResult.accounts.map(mapAkahuAccount),
    });

    if (syncError) {
      return Response.json({ ok: false, message: "Couldn't save synced accounts." }, { status: 500 });
    }

    return Response.json({ ok: true });
  }),
};

export default handler;
