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
  cursor?: { next?: string };
}

interface AkahuMerchant {
  name: string;
}

interface AkahuCategory {
  name: string;
}

export interface AkahuTransaction {
  _id: string;
  _account: string;
  date: string;
  updated_at?: string;
  description: string;
  amount: number;
  merchant?: AkahuMerchant;
  category?: AkahuCategory;
}

async function akahuFetch<T>(
  path: string,
  appId: string,
  token: string,
  params?: Record<string, string | undefined>,
): Promise<{ ok: boolean; status: number; body: AkahuEnvelope<T> }> {
  const url = new URL(`${AKAHU_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
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

// GET /transactions is connection-wide (spans every account the token
// can see), not per-account — see Milestone 6 design doc §1. start is
// exclusive, end is inclusive, matching Akahu's own documented semantics.
export async function akahuListTransactions(
  appId: string,
  token: string,
  options: { start?: string; end?: string; cursor?: string },
): Promise<{
  ok: boolean;
  status: number;
  transactions: AkahuTransaction[];
  nextCursor: string | null;
}> {
  const { ok, status, body } = await akahuFetch<AkahuTransaction>("/transactions", appId, token, {
    start: options.start,
    end: options.end,
    cursor: options.cursor,
  });

  return {
    ok,
    status,
    transactions: ok ? (body.items ?? []) : [],
    nextCursor: body.cursor?.next ?? null,
  };
}

// Thrown by akahuIterateTransactionPages so a failed page surfaces as a
// catchable error with the HTTP status attached, rather than a special
// generator return value a `for await` loop can't see.
export class AkahuFetchError extends Error {
  status: number;
  constructor(status: number) {
    super(`Akahu request failed with status ${status}`);
    this.status = status;
  }
}

// Walks every page for the given date window, yielding one page at a
// time rather than accumulating the full result set in memory — this is
// what bounds Edge Function memory regardless of a household's
// transaction volume (Milestone 6 design doc §6a, §13). A first-ever
// sync with no start/end can span many pages of history; each page is
// upserted by the caller as it's yielded.
export async function* akahuIterateTransactionPages(
  appId: string,
  token: string,
  options: { start?: string; end?: string },
): AsyncGenerator<AkahuTransaction[]> {
  let cursor: string | undefined;

  while (true) {
    const { ok, status, transactions, nextCursor } = await akahuListTransactions(appId, token, {
      start: options.start,
      end: options.end,
      cursor,
    });

    if (!ok) {
      throw new AkahuFetchError(status);
    }

    yield transactions;

    if (!nextCursor) {
      return;
    }

    cursor = nextCursor;
  }
}

// Shape record_transaction_sync's SQL side expects (see the Milestone 6
// migration's jsonb_array_elements() read) — external_account_id is
// resolved to our local account_id inside that function, not here.
export function mapAkahuTransaction(transaction: AkahuTransaction) {
  return {
    external_account_id: transaction._account,
    external_transaction_id: transaction._id,
    occurred_at: transaction.date,
    amount: transaction.amount,
    description: transaction.description,
    merchant_name: transaction.merchant?.name ?? null,
    provider_category: transaction.category?.name ?? null,
    raw_payload: transaction,
    provider_updated_at: transaction.updated_at ?? null,
  };
}
