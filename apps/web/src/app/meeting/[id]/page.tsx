import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { JsonLd } from "@/components/JsonLd";
import { MeetingContext } from "@/components/MeetingContext";
import { MeetingCountdown } from "@/components/MeetingCountdown";
import { ProbabilityTable } from "@/components/ProbabilityTable";
import { Rule } from "@/components/Rule";
import { SectionLabel } from "@/components/SectionLabel";
import { ShareButtons } from "@/components/ShareButtons";
import { AD_SLOTS } from "@/lib/ad-slots";
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

  const title = `${bank} ${date} · markets price ${pct}% to ${action}`;
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
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: `${bank} ${formatShortDate(data.meeting.meeting_date)} rate decision · market-implied probabilities`,
          description: `Market-implied probabilities for the ${bank} ${formatShortDate(data.meeting.meeting_date)} rate decision, with 60 days of historical tracking.`,
          author: { "@type": "Organization", name: "RateRadar" },
          publisher: { "@type": "Organization", name: "RateRadar" },
          mainEntityOfPage: `https://rateradar-web.vercel.app/meeting/${id}`,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: "https://rateradar-web.vercel.app/",
            },
            {
              "@type": "ListItem",
              position: 2,
              name: `${bank} ${formatShortDate(data.meeting.meeting_date)}`,
              item: `https://rateradar-web.vercel.app/meeting/${id}`,
            },
          ],
        }}
      />
      <nav className="mb-8 text-sm text-ink-mute">
        <Link href="/" className="hover:text-cut underline-offset-4 hover:underline">
          ← Back to all meetings
        </Link>
      </nav>

      {/* Hero */}
      <header className="mb-12">
        <SectionLabel>
          {bank === "FED"
            ? "Federal Reserve (FOMC)"
            : "European Central Bank (Governing Council)"}
        </SectionLabel>
        <h1 className="mt-3 font-serif text-5xl font-medium leading-tight tracking-tight text-ink sm:text-6xl">
          {formatLongDate(data.meeting.meeting_date)}
        </h1>
        <div className="mt-4 text-ink-mute">
          <MeetingCountdown meetingDate={data.meeting.meeting_date} />
        </div>
      </header>

      <Rule />

      {/* Key facts: rule-separated, no cards */}
      <section className="my-10 grid gap-8 border-y border-ink/15 py-8 sm:grid-cols-3">
        <div>
          <SectionLabel>Most likely</SectionLabel>
          <div className="mt-2 font-serif text-2xl font-medium text-ink">
            {top.label === "Hold" ? "Hold rates" : `Move ${top.label}`}
          </div>
        </div>
        <div>
          <SectionLabel>Probability</SectionLabel>
          <div className="mt-2 font-serif text-2xl font-medium">
            <span className="font-mono tabular-nums">
              {(top.probability * 100).toFixed(1)}%
            </span>
          </div>
          {deltaLabel && (
            <div className="mt-1 font-mono text-xs tabular-nums text-ink-mute">
              {deltaLabel}
            </div>
          )}
        </div>
        <div>
          <SectionLabel>Data source</SectionLabel>
          <div className="mt-2 text-ink-soft">
            Computed from{" "}
            {bank === "FED" ? "Fed Funds Futures" : "€STR OIS quotes"}
          </div>
          <Link
            href="/methodology"
            className="mt-2 inline-block text-sm text-cut hover:text-ink underline-offset-4 hover:underline"
          >
            How we calculate →
          </Link>
        </div>
      </section>

      <Rule tone="soft" />

      {/* Path context: prior + next meeting */}
      <section className="my-12">
        <SectionLabel>Meeting context</SectionLabel>
        <div className="mt-4">
          <MeetingContext prior={context.prior} next={context.next} />
        </div>
      </section>

      <Rule tone="soft" />

      {/* Full probability table + chart */}
      <section className="my-12">
        <SectionLabel>Full probability table</SectionLabel>
        <h2 className="mt-2 mb-6 font-serif text-3xl font-medium text-ink">
          Outcome distribution
        </h2>
        <ProbabilityTable data={data} history={history} showDetailLink={false} />
      </section>

      <Rule tone="soft" />

      {/* Share */}
      <section className="my-12">
        <SectionLabel>Share</SectionLabel>
        <div className="mt-4">
          <ShareButtons
            meetingId={id}
            title={`${bank} ${formatShortDate(data.meeting.meeting_date)} · ${Math.round(top.probability * 100)}% ${top.label === "Hold" ? "hold" : `move ${top.label}`}`}
          />
        </div>
      </section>

      <section className="my-10" aria-label="Advertisement">
        <AdSlot slot={AD_SLOTS.meeting} format="auto" />
      </section>

      <Rule />

      <footer className="mt-10 pt-8 text-sm text-ink-mute">
        <p>
          Probabilities update twice per business day (after US and European
          session close) and every 15 minutes on meeting days. See{" "}
          <Link
            href="/methodology"
            className="text-cut hover:text-ink underline-offset-4 hover:underline"
          >
            methodology
          </Link>{" "}
          for the full calculation. Not financial advice.
        </p>
      </footer>
    </main>
  );
}
