// Talks to Akahu's REST API. Nothing in this file knows or cares whether
// the token it's given came from a pasted Personal App token or an OAuth
// exchange — Akahu authenticates both the same way (Bearer token +
// X-Akahu-Id), so this module never needs to change when the app moves
// from Personal to Full Akahu App. See ./akahu-auth.ts for the one part
// of the integration that does change.
const AKAHU_BASE_URL = "https://api.akahu.io/v1";

interface AkahuBalance {
  currency: string;
  current: number;
  available?: number | null;
}

interface AkahuConnection {
  _id: string;
  name: string;
}

export interface AkahuAccount {
  _id: string;
  name: string;
  type: string;
  balance?: AkahuBalance;
  connection?: AkahuConnection;
  status?: string;
}

interface AkahuEnvelope<T> {
  success: boolean;
  message?: string;
  item?: T;
  items?: T[];
}

async function akahuFetch<T>(
  path: string,
  appId: string,
  token: string,
): Promise<{ ok: boolean; status: number; body: AkahuEnvelope<T> }> {
  const res = await fetch(`${AKAHU_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Akahu-Id": appId,
    },
  });

  const body = (await res.json().catch(() => ({ success: false }))) as AkahuEnvelope<T>;

  return { ok: res.ok && body.success !== false, status: res.status, body };
}

export async function akahuGetMe(
  appId: string,
  token: string,
): Promise<{ ok: boolean; status: number }> {
  const { ok, status } = await akahuFetch<{ _id: string }>("/me", appId, token);
  return { ok, status };
}

export async function akahuListAccounts(
  appId: string,
  token: string,
): Promise<{ ok: boolean; status: number; accounts: AkahuAccount[] }> {
  const { ok, status, body } = await akahuFetch<AkahuAccount>("/accounts", appId, token);
  return { ok, status, accounts: ok ? (body.items ?? []) : [] };
}

// Shape record_bank_sync's SQL side expects — see the Milestone 5
// migration for the matching jsonb_array_elements() read.
export function mapAkahuAccount(account: AkahuAccount) {
  return {
    external_account_id: account._id,
    account_name: account.name,
    account_type: account.type,
    currency: account.balance?.currency ?? "NZD",
    current_balance: account.balance?.current ?? 0,
    available_balance: account.balance?.available ?? null,
  };
}
