import { pageClass } from "./ui";

// One skeleton for every authenticated route.
//
// This used to be Home-shaped — a hero block and three bordered tiles —
// and rendered unchanged on Settings, Goals and Spending, which is worse
// than showing nothing: a skeleton that lies about the layout makes the
// real screen feel like it jumped.
//
// It works now because every screen genuinely opens the same way: a small
// label, one large figure, a supporting line, then a short list. The
// skeleton describes that shape and nothing more, so it is honest on all
// of them. Borderless, because the screens it stands in for have no
// borders either.
function Bar({ className }: { className: string }) {
  return <div className={"rounded bg-muted " + className} />;
}

export default function Loading() {
  return (
    <main className={pageClass} aria-busy="true">
      <p className="sr-only" role="status">
        Loading…
      </p>

      {/* label · anchor · supporting line */}
      <Bar className="h-3 w-24" />
      <Bar className="mt-6 h-14 w-56" />
      <Bar className="mt-4 h-3 w-40" />

      {/* the list beneath it */}
      <div className="mt-16 space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-baseline justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Bar className="h-4 w-1/2" />
              <Bar className="mt-1.5 h-2.5 w-1/3" />
            </div>
            <Bar className="h-4 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </main>
  );
}
