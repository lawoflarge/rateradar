import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "@/components/AdSlot";
import { JsonLd } from "@/components/JsonLd";
import { Rule } from "@/components/Rule";
import { AD_SLOTS } from "@/lib/ad-slots";
import { TERMS } from "@/lib/glossary-terms";

export const metadata: Metadata = {
  title: "Glossary · rate-decision terms explained",
  description:
    "Plain-English definitions for the terms used on RateRadar: basis points, FOMC, DFR, hawkish, dovish, priced in, and more.",
  alternates: { canonical: "/glossary" },
};

export default function GlossaryPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: TERMS.map(({ term, def }) => ({
            "@type": "Question",
            name: term,
            acceptedAnswer: { "@type": "Answer", text: def },
          })),
        }}
      />
      <header className="mb-10">
        <h1 className="font-serif text-5xl font-medium tracking-tight text-ink">
          Glossary
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">
          Plain-English definitions for the terms you&apos;ll see on RateRadar.
          No Bloomberg terminal required.
        </p>
      </header>

      <dl>
        {TERMS.map(({ slug, term, def }, i) => (
          <div key={term}>
            <dt className="font-mono text-sm uppercase tracking-wider text-ink">
              <Link
                href={`/glossary/${slug}`}
                className="underline-offset-4 hover:text-cut hover:underline"
              >
                {term}
              </Link>
            </dt>
            <dd className="mt-1 mb-6 text-lg leading-relaxed text-ink-soft">
              {def}
            </dd>
            {i < TERMS.length - 1 && <Rule tone="soft" />}
          </div>
        ))}
      </dl>
      <section className="my-10" aria-label="Advertisement">
        <AdSlot slot={AD_SLOTS.glossary} format="auto" />
      </section>
    </main>
  );
}
