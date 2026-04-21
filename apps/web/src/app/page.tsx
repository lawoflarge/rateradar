import { MeetingCountdown } from "@/components/MeetingCountdown";
import { ProbabilityTable } from "@/components/ProbabilityTable";
import { MOCK_FED_PROBABILITIES } from "@/lib/mock-data";

export default function Home() {
  const snapshots = MOCK_FED_PROBABILITIES;

  if (snapshots.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-4xl font-semibold">RateRadar</h1>
        <p className="mt-4 text-zinc-400">No upcoming meetings found. Check back soon.</p>
      </main>
    );
  }

  const next = snapshots[0];
  const topOutcome = [...next.outcomes].sort((a, b) => b.probability - a.probability)[0];

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      {/* Header */}
      <header className="mb-16">
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="h-8 w-8 rounded-full border-2 border-emerald-400"
            style={{
              boxShadow: "0 0 20px rgba(52, 211, 153, 0.5)",
            }}
          />
          <span className="text-xl font-semibold tracking-tight">RateRadar</span>
        </div>
        <h1 className="mt-10 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          See where rates are headed
          <br />
          <span className="text-zinc-500">— before the meeting.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-zinc-400">
          Market-implied probabilities for Fed and ECB interest-rate decisions, with
          historical tracking over days and weeks. Computed from Fed Funds Futures and
          €STR OIS — not scraped.
        </p>
      </header>

      {/* Hero snapshot */}
      <section className="mb-12">
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-emerald-950/30 to-zinc-950 p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-emerald-400">
                Next Fed decision
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {new Date(next.meeting.meeting_date + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { weekday: "long", month: "long", day: "numeric" },
                )}
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                <MeetingCountdown meetingDate={next.meeting.meeting_date} />
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Market expects
              </div>
              <div className="mt-1 text-4xl font-semibold tabular-nums text-emerald-300">
                {(topOutcome.probability * 100).toFixed(0)}%
              </div>
              <div className="mt-1 text-lg font-medium text-zinc-300">
                {topOutcome.label === "Hold" ? "holds rates" : `moves ${topOutcome.label}`}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* All upcoming meetings */}
      <section>
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">
          Upcoming Fed meetings
        </h2>
        <div className="space-y-6">
          {snapshots.map((s) => (
            <ProbabilityTable key={s.meeting.id} data={s} />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-20 border-t border-zinc-900 pt-8 text-sm text-zinc-500">
        <p>
          Data computed in-house from Fed Funds Futures (Yahoo Finance) using the public
          CME methodology. Not financial advice. Historical tracking and ECB coverage
          launching soon.
        </p>
        <p className="mt-3 text-xs">
          Built by{" "}
          <a
            href="https://github.com/lawoflarge"
            className="text-zinc-400 hover:text-emerald-400"
          >
            lawoflarge
          </a>
        </p>
      </footer>
    </main>
  );
}
