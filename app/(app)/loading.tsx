// Route-level skeleton for every (app) route — approved in Milestone 9
// design doc §8 as an app-wide addition, since all five (app) routes are
// dynamic (verified via build output) and equally benefit from a skeleton
// instead of a blank frame.
//
// Per-widget <Suspense> streaming was rejected: every dashboard query is
// single-digit milliseconds against real data, so streaming would add real
// complexity to solve a problem that doesn't exist at current volumes. It
// remains a drop-in later if any widget becomes slow.
export default function Loading() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12" aria-busy="true">
      <p className="sr-only" role="status">
        Loading…
      </p>

      <div className="space-y-10">
        <div className="space-y-3">
          <div className="h-3 w-32 rounded bg-accent" />
          <div className="h-10 w-56 rounded bg-accent" />
          <div className="h-3 w-64 rounded bg-accent" />
        </div>

        <div className="space-y-3">
          <div className="h-3 w-40 rounded bg-accent" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="h-16 rounded-md border border-border" />
            <div className="h-16 rounded-md border border-border" />
            <div className="h-16 rounded-md border border-border" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="h-3 w-24 rounded bg-accent" />
          <div className="h-12 rounded-md border border-border" />
          <div className="h-12 rounded-md border border-border" />
        </div>

        <div className="space-y-3">
          <div className="h-3 w-24 rounded bg-accent" />
          <div className="h-12 rounded-md border border-border" />
          <div className="h-12 rounded-md border border-border" />
        </div>
      </div>
    </main>
  );
}
