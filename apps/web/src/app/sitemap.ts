import type { MetadataRoute } from "next";
import { getEcbProbabilities, getFedProbabilities } from "@/lib/data";
import { TERMS } from "@/lib/glossary-terms";

const BASE_URL = "https://rateradar-web.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE_URL}/compare`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    {
      url: `${BASE_URL}/methodology`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    { url: `${BASE_URL}/glossary`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/scenarios`, lastModified: now, changeFrequency: "hourly", priority: 0.7 },
    { url: `${BASE_URL}/brokers`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  const glossaryTerms: MetadataRoute.Sitemap = TERMS.map((t) => ({
    url: `${BASE_URL}/glossary/${t.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  let meetings: MetadataRoute.Sitemap = [];
  try {
    const [fed, ecb] = await Promise.all([
      getFedProbabilities(),
      getEcbProbabilities(),
    ]);
    meetings = [...fed, ...ecb].map((m) => ({
      url: `${BASE_URL}/meeting/${m.meeting.id}`,
      lastModified: new Date(m.snapshot_at),
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));
  } catch {
    // Ignore — sitemap still valid without meeting pages
  }

  return [...staticPages, ...glossaryTerms, ...meetings];
}
