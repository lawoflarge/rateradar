import Link from "next/link";
import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { JsonLd } from "@/components/JsonLd";
import { MeetingCountdown } from "@/components/MeetingCountdown";
import { ProbabilityTable } from "@/components/ProbabilityTable";
import { Rule } from "@/components/Rule";
import { SectionLabel } from "@/components/SectionLabel";
import { AD_SLOTS } from "@/lib/ad-slots";
import { getFedProbabilities, pickNextMeeting } from "@/lib/data";
import type { MeetingProbabilities } from "@/lib/types";

export const revalidate = 300;

const BASE_URL = "https://rateradar-web.vercel.app";

function formatLongDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function topOutcome(m: MeetingProbabilities) {
  return [...m.outcomes].sort((a, b) => b.probability - a.probability)[0];
}

function summarize(next: MeetingProbabilities | null): string {
  if (!next) return "The next FOMC meeting date will appear here once scheduled.";
  const top = topOutcome(next);
  const pct = Math.round(top.probability * 100);
  const action = top.label === "Hold" ? "hold rates" : `move ${top.label}`;
  return `Markets price a ${pct}% chance the Fed will ${action} at the ${formatShortDate(next.meeting.meeting_date)} meeting.`;
}

export async function generateMetadata(): Promise<Metadata> {
  const next = pickNextMeeting(await getFedProbabilities());
  const title = next
    ? `Next Fed Meeting: ${formatShortDate(next.meeting.meeting_date)} — rate-cut odds`
    : "Next Fed Meeting — FOMC schedule & rate-cut odds";
  const description = next
    ? `${summarize(next)} Live FOMC probabilities and the full meeting schedule.`
    : "Live market-implied probabilities for the next FOMC decision and the full Fed meeting schedule.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: ["/api/og/default"] },
    alternates: { canonical: "/fed" },
  };
}

export default async function FedHubPage() {
  const meetings = await getFedProbabilities();
  const next = pickNextMeeting(meetings);
  const todayISO = new Date().toISOString().slice(0, 10);
  const upcoming = [...meetings]
    .filter((m) => m.meeting.meeting_date >= todayISO)
    .sort((a, b) => (a.meeting.meeting_date < b.meeting.meeting_date ? -1 : 1));
  const year = next
    ? new Date(next.meeting.meeting_date).getFullYear()
    : new Date().getFullYear();

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "When is the next Fed meeting?",
              acceptedAnswer: {
                "@type": "Answer",
                text: next
                  ? `The next FOMC meeting is on ${formatLongDate(next.meeting.meeting_date)}.`
                  : "The next FOMC meeting date will be shown here once scheduled.",
              },
            },
            {
              "@type": "Question",
              name: "Will the Fed cut rates at the next meeting?",
              acceptedAnswer: { "@type": "Answer", text: summarize(next) },
            },
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
            { "@type": "ListItem", position: 2, name: "Fed", item: `${BASE_URL}/fed` },
          ],
        }}
      />

      <header className="mb-12">
        <SectionLabel>Federal Reserve (FOMC)</SectionLabel>
        <h1 className="mt-3 font-serif text-5xl font-medium leading-tight tracking-tight text-ink sm:text-6xl">
          {next ? `Next FOMC Meeting: ${formatLongDate(next.meeting.meeting_date)}` : "Next FOMC Meeting"}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          {summarize(next)}
        </p>
        {next && (
          <div className="mt-4 text-ink-mute">
            <MeetingCountdown meetingDate={next.meeting.meeting_date} />
          </div>
        )}
      </header>

      <Rule />

      {next && (
        <section className="my-12">
          <SectionLabel>Next meeting · outcome distribution</SectionLabel>
          <h2 className="mt-2 mb-6 font-serif text-3xl font-medium text-ink">
            Will the Fed cut rates on {formatShortDate(next.meeting.meeting_date)}?
          </h2>
          <ProbabilityTable data={next} history={[]} showDetailLink={false} />
          <Link
            href={`/meeting/${next.meeting.id}`}
            className="mt-4 inline-block text-sm text-cut hover:text-ink underline-offset-4 hover:underline"
          >
            Full history &amp; detail →
          </Link>
        </section>
      )}

      <Rule tone="soft" />

      <section className="my-12">
        <SectionLabel>All {year} FOMC meetings</SectionLabel>
        <ul className="mt-4 divide-y divide-ink/10">
          {upcoming.map((m) => {
            const t = topOutcome(m);
            return (
              <li key={m.meeting.id}>
                <Link
                  href={`/meeting/${m.meeting.id}`}
                  className="flex items-center justify-between py-3 text-ink hover:text-cut"
                >
                  <span className="font-medium">{formatLongDate(m.meeting.meeting_date)}</span>
                  <span className="font-mono text-sm tabular-nums text-ink-mute">
                    {t.label === "Hold" ? "Hold" : t.label} · {Math.round(t.probability * 100)}%
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="my-10" aria-label="Advertisement">
        <AdSlot slot={AD_SLOTS.fed} format="auto" />
      </section>

      <Rule />

      <footer className="mt-10 pt-8 text-sm text-ink-mute">
        <p>
          Probabilities are computed from Fed Funds futures and update twice per
          business day. See{" "}
          <Link href="/methodology" className="text-cut hover:text-ink underline-offset-4 hover:underline">
            methodology
          </Link>
          . Not financial advice.
        </p>
      </footer>
    </main>
  );
}
