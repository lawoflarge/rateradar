import { AdSlot } from "@/components/AdSlot";
import { ImpliedRateCurve } from "@/components/ImpliedRateCurve";
import { MeetingCountdown } from "@/components/MeetingCountdown";
import { MethodologyBadge } from "@/components/MethodologyBadge";
import { MostLikelyPath } from "@/components/MostLikelyPath";
import { ProbabilityTable } from "@/components/ProbabilityTable";
import { Rule } from "@/components/Rule";
import { SectionLabel } from "@/components/SectionLabel";
import {
  getEcbProbabilities,
  getFedProbabilities,
  getMeetingHistory,
} from "@/lib/data";
import { CURRENT_POLICY_RATES } from "@/lib/policy-rates";
import { loadJsonSnapshotAt } from "@/lib/snapshots";
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

  const [fedHistory, ecbHistory, fedSnapshotMeta] = await Promise.all([
    prefetchHistory(fed, 3),
    prefetchHistory(ecb, 3),
    loadJsonSnapshotAt("FED"),
  ]);

  const next = soonestMeeting(fed, ecb);
  const nextTop = next
    ? [...next.outcomes].sort((a, b) => b.probability - a.probability)[0]
    : null;

  const methodologyVersion = fedSnapshotMeta?.version ?? "1.0.0";
  const latestSnapshotAt =
    fedSnapshotMeta?.at ?? next?.snapshot_at ?? fed[0]?.snapshot_at ?? null;
  const dataSource: "supabase" | "json" | "mock" = fedSnapshotMeta
    ? "json"
    : fed.length > 0
      ? "supabase"
      : "mock";

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-16">
        <SectionLabel>Real-time market-implied odds</SectionLabel>
        <h1 className="mt-4 max-w-3xl font-serif text-5xl font-medium leading-[1.05] tracking-tight text-ink sm:text-6xl">
          See where rates are headed.
          <span className="block text-ink-mute">Before the meeting.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Market-implied probabilities for Fed and ECB interest-rate decisions, with
          historical tracking over days and weeks. Computed from Fed Funds Futures and
          €STR OIS. Never scraped.
        </p>
        <div className="mt-6">
          <MethodologyBadge
            version={methodologyVersion}
            snapshotAt={latestSnapshotAt}
            source={dataSource}
          />
        </div>
      </header>

      <Rule />

      {next && nextTop && (
        <section className="my-12">
          <SectionLabel>Next decision</SectionLabel>
          <div className="mt-4 grid gap-8 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <div className="text-sm uppercase tracking-wider text-cut">
                {next.meeting.bank_code === "FED" ? "Federal Reserve" : "European Central Bank"}{" "}
                ·{" "}
                {new Date(next.meeting.meeting_date + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { dateStyle: "long" },
                )}
              </div>
              <h2 className="mt-2 font-serif text-3xl font-medium leading-tight">
                {nextTop.label === "Hold" ? "Hold rates" : `Move ${nextTop.label}`}
              </h2>
              <p className="mt-2 text-ink-soft">
                Current policy rate{" "}
                <span className="font-mono tabular-nums">
                  {CURRENT_POLICY_RATES[next.meeting.bank_code]}%
                </span>
                . Market puts{" "}
                <span className="font-mono tabular-nums font-semibold text-ink">
                  {(nextTop.probability * 100).toFixed(0)}%
                </span>{" "}
                on this outcome.
              </p>
            </div>
            <MeetingCountdown meetingDate={next.meeting.meeting_date} />
          </div>
        </section>
      )}

      <Rule tone="soft" />

      <section className="my-12">
        <SectionLabel>Most likely path · cumulative</SectionLabel>
        <div className="mt-4 grid gap-8 lg:grid-cols-2">
          {fed.length > 0 && <MostLikelyPath snapshots={fed} label="Fed path" />}
          {ecb.length > 0 && <MostLikelyPath snapshots={ecb} label="ECB path" />}
        </div>
      </section>

      <Rule tone="soft" />

      <section className="my-10" aria-label="Sponsored">
        <AdSlot slot="4397253039" format="auto" />
      </section>

      <section className="my-12">
        <SectionLabel>Implied rate curves</SectionLabel>
        <div className="mt-4 grid gap-8 lg:grid-cols-2">
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
        </div>
      </section>

      {fed.length > 0 && (
        <>
          <Rule tone="soft" />
          <section className="my-12">
            <SectionLabel>Per-meeting probabilities · Fed</SectionLabel>
            <div className="mt-6 space-y-12">
              {fed.slice(0, 3).map((s) => (
                <ProbabilityTable
                  key={s.meeting.id}
                  data={s}
                  history={fedHistory[s.meeting.id]}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {ecb.length > 0 && (
        <>
          <Rule tone="soft" />
          <section className="my-12">
            <SectionLabel>Per-meeting probabilities · ECB</SectionLabel>
            <div className="mt-6 space-y-12">
              {ecb.slice(0, 3).map((s) => (
                <ProbabilityTable
                  key={s.meeting.id}
                  data={s}
                  history={ecbHistory[s.meeting.id]}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {fed.length === 0 && ecb.length === 0 && (
        <p className="my-12 text-ink-mute">
          No upcoming meetings found. Check back soon.
        </p>
      )}

      <Rule />

      <footer className="mt-12 pt-8 text-sm text-ink-mute">
        <p>
          Data computed in-house from Fed Funds Futures (Yahoo Finance) and €STR OIS
          quotes using the public CME methodology. Not financial advice.
        </p>
        <p className="mt-3 text-xs">
          Built by{" "}
          <a
            href="https://github.com/lawoflarge"
            className="text-cut hover:text-ink underline-offset-4 hover:underline"
          >
            lawoflarge
          </a>
        </p>
      </footer>
    </main>
  );
}
