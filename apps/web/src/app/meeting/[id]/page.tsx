import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeetingContext } from "@/components/MeetingContext";
import { MeetingCountdown } from "@/components/MeetingCountdown";
import { ProbabilityTable } from "@/components/ProbabilityTable";
import { ShareButtons } from "@/components/ShareButtons";
import { getMeetingById, getMeetingContext, getMeetingHistory } from "@/lib/data";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 300;

function formatLongDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getMeetingById(id);
  if (!data) return { title: "Meeting not found" };

  const top = [...data.outcomes].sort((a, b) => b.probability - a.probability)[0];
  const bank = data.meeting.bank_code;
  const date = formatShortDate(data.meeting.meeting_date);
  const pct = Math.round(top.probability * 100);
  const action = top.label === "Hold" ? "hold" : `move ${top.label}`;

  const title = `${bank} ${date} — markets price ${pct}% to ${action}`;
  const description =
    `Market-implied probabilities for the ${bank} ${date} rate decision, ` +
    `with 60 days of historical probability tracking.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: [`/api/og/meeting/${id}`],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/api/og/meeting/${id}`],
    },
    alternates: {
      canonical: `/meeting/${id}`,
    },
  };
}

export default async function MeetingPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getMeetingById(id);
  if (!data) notFound();

  const [history, context] = await Promise.all([
    getMeetingHistory(id, 60),
    getMeetingContext(id),
  ]);
  const top = [...data.outcomes].sort((a, b) => b.probability - a.probability)[0];
  const bank = data.meeting.bank_code;

  // Compute delta vs 30 days ago for the top outcome, if history available
  const topSeries = history.find((s) => s.delta_bps === top.delta_bps);
  let deltaLabel: string | null = null;
  if (topSeries && topSeries.series.length > 30) {
    const then = topSeries.series[topSeries.series.length - 30];
    const delta = top.probability - then.probability;
    if (Math.abs(delta) > 0.01) {
      const sign = delta >= 0 ? "+" : "";
      deltaLabel = `${sign}${(delta * 100).toFixed(0)}pp vs 30d ago`;
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <nav className="mb-8 text-sm text-zinc-500">
        <Link href="/" className="hover:text-emerald-400">
          ← Back to all meetings
        </Link>
      </nav>

      {/* Hero */}
      <header className="mb-10">
        <div className="text-xs uppercase tracking-wide text-emerald-400">
          {bank === "FED" ? "Federal Reserve (FOMC)" : "European Central Bank (Governing Council)"}
        </div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          {formatLongDate(data.meeting.meeting_date)}
        </h1>
        <div className="mt-3 text-zinc-500">
          <MeetingCountdown meetingDate={data.meeting.meeting_date} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Most likely
            </div>
            <div className="mt-1 text-2xl font-semibold text-emerald-300">
              {top.label === "Hold" ? "Hold rates" : `Move ${top.label}`}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Probability
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {(top.probability * 100).toFixed(1)}%
            </div>
            {deltaLabel && (
              <div className="mt-1 text-xs text-zinc-500">{deltaLabel}</div>
            )}
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Data source
            </div>
            <div className="mt-1 text-sm text-zinc-300">
              Computed from {bank === "FED" ? "Fed Funds Futures" : "€STR OIS quotes"}
            </div>
            <Link
              href="/methodology"
              className="mt-1 inline-block text-xs text-emerald-400 hover:text-emerald-300"
            >
              How we calculate →
            </Link>
          </div>
        </div>
      </header>

      {/* Path context: prior + next meeting */}
      <section className="mb-8">
        <MeetingContext prior={context.prior} next={context.next} />
      </section>

      {/* Full probability table + chart */}
      <section className="mb-10">
        <ProbabilityTable data={data} history={history} showDetailLink={false} />
      </section>

      {/* Share */}
      <section className="mb-10">
        <ShareButtons
          meetingId={id}
          title={`${bank} ${formatShortDate(data.meeting.meeting_date)} — ${Math.round(top.probability * 100)}% ${top.label === "Hold" ? "hold" : `move ${top.label}`}`}
        />
      </section>

      <footer className="border-t border-zinc-900 pt-8 text-sm text-zinc-500">
        <p>
          Probabilities update twice per business day (after US and European
          session close) and every 15 minutes on meeting days. See{" "}
          <Link href="/methodology" className="text-zinc-300 hover:text-emerald-400">
            methodology
          </Link>{" "}
          for the full calculation. Not financial advice.
        </p>
      </footer>
    </main>
  );
}
