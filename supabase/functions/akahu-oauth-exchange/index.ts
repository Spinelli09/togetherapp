// Connects a household's bank via Akahu. Named akahu-oauth-exchange
// (Milestone 2's scaffold name, per the architecture's original
// Edge Functions table) even though, with only a Personal App available
// today, there is no OAuth code to exchange — the auth mode is decided
// entirely by ./_shared/akahu-auth.ts, so this function's own logic
// (validate token, fetch accounts, store connection) is unaffected by
// which mode is active.
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { getAkahuAuthProvider } from "../_shared/akahu-auth.ts";
import { akahuGetMe, akahuListAccounts, mapAkahuAccount } from "../_shared/akahu-client.ts";

interface ConnectPayload {
  householdId?: string;
  // Everything else is provider-specific credential-acquisition input
  // (e.g. pastedToken for Personal App, code for OAuth) and is passed
  // through to the active AkahuAuthProvider untouched — this function
  // never needs to know which fields matter for which mode.
  [key: string]: unknown;
}

const handler = {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const { supabase, userClaims } = ctx;

    if (!userClaims?.id) {
      return Response.json({ ok: false, message: "Not authenticated." }, { status: 401 });
    }

    let payload: ConnectPayload;
    try {
      payload = await req.json();
    } catch {
      return Response.json({ ok: false, message: "Invalid request body." }, { status: 400 });
    }

    if (!payload.householdId) {
      return Response.json({ ok: false, message: "Missing householdId." }, { status: 400 });
    }

    const appId = Deno.env.get("AKAHU_APP_ID");
    if (!appId) {
      return Response.json(
        { ok: false, message: "Bank connections aren't configured yet." },
        { status: 503 },
      );
    }

    let token: string;
    try {
      token = await getAkahuAuthProvider().acquireToken(payload);
    } catch {
      return Response.json(
        { ok: false, message: "Missing or invalid bank connection credentials." },
        { status: 400 },
      );
    }

    const me = await akahuGetMe(appId, token);
    if (!me.ok) {
      return Response.json(
        { ok: false, message: "Akahu didn't recognise that token. Check it and try again." },
        { status: 400 },
      );
    }

    const accountsResult = await akahuListAccounts(appId, token);
    if (!accountsResult.ok) {
      return Response.json(
        { ok: false, message: "Connected, but couldn't fetch accounts from Akahu." },
        { status: 502 },
      );
    }

    const institution = accountsResult.accounts[0]?.connection?.name ?? "Akahu";

    const { data: connectionId, error: connectError } = await supabase.rpc(
      "connect_bank_account",
      {
        p_household_id: payload.householdId,
        p_provider: "akahu",
        p_institution: institution,
        p_token: token,
      },
    );

    if (connectError || !connectionId) {
      return Response.json({ ok: false, message: "Couldn't save the connection." }, { status: 500 });
    }

    const { error: syncError } = await supabase.rpc("record_bank_sync", {
      p_connection_id: connectionId,
      p_accounts: accountsResult.accounts.map(mapAkahuAccount),
    });

    if (syncError) {
      return Response.json({
        ok: true,
        connectionId,
        message: "Connected, but the first sync failed — try Sync now.",
      });
    }

    return Response.json({ ok: true, connectionId });
  }),
};

export default handler;
