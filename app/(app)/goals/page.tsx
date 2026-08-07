import Link from "next/link";

import { loadHouseholdGoals, type Goal } from "@/lib/actions/goals";
import { createClient } from "@/lib/supabase/server";

import { Reveal, ProgressFill } from "../reveal";
import { Label, quietLinkClass} from "../ui";
import { ContributeForm, GoalFields, RemoveGoalButton } from "./goal-forms";

// Goals answers one question: what are we building together?
//
// Goals are not equal. Three rendered identically means the screen has no
// anchor at all, so the one closest to done is shown at Home's hero scale
// and the rest become quiet rows. Tapping a row promotes it — progressive
// disclosure with no client state, because "which goal" is a search param.

function money(amount: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(amount);
}

function wholeMoney(amount: number) {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function percentOf(goal: Goal) {
  return goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
}

const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string; new?: string; edit?: string }>;
}) {
  const { focus, new: isCreating, edit } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const householdId = membership.household_id;
  const goals = await loadHouseholdGoals(householdId);
  const visible = goals.filter((g) => g.status !== "archived");

  /* ── Creating ─────────────────────────────────────────────────────── */

  if (isCreating || visible.length === 0) {
    const isFirst = visible.length === 0 && !isCreating;
    return (
      <main className="mx-auto max-w-[40rem] px-6 pb-16 pt-24">
        <Reveal rise={false}>
          <section>
            {isFirst ? (
              <>
                <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">
                  What are you saving for?
                </h1>
                <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted-foreground">
                  A trip, a deposit, a rainy day. Name it, and you&apos;ll both watch it grow.
                </p>
              </>
            ) : (
              <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">
                A new goal
              </h1>
            )}

            <div className="mt-10">
              <GoalFields householdId={householdId} submitLabel="Start saving" />
            </div>

            {visible.length > 0 ? (
              <p className="mt-8">
                <Link
                  href="/goals"
                  className={quietLinkClass}
                >
                  Never mind
                </Link>
              </p>
            ) : null}
          </section>
        </Reveal>
      </main>
    );
  }

  /* ── Choosing the anchor ──────────────────────────────────────────── */

  const active = visible.filter((g) => g.status === "active");
  const anchor =
    visible.find((g) => g.id === focus) ??
    [...active].sort((a, b) => percentOf(b) - percentOf(a))[0] ??
    visible[0];
  const others = visible.filter((g) => g.id !== anchor.id);

  /* ── Editing ──────────────────────────────────────────────────────── */

  if (edit) {
    return (
      <main className="mx-auto max-w-[40rem] px-6 pb-16 pt-24">
        <Reveal rise={false}>
          <section>
            <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">
              {anchor.name}
            </h1>
            <div className="mt-10">
              <GoalFields goal={anchor} submitLabel="Save changes" />
            </div>
            <p className="mt-8">
              <Link
                href={`/goals?focus=${anchor.id}`}
                className={quietLinkClass}
              >
                Never mind
              </Link>
            </p>
          </section>
        </Reveal>
      </main>
    );
  }

  const remaining = Math.max(0, anchor.targetAmount - anchor.currentAmount);
  const isReached = remaining <= 0;
  const countWord = COUNT_WORDS[visible.length] ?? String(visible.length);

  return (
    <main className="mx-auto max-w-[40rem] px-6 pb-16 pt-24">
      <Reveal rise={false}>
        <section>
          <p className="text-sm text-muted-foreground">
            {visible.length === 1
              ? "You're saving for one thing."
              : `You're saving for ${countWord} things.`}
          </p>

          <p className="mt-10 text-[0.9375rem] text-foreground">{anchor.name}</p>

          {/* The anchor: the same shape as Home's balance, so the two screens
              read as one product. A remainder, not a percentage — a finish
              line rather than a metric. */}
          <p className="mt-1 text-[3.5rem] font-semibold leading-[0.95] tracking-tighter tabular-nums text-foreground">
            {isReached ? wholeMoney(anchor.currentAmount) : wholeMoney(remaining)}
          </p>

          <p className={"mt-3 text-sm " + (isReached ? "text-success" : "text-muted-foreground")}>
            {isReached
              ? `reached · ${money(anchor.targetAmount)} target`
              : `to go · ${money(anchor.currentAmount)} of ${money(anchor.targetAmount)}`}
          </p>

          <div className="mt-8">
            <ProgressFill percent={percentOf(anchor)} />
          </div>

          <div className="mt-8">
            <ContributeForm goalId={anchor.id} />
          </div>
        </section>
      </Reveal>

      {/* Editing and removing live only on the focused goal, and only as
          text. An action that happens twice a year should not be a button
          repeated beside every goal on the screen. */}
      <Reveal index={1}>
        <div className="mt-6 flex items-center gap-4">
          <Link
            href={`/goals?focus=${anchor.id}&edit=1`}
            className={quietLinkClass}
          >
            Edit
          </Link>
          <RemoveGoalButton goalId={anchor.id} />
        </div>
      </Reveal>

      {others.length > 0 ? (
        <Reveal index={2}>
          <section className="mt-20">
            <Label>Also saving for</Label>
            <ul className="mt-5 space-y-6">
              {others.map((goal) => {
                const left = Math.max(0, goal.targetAmount - goal.currentAmount);
                return (
                  <li key={goal.id}>
                    <Link
                      href={`/goals?focus=${goal.id}`}
                      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="truncate text-[0.9375rem] text-foreground">
                          {goal.name}
                        </span>
                        <span
                          className={
                            "shrink-0 text-[0.8125rem] tabular-nums " +
                            (left <= 0 ? "text-success" : "text-muted-foreground")
                          }
                        >
                          {left <= 0 ? "reached" : `${money(left)} to go`}
                        </span>
                      </div>
                      <div className="mt-3">
                        <ProgressFill percent={percentOf(goal)} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </Reveal>
      ) : null}

      <Reveal index={3}>
        <p className="mt-20">
          <Link
            href="/goals?new=1"
            className="text-[0.9375rem] text-foreground underline underline-offset-4 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Add something new
          </Link>
        </p>
      </Reveal>
    </main>
  );
}
