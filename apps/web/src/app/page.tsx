import { ImpliedRateCurve } from "@/components/ImpliedRateCurve";
import { MeetingCountdown } from "@/components/MeetingCountdown";
import { MostLikelyPath } from "@/components/MostLikelyPath";
import { ProbabilityTable } from "@/components/ProbabilityTable";
import {
  getEcbProbabilities,
  getFedProbabilities,
  getMeetingHistory,
} from "@/lib/data";
import { CURRENT_POLICY_RATES } from "@/lib/policy-rates";
import type { MeetingProbabilities, ProbabilitySeries } from "@/lib/types";

export const revalidate = 300; // ISR: refresh every 5 minutes

async function prefetchHistory(
  snapshots: MeetingProbabilities[],
  count: number,
): Promise<Record<string, ProbabilitySeries[]>> {
  const out: Record<string, ProbabilitySeries[]> = {};
  for (const s of snapshots.slice(0, count)) {
    out[s.meeting.id] = await getMeetingHistory(s.meeting.id, 60);
  }
  return out;
}

function soonestMeeting(
  fed: MeetingProbabilities[],
  ecb: MeetingProbabilities[],
): MeetingProbabilities | null {
  const all = [...fed, ...ecb];
  if (all.length === 0) return null;
  return all.reduce((earliest, cur) =>
    cur.meeting.meeting_date < earliest.meeting.meeting_date ? cur : earliest,
  );
}

export default async function Home() {
  const [fed, ecb] = await Promise.all([
    getFedProbabilities(),
    getEcbProbabilities(),
  ]);

  const [fedHistory, ecbHistory] = await Promise.all([
    prefetchHistory(fed, 3),
    prefetchHistory(ecb, 3),
  ]);

  const next = soonestMeeting(fed, ecb);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      {/* Header */}
      <header className="mb-16">
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="h-8 w-8 rounded-full border-2 border-emerald-400"
            style={{ boxShadow: "0 0 20px rgba(52, 211, 153, 0.5)" }}
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

      {/* Hero — whichever bank decides soonest */}
      {next && (
        <section className="mb-12">
          <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-emerald-950/30 to-zinc-950 p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-emerald-400">
                  Next {next.meeting.bank_code === "FED" ? "Fed" : "ECB"} decision
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
                {(() => {
                  const top = [...next.outcomes].sort(
                    (a, b) => b.probability - a.probability,
                  )[0];
                  return (
                    <>
                      <div className="text-xs uppercase tracking-wide text-zinc-500">
                        Market expects
                      </div>
                      <div className="mt-1 text-4xl font-semibold tabular-nums text-emerald-300">
                        {(top.probability * 100).toFixed(0)}%
                      </div>
                      <div className="mt-1 text-lg font-medium text-zinc-300">
                        {top.label === "Hold" ? "holds rates" : `moves ${top.label}`}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Most-likely path overview */}
      {(fed.length > 0 || ecb.length > 0) && (
        <section className="mb-12 space-y-6">
          {fed.length > 0 && <MostLikelyPath snapshots={fed} label="Fed path" />}
          {ecb.length > 0 && <MostLikelyPath snapshots={ecb} label="ECB path" />}
        </section>
      )}

      {/* Implied rate curves */}
      {(fed.length > 0 || ecb.length > 0) && (
        <section className="mb-14 grid gap-6 md:grid-cols-2">
          {fed.length > 0 && (
            <ImpliedRateCurve
              snapshots={fed}
              startingRate={CURRENT_POLICY_RATES.FED}
              bankLabel="Federal Reserve"
            />
          )}
          {ecb.length > 0 && (
            <ImpliedRateCurve
              snapshots={ecb}
              startingRate={CURRENT_POLICY_RATES.ECB}
              bankLabel="European Central Bank"
            />
          )}
        </section>
      )}

      {/* Fed section */}
      {fed.length > 0 && (
        <section className="mb-14">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">
            Upcoming Fed meetings
          </h2>
          <div className="space-y-6">
            {fed.map((s) => (
              <ProbabilityTable
                key={s.meeting.id}
                data={s}
                history={fedHistory[s.meeting.id]}
              />
            ))}
          </div>
        </section>
      )}

      {/* ECB section */}
      {ecb.length > 0 && (
        <section className="mb-14">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">
            Upcoming ECB meetings
          </h2>
          <div className="space-y-6">
            {ecb.map((s) => (
              <ProbabilityTable
                key={s.meeting.id}
                data={s}
                history={ecbHistory[s.meeting.id]}
              />
            ))}
          </div>
        </section>
      )}

      {fed.length === 0 && ecb.length === 0 && (
        <p className="text-zinc-400">No upcoming meetings found. Check back soon.</p>
      )}

      {/* Footer */}
      <footer className="mt-20 border-t border-zinc-900 pt-8 text-sm text-zinc-500">
        <p>
          Data computed in-house from Fed Funds Futures (Yahoo Finance) and €STR OIS
          quotes using the public CME methodology. Not financial advice.
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
