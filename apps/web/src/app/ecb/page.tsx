import Link from "next/link";
import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { JsonLd } from "@/components/JsonLd";
import { MeetingCountdown } from "@/components/MeetingCountdown";
import { Rule } from "@/components/Rule";
import { SectionLabel } from "@/components/SectionLabel";
import { AD_SLOTS } from "@/lib/ad-slots";
import { getEcbProbabilities, pickNextMeeting } from "@/lib/data";
import { CURRENT_ECB_RATE_PCT, CURRENT_POLICY_RATE_LABELS } from "@/lib/policy-rates";

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

export async function generateMetadata(): Promise<Metadata> {
  const next = pickNextMeeting(await getEcbProbabilities());
  const title = next
    ? `Next ECB Meeting: ${formatShortDate(next.meeting.meeting_date)} — rate decision`
    : "Next ECB Meeting — Governing Council schedule";
  const description = next
    ? `The next ECB Governing Council rate decision is on ${formatLongDate(next.meeting.meeting_date)}. Current Deposit Facility Rate ${CURRENT_ECB_RATE_PCT}; full meeting schedule and live tracking.`
    : "The next ECB Governing Council rate decision date, current Deposit Facility Rate, and full meeting schedule.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: ["/api/og/default"] },
    alternates: { canonical: "/ecb" },
  };
}

export default async function EcbHubPage() {
  const meetings = await getEcbProbabilities();
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
              name: "When is the next ECB meeting?",
              acceptedAnswer: {
                "@type": "Answer",
                text: next
                  ? `The next ECB Governing Council monetary-policy meeting is on ${formatLongDate(next.meeting.meeting_date)}.`
                  : "The next ECB meeting date will be shown here once scheduled.",
              },
            },
            {
              "@type": "Question",
              name: "What is the current ECB interest rate?",
              acceptedAnswer: {
                "@type": "Answer",
                text: `The ECB Deposit Facility Rate is currently ${CURRENT_ECB_RATE_PCT}.`,
              },
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
            { "@type": "ListItem", position: 2, name: "ECB", item: `${BASE_URL}/ecb` },
          ],
        }}
      />

      <header className="mb-12">
        <SectionLabel>European Central Bank (Governing Council)</SectionLabel>
        <h1 className="mt-3 font-serif text-5xl font-medium leading-tight tracking-tight text-ink sm:text-6xl">
          {next ? `Next ECB Meeting: ${formatLongDate(next.meeting.meeting_date)}` : "Next ECB Meeting"}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          The ECB Governing Council sets the Deposit Facility Rate, currently {CURRENT_ECB_RATE_PCT}.
          {next ? ` The next decision is on ${formatLongDate(next.meeting.meeting_date)}.` : ""}
        </p>
        {next && (
          <div className="mt-4 text-ink-mute">
            <MeetingCountdown meetingDate={next.meeting.meeting_date} />
          </div>
        )}
      </header>

      <Rule />

      <section className="my-10 grid gap-8 border-y border-ink/15 py-8 sm:grid-cols-2">
        <div>
          <SectionLabel>Current rate</SectionLabel>
          <div className="mt-2 font-serif text-2xl font-medium text-ink">{CURRENT_ECB_RATE_PCT}</div>
          <div className="mt-1 text-sm text-ink-mute">{CURRENT_POLICY_RATE_LABELS.ECB}</div>
        </div>
        <div className="sm:border-l sm:border-ink/15 sm:pl-8">
          <SectionLabel>Forward odds</SectionLabel>
          <div className="mt-2 text-ink-soft">
            Spot-anchored — market-implied forward probabilities for the ECB are
            not yet available (no free forward-rate source).
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

      <section className="my-12">
        <SectionLabel>Upcoming {year} ECB meetings</SectionLabel>
        <ul className="mt-4 divide-y divide-ink/10">
          {upcoming.map((m) => (
            <li key={m.meeting.id}>
              <Link
                href={`/meeting/${m.meeting.id}`}
                className="flex items-center justify-between py-3 text-ink hover:text-cut"
              >
                <span className="font-medium">{formatLongDate(m.meeting.meeting_date)}</span>
                <span className="font-mono text-sm tabular-nums text-ink-mute">View →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="my-10" aria-label="Advertisement">
        <AdSlot slot={AD_SLOTS.ecb} format="auto" />
      </section>

      <Rule />

      <footer className="mt-10 pt-8 text-sm text-ink-mute">
        <p>
          ECB tracking is spot-anchored at the current Deposit Facility Rate. See{" "}
          <Link href="/methodology" className="text-cut hover:text-ink underline-offset-4 hover:underline">
            methodology
          </Link>
          . Not financial advice.
        </p>
      </footer>
    </main>
  );
}
