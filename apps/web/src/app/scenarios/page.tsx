import type { Metadata } from "next";

import Link from "next/link";

import { AdSlot } from "@/components/AdSlot";
import { AppStoreBadge } from "@/components/AppStoreBadge";
import { ScenarioBuilder } from "@/components/ScenarioBuilder";
import { Rule } from "@/components/Rule";
import { SectionLabel } from "@/components/SectionLabel";
import { AD_SLOTS } from "@/lib/ad-slots";
import { getEcbProbabilities, getFedProbabilities } from "@/lib/data";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Rate scenarios · what-if conditional paths",
  description:
    "Condition on a single Fed or ECB meeting outcome and see the re-anchored market-implied rate path for the meetings that follow. A transparent what-if, not a forecast.",
  openGraph: {
    title: "Rate scenarios · what-if conditional paths",
    description:
      "What if the Fed cuts in March? Condition on a meeting outcome and see the re-anchored implied path.",
    type: "website",
  },
  alternates: { canonical: "/scenarios" },
};

export default async function ScenariosPage() {
  const [fed, ecb] = await Promise.all([
    getFedProbabilities(),
    getEcbProbabilities(),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <SectionLabel>Scenarios</SectionLabel>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        Conditional rate paths
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-mute">
        Pick a meeting and an outcome, for example &ldquo;Fed cuts 25bp in
        March&rdquo;, and see how the market-implied path for the following
        meetings re-anchors on that assumption.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <AppStoreBadge slug="scenarios-hero" priority />
        <span className="max-w-xs text-sm leading-relaxed text-ink-mute">
          Scenarios are in the{" "}
          <Link
            href="/fed-rate-tracker-app"
            className="text-cut underline-offset-4 hover:text-ink hover:underline"
          >
            iPhone app
          </Link>{" "}
          as well.
        </span>
      </div>
      <Rule />
      <div className="mt-6">
        <ScenarioBuilder fed={fed} ecb={ecb} />
      </div>
      <section className="my-10" aria-label="Advertisement">
        <AdSlot slot={AD_SLOTS.scenarios} format="auto" />
      </section>
    </main>
  );
}
