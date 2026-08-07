import Link from "next/link";

import { loadTransactionPage } from "@/lib/actions/transactions";
import { createClient } from "@/lib/supabase/server";

import { TransactionList } from "./transaction-list";

export default async function TransactionsPage() {
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

  const initialPage = await loadTransactionPage(membership.household_id, null);

  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-12">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        ← Back to dashboard
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Transactions
      </h1>

      <section className="mt-8">
        <TransactionList householdId={membership.household_id} initialPage={initialPage} />
      </section>
    </main>
  );
}
