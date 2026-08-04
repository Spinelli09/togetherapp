# Milestone 6 — Transaction Import: Architecture Design

**Status:** Approved, with two adjustments incorporated below (§10, §5). Implementation follows this revision.
**Grounded against:** Akahu's live `/transactions` and webhooks API docs (fetched during this design pass, not recalled from training).

**Revision note:** The original version of this document specified cascade-delete of transactions on disconnect. That has been replaced throughout with **soft disconnect** (§10) at the request of the architecture review, so historical budgeting/reporting data survives a disconnect–reconnect cycle. §5 has also been extended with explicit update-on-conflict semantics. Every other section is unchanged from the approved original.

---

## Research findings that shape this design

Before anything else, three facts from Akahu's actual API materially change what a naive design would look like:

1. **`GET /v1/transactions` is not per-account.** It returns transactions across every account the token can see, filtered only by `start`/`end` (ISO datetime) and paginated by `cursor`. There is no `account` query parameter. Each transaction object carries its own `_account` field. This means sync is naturally a **connection-level** operation, not an account-level one.
2. **Amount sign already encodes direction.** Akahu's example (`"amount": -5.5` for an EFTPOS purchase) confirms negative = outflow, positive = inflow — the same convention used everywhere in this app already. No separate direction field needs to come from Akahu; we can derive it.
3. **Webhooks are Full-App-only, and even then only deliver IDs, not data.** Confirmed via Akahu's docs: Personal Apps cannot receive webhooks at all. The payload shape (`new_transaction_ids`, `removed_transactions`) is a *notification*, not a data push — a webhook handler would still have to call the REST API to get the actual transaction. This confirms webhook design is genuinely a "future" section (§8), not something partially buildable now.
4. **No confirmed `pending`/`posted` field.** The transaction object I fetched doesn't expose one. I'm not assuming it doesn't exist anywhere in Akahu's API surface, but I'm not designing around unconfirmed behavior either — flagged as an open question in §18, not silently resolved either way.

---

## 1. Proposed database schema

New table: **`transactions`**

| Column | Type | Null? | Purpose |
|---|---|---|---|
| `id` | uuid, PK | not null | Our own identifier |
| `household_id` | uuid, FK → `households(id)` on delete cascade | not null | **Denormalized deliberately** — see rationale below |
| `account_id` | uuid, FK → `bank_accounts(id)` on delete cascade | not null | Which account this transaction belongs to |
| `external_transaction_id` | text | not null | Akahu's `_id` — the duplicate-detection key |
| `occurred_at` | timestamptz | not null | Akahu's `date` |
| `amount` | numeric | not null | Signed, matching Akahu's own convention (negative = outflow) |
| `direction` | text, **generated column** (`'debit'` if `amount < 0` else `'credit'`) | not null | Queryable/indexable without recomputing sign logic everywhere |
| `description` | text | not null | Akahu's `description` |
| `merchant_name` | text | null | From `merchant.name` |
| `provider_category` | text | null | From `category.name` — **named deliberately, not `category`** (see §20) |
| `status` | text, check in (`pending`, `posted`) | not null, default `posted` | See open question in §18 |
| `raw_payload` | jsonb | not null | The full, untouched Akahu transaction object |
| `provider_updated_at` | timestamptz | null | Akahu's own `updated_at`, stored informationally |
| `deleted_at` | timestamptz | null | Reserved for future webhook `DELETE` handling — see §20 |
| `created_at` | timestamptz | not null, default now() | When we first stored this row |
| `updated_at` | timestamptz | not null, default now() | Bumped on every upsert |

**Why `household_id` is denormalized rather than joined through `account_id → bank_accounts → bank_connections`:** at 50,000+ rows, an RLS predicate that has to join two tables for every row evaluated is measurably worse than a single indexed column comparison via the existing `is_household_member()` helper. This is the same pattern `households`/`household_invites` already use — just applied here for performance, not just convenience. **This column is never accepted as caller input** — it's always derived server-side inside the sync function from the account/connection chain, so there's no integrity risk from denormalizing it.

Extension to existing table: **`bank_connections`** gains one column, and one existing column changes shape —

