# Milestone 7 — Phase C (category alias seeding)

**COMPLETE as of 2026-08-05.** A real bank connection (ANZ) was established, the first real sync imported 7 accounts and 2,266 transactions, and `category_aliases` has been seeded with 63 verified mappings covering every distinct real Akahu category observed. See the implementation report delivered in chat for full detail: the exact query used to inspect the real payload, the complete category breakdown, the per-category mapping (with borderline calls noted), and end-to-end verification against a real (temporary, since-removed) budget showing non-zero categorized spend. This document is kept as the historical record of why Phase C was originally pending and what completing it required — the rest of the file below is unchanged from when it was written for that purpose.

---

**Original status (superseded above):** Milestone 7 (budgeting) is fully implemented, migrated, and verified. The one remaining piece — seeding `category_aliases` with real Akahu category mappings — is intentionally not done yet, and this is expected, not an oversight.

## Why Phase C is pending

The Milestone 7 design (approved, revision 2) explicitly split category alias seeding into its own phase, gated on inspecting a real Akahu payload rather than assuming what it looks like. At implementation time, `bank_connections` had zero rows in the live database — no real bank has ever been connected, so there is no real transaction payload to inspect yet.

This is a pre-existing environment gap, not something Milestone 7 introduced: `docs/HANDOVER.md` (written before Milestone 6) already documented `AKAHU_APP_ID` as unset. Nothing since then — including Milestone 6's own verification — shows a real connection was ever completed.

`category_aliases` is deployed as an empty table on purpose (see §2). Seeding it with invented or assumed values was explicitly out of scope — the design requires verified provider values only.

## Exactly what's required to complete it

1. **Connect a real bank**, via the app's existing UI (`/settings/banks` → "Connect a bank"), using a real Akahu personal access token. This is a real user action — it cannot be done on your behalf; it exchanges a token for accounts and triggers an initial transaction sync via `akahu-oauth-exchange`, unchanged since Milestone 6.
2. **Inspect the real payload.** Run this against the live database once real transactions exist:
   ```sql
   select distinct
     raw_payload -> 'category' ->> '_id' as akahu_category_id,
     raw_payload -> 'category' ->> 'name' as akahu_category_name
   from transactions
   where raw_payload -> 'category' is not null;
   ```
   This shows every distinct category Akahu actually returned for this integration — the answer to whether category enrichment is available to this Personal App at all (an open question the design doc flagged and could not resolve without real data).
3. **Seed verified aliases only**, one row per distinct `akahu_category_id` observed, mapped to the closest matching row in `categories`:
   ```sql
   insert into category_aliases (akahu_category_id, category_id) values
     ('<verified _id from step 2>', '<matching categories.id>');
     -- one row per distinct category actually observed — no invented entries
   ```
   Categories with no obviously matching real-world equivalent can be left unmapped — they fall back to Uncategorized (§4), which is correct, not broken.

## What success looks like

- `select count(*) from category_aliases` is greater than zero, and every row's `akahu_category_id` came from a real, observed `transactions.raw_payload`, not a guess.
- Re-running the budgets page shows non-zero `net_spent`/`gross_spent` on budgets whose target categories match transactions that actually occurred — assuming Akahu did return enrichment data. If step 2's query comes back empty (no `category` key present on any real transaction), that's a valid, important finding in itself: it means this Akahu integration doesn't have enrichment access, and every transaction will correctly and permanently resolve to Uncategorized until that changes — a product decision to revisit, not a Milestone 7 bug.

## Uncategorized is the expected fallback until then

With `category_aliases` empty, `transaction_category_resolution`'s `LEFT JOIN` on `category_aliases` matches nothing, and every transaction falls through to the `LEFT JOIN LATERAL` fallback onto the single `is_uncategorized_default = true` row. Every transaction, real or synthetic, resolves to **Uncategorized** — verified directly during Milestone 7's SQL verification pass, not just asserted here. Any budget that doesn't explicitly target the Uncategorized category will correctly show `$0` spent until real aliases exist. This is the system working as designed, not a defect to fix.

## Confirmation: connecting a bank later needs no schema or code changes

Verified by re-reading the actual code paths, not assumed:

- `akahu-oauth-exchange` and `sync-accounts` (both unmodified by Milestone 7 — confirmed via `git status` showing zero changes to either) call `syncTransactionsForConnection` → `record_transaction_sync`, exactly as they did after Milestone 6. Nothing about Milestone 7 changes what gets synced or how.
- `record_transaction_sync` already stores the full Akahu transaction object in `raw_payload` (Milestone 6 behavior, untouched) — including `category._id` if Akahu returns it, whether or not any code reads that field yet.
- `transaction_category_resolution` (Milestone 7) is a live view, not a cache or a trigger-populated table. It re-resolves every transaction's category on every query, automatically, the moment `category_aliases` gains rows — no backfill, no re-sync, no redeploy.

The only action Phase C requires is the two items in §2–3 above: **inspect, then insert rows.** No `ALTER TABLE`, no new migration touching schema, no Edge Function change, no redeploy of any function.
