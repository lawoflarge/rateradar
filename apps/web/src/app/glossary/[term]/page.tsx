import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { JsonLd } from "@/components/JsonLd";
import { Rule } from "@/components/Rule";
import { SectionLabel } from "@/components/SectionLabel";
import { AD_SLOTS } from "@/lib/ad-slots";
import { TERMS, getTerm } from "@/lib/glossary-terms";

interface PageProps {
  params: Promise<{ term: string }>;
}

const SITE_URL = "https://rateradar-web.vercel.app";

export function generateStaticParams() {
  return TERMS.map((t) => ({ term: t.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { term: slug } = await params;
  const t = getTerm(slug);
  if (!t) return { title: "Term not found" };
  const firstSentence = t.def.split(". ")[0] + ".";
  return {
    title: `What is ${t.term}?`,
    description: firstSentence,
    alternates: { canonical: `/glossary/${t.slug}` },
    openGraph: {
      title: `What is ${t.term}? · RateRadar`,
      description: firstSentence,
      type: "article",
    },
  };
}

export default async function GlossaryTermPage({ params }: PageProps) {
  const { term: slug } = await params;
  const t = getTerm(slug);
  if (!t) notFound();

  // 4 sibling terms (next ones, wrapping) as related links.
  const idx = TERMS.findIndex((x) => x.slug === t.slug);
  const related = Array.from({ length: 4 }, (_, k) => TERMS[(idx + k + 1) % TERMS.length]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "DefinedTerm",
          name: t.term,
          description: t.def,
          inDefinedTermSet: `${SITE_URL}/glossary`,
          url: `${SITE_URL}/glossary/${t.slug}`,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: "Glossary", item: `${SITE_URL}/glossary` },
            { "@type": "ListItem", position: 3, name: t.term, item: `${SITE_URL}/glossary/${t.slug}` },
          ],
        }}
      />

      <nav className="mb-8 text-sm text-ink-mute">
        <Link href="/" className="underline-offset-4 hover:text-cut hover:underline">
          Home
        </Link>{" "}
        /{" "}
        <Link href="/glossary" className="underline-offset-4 hover:text-cut hover:underline">
          Glossary
        </Link>{" "}
        / <span className="text-ink">{t.term}</span>
      </nav>

      <header className="mb-8">
        <SectionLabel>Glossary</SectionLabel>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          {t.term}
        </h1>
      </header>

      <p className="text-lg leading-relaxed text-ink-soft">{t.def}</p>

      <div className="mt-8 text-sm text-ink-mute">
        See it in action on the{" "}
        <Link href="/" className="text-cut underline-offset-4 hover:text-ink hover:underline">
          live probability tracker
        </Link>{" "}
        or read the{" "}
        <Link
          href="/methodology"
          className="text-cut underline-offset-4 hover:text-ink hover:underline"
        >
          full methodology
        </Link>
        .
      </div>

      <Rule tone="soft" />

      <section className="my-8">
        <SectionLabel>Related terms</SectionLabel>
        <ul className="mt-4 flex flex-wrap gap-2">
          {related.map((r) => (
            <li key={r.slug}>
              <Link
                href={`/glossary/${r.slug}`}
                className="inline-block border border-ink/15 px-2.5 py-1 font-mono text-xs text-ink-mute transition-colors hover:border-cut/40 hover:text-ink"
              >
                {r.term}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="my-10" aria-label="Advertisement">
        <AdSlot slot={AD_SLOTS.glossary} format="auto" />
      </section>

      <Link
        href="/glossary"
        className="text-sm text-cut underline-offset-4 hover:text-ink hover:underline"
      >
        ← All glossary terms
      </Link>
    </main>
  );
}