| Column | Type | Purpose |
|---|---|---|
| `last_transaction_synced_at` | timestamptz, null | The `end` boundary of the last successful transaction sync — deliberately separate from the existing `last_sync_at` (account-balance freshness), since these two concerns can diverge in cadence later |
| `vault_secret_id` *(existing column, changing)* | uuid, **now nullable** (was `NOT NULL`) | A disconnected connection has no token — see §10. Was previously always populated because the row itself was deleted on disconnect; now the row persists in a tokenless state instead. |

---

## 2. Required indexes

| Index | Columns | Serves |
|---|---|---|
| Unique (dedup) | `(account_id, external_transaction_id)` | Duplicate detection (§5); also serves "all transactions for this account" lookups as a side effect |
| Primary list index | `(household_id, occurred_at desc)` | The dominant query pattern: household transaction list/dashboard, paginated, most-recent-first. Every dashboard query in §12 leans on this one index. |
| Per-account index | `(account_id, occurred_at desc)` | Account-detail chronological view — genuinely distinct from the unique index above, which is sorted by `external_transaction_id`, not date |

**Considered and rejected:**
- A standalone `household_id` index — redundant, already served as the leftmost prefix of the list index.
- A GIN index on `raw_payload` — no query pattern needs to search *into* the raw payload (its stated purpose is debugging, not routine querying); would add write overhead with no read benefit today.
- An index involving `provider_category` — premature until Milestone 7 defines the real budget-category query shape. Noted for revisit, not built speculatively.

---

## 3. Constraints

- `PRIMARY KEY (id)`
- `FOREIGN KEY (account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE` — this cascade is a consistency backstop, not the disconnect mechanism (see §10 for the revised, non-destructive disconnect behavior). It still matters: it's what makes a *household deletion* clean, and what makes it safe to ever hard-delete a `bank_connections`/`bank_accounts` row in the future without hunting for orphaned transactions by hand.
- `FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE` — consistency backstop.
- `CHECK (status IN ('pending', 'posted'))`
- `UNIQUE (account_id, external_transaction_id)` — the duplicate-prevention constraint, doubles as the index above.
- `NOT NULL` on `household_id`, `account_id`, `external_transaction_id`, `occurred_at`, `amount`, `description`, `raw_payload`, `status`.
- **No RLS-bypassable path to set `household_id` directly** — enforced by convention (only the sync function writes this table at all; see §1).

---

## 4. Sync strategy

Because `/transactions` is connection-wide (not per-account), sync state lives on `bank_connections.last_transaction_synced_at`, not per-account.

- **First-ever sync for a connection:** no stored boundary yet → fetch with no `start` (Akahu returns full available history), paginate via `cursor` until exhausted, upserting each page as it arrives (not accumulated in memory — see §13).
- **Subsequent syncs:** `start` = the connection's stored `last_transaction_synced_at`. Akahu's `start` is exclusive and `end` is inclusive, so using the previous sync's boundary as the next sync's `start` gives a clean, non-overlapping window with no gaps.
- **Race-condition guard:** the boundary timestamp used to advance `last_transaction_synced_at` must be captured **before** the fetch begins, not after it completes. If a new transaction lands at the bank in the few seconds a sync is running, using a "captured at start" boundary means the next sync's window still includes it (as a harmless re-fetch/upsert of something possibly already imported). Using a "captured at completion" boundary could silently skip it forever. This is a correctness detail, not an optimization.
- **Concurrency guard:** the sync function should take a row lock (`SELECT ... FOR UPDATE`) on the `bank_connections` row for the duration of the sync — same pattern already used in `accept_household_invite` — so two overlapping "Sync now" clicks (or a connect + immediate manual sync) can't interleave and produce a confusing double-advance of the boundary.

---

## 5. Duplicate detection strategy

`UNIQUE (account_id, external_transaction_id)` + `INSERT ... ON CONFLICT (account_id, external_transaction_id) DO UPDATE`, upserting the normalized columns and `raw_payload` on conflict, bumping `updated_at`. This is the exact pattern already proven in `record_bank_sync` (Milestone 5) — re-running the same sync window twice is provably safe (already verified in that milestone's testing that re-syncing upserts in place rather than duplicating).

Scoping the uniqueness to `(account_id, external_transaction_id)` rather than `external_transaction_id` alone is defense-in-depth: Akahu's IDs are almost certainly globally unique already, but scoping costs nothing and matches the existing convention.

**Implementation note: what happens when Akahu changes an existing transaction.** Akahu transactions aren't always immutable — a pending transaction can post, a description or category can be corrected after the fact, an amount can be adjusted. Because every sync's `INSERT` targets the same `ON CONFLICT (account_id, external_transaction_id)` key, a transaction Akahu has changed since our last sync arrives again with the same `external_transaction_id` and is treated as an update, not a new row. Concretely, the `DO UPDATE SET` clause:

- **Overwrites every normalized field** — `occurred_at`, `amount` (and therefore `direction`, since it's generated from `amount`), `description`, `merchant_name`, `provider_category`, `status`, `provider_updated_at` — with whatever Akahu returned this time. The row always reflects Akahu's current view of the transaction, not a stale first-seen snapshot.
- **Overwrites `raw_payload` in full.** The stored payload is always the *latest* raw object, not the first one ever seen — consistent with `raw_payload`'s stated purpose (debugging the current state), not an audit trail of every historical version.
- **Bumps `updated_at`** to the time of this sync, so "this row changed since I last looked at it" is answerable directly from the row itself.
- **Never touches `id` or `created_at`.** Both are deliberately excluded from the `SET` clause. `id` can't change via `ON CONFLICT DO UPDATE` regardless (it isn't a target column), and `created_at` staying fixed at first-import time — not reset to "now" on every re-sync — is what "preserving our own transaction identity" means concretely: **our primary key for a given transaction is stable across every future re-sync**, so anything that comes to reference a transaction by our own `id` later (a user note, a manual re-categorization, a "reviewed" flag) keeps working even after Akahu changes or re-sends that transaction.

---

## 6. Pagination strategy

Two genuinely different concerns, worth keeping separate:

**(a) Walking Akahu's own pages, during a sync.** Loop on `cursor.next` until absent, upserting each page as fetched — never accumulate the full result set in memory. This bounds Edge Function memory regardless of household transaction volume and matters most on the (potentially large) first-ever historical sync.

**(b) Paginating our own transaction list in the UI, at 50,000+ rows.** This must be **keyset (cursor) pagination**, not offset/limit. An `OFFSET 40000` query has to scan and discard 40,000 rows before returning anything — it gets slower the deeper a user pages, which is exactly the "performance degradation at scale" the milestone scope calls out. The correct shape, using the `(household_id, occurred_at desc)` index directly:

> `WHERE household_id = $1 AND (occurred_at, id) < ($lastSeenOccurredAt, $lastSeenId) ORDER BY occurred_at DESC, id DESC LIMIT 50`

The `id` tiebreaker handles same-timestamp collisions deterministically (two transactions posted in the same second are common). This is the one place in this milestone I'd treat as non-negotiable — it should be right from the first version of the transactions list, not retrofitted later (see §20).

---

## 7. Error handling

- **Mid-sync API failure** (e.g., network error on page 6 of 10): safe by construction. Pages already upserted stay (harmlessly re-upsertable), and since `last_transaction_synced_at` only advances after full success, a retry re-fetches the same window rather than skipping anything.
- **401/403 from Akahu** (revoked token): reuse Milestone 5's existing `mark_bank_connection_error` — no new function needed.
- **Malformed transaction record** from Akahu (unexpected shape): log and skip that individual row rather than aborting the whole page — one bad record shouldn't block the rest of a sync.
- **Edge Function execution time.** Supabase Edge Functions have a bounded execution window. A first-ever historical sync for an old, active account could plausibly involve many pages and risk timing out. For Milestone 6 I'm proposing the **simple** behavior: a timeout just means the next attempt restarts the full historical pull (safe — duplicates are prevented — but potentially slow). A **resumable** version (persisting page-level progress between invocations) is more robust but meaningfully more complex. I'm flagging this as a deliberate scope decision, not a silent one — see §18.

---

## 8. Webhook strategy (future — not built in Milestone 6)

Confirmed unavailable on Personal App. Documented now so the eventual Full App migration has a concrete target, matching the provider-abstraction contract already established in Milestone 5.

- `akahu-webhook` (already scaffolded, still an untouched stub) becomes the receiver.
- **Auth mode differs from every other function in this app:** Akahu signs webhook requests itself (RSA-SHA256, `X-Akahu-Signature` + `X-Akahu-Signing-Key` headers, public key fetched from `GET /v1/keys/{keyID}`) rather than sending a Supabase user JWT. This function needs `auth: "none"` in `@supabase/server` terms, with signature verification done by hand inside the handler — the same shape as the "External webhooks" pattern in `@supabase/server`'s own docs (Stripe-style), just RSA instead of HMAC.
- On `INITIAL_UPDATE` / `DEFAULT_UPDATE`: since the payload only gives transaction **IDs**, not data, the simplest correct handling is to treat the webhook purely as a trigger — call the *same* incremental sync logic already built for manual "Sync now" for that connection, rather than building a second fetch-by-id code path.
- On `DELETE`: for each ID in `removed_transactions`, set `deleted_at = now()` on the matching row (soft delete — see §10) rather than hard-deleting, preserving `raw_payload` for the same "debugging" reason it was captured in the first place.

Nothing above requires deciding anything now beyond reserving `deleted_at` — which costs nothing to add today (§20).

---

## 9. Manual sync strategy

**Extend the existing `sync-accounts` Edge Function** rather than adding a second button. Today it refreshes account balances; Milestone 6 adds a transaction-sync step to the same invocation, after the balance refresh. One "Sync now" button doing everything is the more intuitive UX, and it means `lib/actions/bank.ts`'s `syncBankConnection` Server Action **doesn't need to change at all** — the calling contract stays identical, only the Edge Function does more work. That's a good sign the Milestone 5 boundary was drawn in the right place.

Trade-off worth naming: combining balance + transaction sync in one invocation compounds the execution-time risk from §7 on a large first sync. Acceptable for Milestone 6; flagged as the first thing to revisit if timeouts become real (§18).

---

## 10. Data retention strategy

**Decision: soft disconnect.** This revises Milestone 5's `disconnect_bank_connection` behavior, not just the transactions design — the two are inseparable, since transactions live under a connection's accounts.

**Why soft disconnect over a configurable-retention-policy system:** a general "retention policy" mechanism (TTLs, archival tiers, per-household settings) would be solving a problem this app doesn't have yet, and it's the kind of speculative flexibility that tends to be wrong in ways only discovered once a second real use case shows up. Soft disconnect gets the *stated* goal — historical budgeting and reporting surviving a disconnect/reconnect — with no new configuration surface at all. And it still satisfies the "single implementation point" requirement: because disconnect behavior lives entirely inside one `SECURITY DEFINER` function, that function *is* the single point future policy changes would touch. Nothing about this design forecloses adding real retention policy later; it just doesn't build one before there's a second concrete requirement to design it against.

**What changes in `disconnect_bank_connection` (Milestone 5):**

| Today (Milestone 5) | Revised (Milestone 6) |
|---|---|
| Deletes the `bank_connections` row | **Row persists.** `status` is set to `'disconnected'`. |
| Deletes the Vault secret | Unchanged — still deletes the Vault secret. There's no reason to keep an encrypted token around for a connection that's no longer in use, and deleting it is a security positive with no retention downside. |
| `bank_accounts` cascade-deletes via FK (parent row gone) | **Rows persist** — nothing deletes the parent, so the cascade never fires. |
| *(transactions didn't exist yet)* | **Rows persist**, for the same reason. |

Concretely: `vault_secret_id` is set to `NULL` (now nullable, §1) once the secret is deleted. **`get_bank_connection_token` becomes the single gate that prevents a disconnected connection from ever being synced again** — it should check `status = 'active'` (equivalently, `vault_secret_id IS NOT NULL`) and raise a clear `connection_not_active` error otherwise, rather than returning `NULL` and letting an Edge Function's Akahu call fail with a confusing downstream error. This is the one new check this revision adds to that function.

**Reconnecting.** No new "reconnect" flow is needed. A household member clicking "Connect bank" again after a disconnect creates a **new** `bank_connections` row via the existing `connect_bank_account`, exactly as it does today for a first-time connect. The old, disconnected connection and its accounts/transactions simply remain in the database. Because every dashboard/reporting query (§12) filters by `household_id` — never by "only active connections" — historical data from a disconnected connection is automatically included in any household-level report or budget calculation going forward, with no merge logic required. This is the concrete mechanism behind "historical budgeting and reporting survive a reconnect."

**No automatic deletion or archival beyond disconnect.** Users expect full transaction history to remain available, same as any banking or budgeting app. Nothing in this design deletes data on a schedule.

**Soft-delete reserved for the future webhook `DELETE` case** (`deleted_at`, unchanged from the original design). Nothing in Milestone 6 populates it — manual sync never issues deletes, only upserts. Application queries (not RLS) should filter `deleted_at IS NULL` by convention; keeping that filter out of RLS is deliberate, since RLS should stay focused on "who can see this household's data" (security) and not absorb "which rows are logically active" (business logic) — two different concerns that are easy to tangle if left unexamined.

---

## 11. Estimated storage requirements

Rough per-row estimate (stated assumptions, not false precision):

| Component | Estimate |
|---|---|
| Fixed columns (uuids, timestamps, numeric, short text) | ~150–200 bytes |
| `description` + `merchant_name` + `provider_category` | ~80–120 bytes combined, average |
| `raw_payload` (jsonb, binary-packed, no whitespace) | ~300–600 bytes |
| Postgres row overhead (tuple header, null bitmap) | ~25–30 bytes |
| **Per row, total** | **~900 bytes – 1.2 KB** |

At 50,000 transactions: **~50 MB of table data per household**, plus roughly **~7–8 MB across the three indexes** (btree indexes on uuid/timestamptz combinations are compact) → **~55–60 MB per household** at the stated scale target.

This scales linearly with household count — worth checking against your actual Supabase plan's storage tier as the number of real households grows, rather than something to solve now with one household.

---

## 12. Query strategy for future dashboards

All of these lean on the single `(household_id, occurred_at desc)` index — which is the strongest signal that it's the right index to invest in:

- **Combined balance:** `SUM(current_balance)` from `bank_accounts` — doesn't touch `transactions` at all, already cheap from Milestone 5.
- **Monthly income/spend:** `sum(amount) FILTER (WHERE amount < 0)` / `FILTER (WHERE amount > 0)` over `WHERE household_id = $1 AND occurred_at >= date_trunc('month', now())` — a narrow, index-served range scan regardless of total table size.
- **Recent transactions:** exactly the keyset query from §6.
- **Category/budget rollups (Milestone 7):** `GROUP BY provider_category` (or the future `category`) over a similar date range — served by the same index today; a dedicated composite index may be worth adding once Milestone 7's real query shape is known. Not built now.

---

## 13. Performance considerations

- **Batch upserts, not row-by-row.** The sync function should upsert one Akahu page (~200–500 rows) per call using a single `INSERT ... ON CONFLICT` over a `jsonb_array_elements()` batch — the exact pattern `record_bank_sync` already established in Milestone 5, reused here as `record_transaction_sync`.
- **`numeric`, not floating point,** for `amount` — avoids rounding-error risk in financial data. Already the chosen type; stating it explicitly as a deliberate correctness decision, not an accident.
- **Never `SELECT *` on list/dashboard queries.** `raw_payload` is ~300–600 bytes of rarely-needed debug data per row — routine list queries should select only the normalized display columns, fetching `raw_payload` on-demand only (e.g., a future transaction-detail view).
- **Autovacuum:** upsert-heavy tables generate dead tuples, but at this scale, with syncs touching a small recent window rather than rewriting the whole table, standard autovacuum defaults should keep up without special tuning.

---

## 14. Migration plan

Sequential, small, each pushed and advisor-checked before the next — the same discipline used in every prior milestone:

1. Create `transactions` table + indexes + constraints + RLS (SELECT-only for household members, no direct write policy — same shape as `bank_accounts`).
2. Add `bank_connections.last_transaction_synced_at`; alter `bank_connections.vault_secret_id` to drop `NOT NULL` (§10).
3. Create `record_transaction_sync(p_connection_id, p_transactions jsonb, p_synced_up_to timestamptz)` — `SECURITY DEFINER`, row-locks the connection, upserts the batch, advances the sync boundary (only if `p_synced_up_to` is newer than the current value — guards against an out-of-order call regressing it).
4. Replace `disconnect_bank_connection` (`CREATE OR REPLACE`) with the soft-disconnect behavior from §10: delete the Vault secret, set `vault_secret_id = NULL` and `status = 'disconnected'`, no longer delete the row.
5. Replace `get_bank_connection_token` (`CREATE OR REPLACE`) to add the `status = 'active'` gate from §10.

Before any Edge Function code is written, I'd verify this layer exactly as done in Milestones 2–5: push migrations, run the security/performance advisor scan, then SQL-impersonate a full lifecycle — seed a household with two accounts, upsert a batch of synthetic transactions across both, confirm household isolation for an outsider, confirm a direct client-side `INSERT` is blocked, confirm re-running the same upsert doesn't duplicate (and that it updates rather than duplicates, per §5's update semantics), confirm disconnect preserves accounts and transactions while blocking further sync, confirm a fresh reconnect creates a new connection alongside the preserved historical one.

---

## 15. Edge Function changes

- **`sync-accounts`:** extended, not replaced. After the existing balance refresh, add the transaction-sync loop (fetch pages via `_shared/akahu-client.ts`, call `record_transaction_sync` per page).
- **`akahu-oauth-exchange` (connect):** extended to also perform an initial transaction pull right after the first account sync, so a newly connected bank shows real history immediately rather than an empty list. Shares the same internal sync logic as `sync-accounts` rather than duplicating it.
- **`akahu-webhook`:** unchanged — remains an untouched stub. Not part of Milestone 6's actual deliverable (§8).
- **`_shared/akahu-client.ts`:** gains `akahuListTransactions(appId, token, { start, end, cursor })`, following the exact typed-envelope pattern already used for `akahuListAccounts`.

---

## 16. Server Action changes

- **None required to `lib/actions/bank.ts`.** `syncBankConnection` already calls `sync-accounts` and just gets more done per call — the calling contract is unchanged. Worth calling out as a positive signal that Milestone 5's boundaries were drawn correctly.
- **New: a paginated data-fetch function** for the transactions list page (a Server Component query, not a mutating Server Action) implementing the keyset query from §6.

---

## 17. UI changes

- **New route** (name TBD, e.g. `/transactions`): a minimal list — date, description, merchant, account, amount (styled by `direction`), with a keyset-based "Load more" control rather than numbered pages (numbered pages don't suit keyset pagination and would tempt an offset-based implementation later).
- **Nav link** from the dashboard, matching the existing "Manage household" / "Connect your bank" pattern.
- **`/settings/banks` needs a direct consequence of soft disconnect handled**, not just the new transactions route: since a disconnected connection's row now persists (§10) instead of vanishing, it will keep appearing in this page's existing query (which has no status filter today) unless explicitly handled. A disconnected connection should render clearly marked `disconnected` and **without** working "Sync now" / "Disconnect" actions (both would fail meaningfully now — the former via the new `get_bank_connection_token` gate, the latter against an already-disconnected row) — this is required for §10 to actually work end-to-end, not an optional polish item.
- **Explicitly out of scope for Milestone 6:** filtering by account/date/category, and any dedicated "reconnect" UI (§10 — reconnecting is just the existing "Connect bank" form again). Proposing a bare list + load-more as v1, deferred filtering to Milestone 9 (dashboard) or a later polish pass — flag if you want it sooner.

---

## 18. Risks

1. **Edge Function timeout on large first-time historical syncs** — the accepted-for-now "restart from scratch on retry" behavior (§7, §9) is safe but potentially slow for very active, long-lived accounts. Worth monitoring in practice.
2. **`status` (pending/posted) isn't confirmed present in Akahu's response** — the column may end up always `'posted'` in practice. Needs verifying against real data once real credentials exist; not a blocker, but shouldn't be assumed either way.
3. **Amount sign convention across all Akahu transaction `type`s isn't independently verified** — the one example I fetched (EFTPOS, negative) is consistent with the standard convention, but `type` also includes PAYMENT, TRANSFER, FEE, INTEREST, etc. Worth a spot-check against real data before trusting it universally.
4. **Double-sync races** — addressed by design (`FOR UPDATE` row lock, §4), but worth explicitly verifying under concurrent test conditions during implementation, not just trusting the design on paper.
5. **This is the largest, most sensitive table in the app so far.** The "no direct write policy, functions only" pattern must hold here with zero exceptions — same verification rigor as Milestones 2–5, not assumed by analogy.
6. **Storage growth** is real but manageable at the estimated scale (§11) — not an immediate concern, worth revisiting if household count grows substantially.

---

## 19. Acceptance criteria

- Transactions import from Akahu into `transactions` for a connected account.
- Re-running the same sync does not create duplicate rows (verified via the unique constraint and by actually re-running it).
- Re-syncing a transaction whose normalized fields or `raw_payload` changed at the source updates the existing row in place — same `id`, same `created_at`, everything else refreshed (§5).
- Transactions from multiple accounts in one household are correctly attributed to their own `account_id`.
- Both negative and positive amounts import correctly, with `direction` reflecting the sign.
- `raw_payload` contains the complete, untouched original Akahu object for every row.
- A user outside the household cannot see its transactions (RLS isolation, tested the same way as every prior milestone).
- Direct client-side `INSERT`/`UPDATE`/`DELETE` against `transactions` is blocked — confirmed by attempting it, not assumed.
- Seeding 50,000+ synthetic transactions for one household and running the keyset list query returns via an index scan (verified with `EXPLAIN ANALYZE`), not a sequential scan, and stays fast regardless of how deep the pagination cursor is.
- **Disconnecting a bank connection preserves its accounts and transactions** (soft disconnect, §10) — confirmed by querying for them after disconnect, not just by absence of an error.
- A disconnected connection can no longer be synced (`get_bank_connection_token` rejects it) but its historical data remains visible in household-level queries.
- Reconnecting the same bank creates a new connection; the old, disconnected connection's historical transactions remain queryable and are included in household-level aggregates alongside the new connection's data.
- `npm run build` and `npm run lint` both pass clean.

---

## 20. Changes worth making now to avoid future rewrites

Ranked by how expensive they'd be to retrofit later:

1. **Denormalize `household_id` onto `transactions` now.** Retrofitting this on a 50,000+-row table later means a backfill migration plus a period where RLS is either slower or briefly inconsistent. Free to get right from row one.
2. **Reserve `provider_category` (not `category`) now.** Milestone 7 will need its own `category` field mapped to the app's fixed budget categories. Naming this correctly now means Milestone 7 adds a column; naming it wrong means Milestone 7 renames one, touching every query written against it in between.
3. **Add `deleted_at` now, even though nothing populates it until webhooks exist.** An unused nullable column costs nothing. Adding it later means a real migration *and* retrofitting `deleted_at IS NULL` into every read query written in the meantime (dashboard, transaction list, budget rollups) — exactly the kind of scattered change that's easy to miss one instance of.
4. **Get keyset pagination right in the transactions list's first version**, not as a later swap. Once a URL/UI contract around pagination exists and is in use, changing its shape is a bigger, more visible change than choosing correctly the first time.
5. **Decide the `FOR UPDATE` sync-locking pattern now.** Cheap at function-design time; awkward to add once concurrent-sync bugs are already occurring against real data.
6. **Keep `last_transaction_synced_at` separate from `last_sync_at`.** They already represent different concerns (transaction-window boundary vs. balance freshness) that will diverge further once scheduled/background sync exists. Splitting them later means auditing every place that currently assumes one timestamp means one thing.
