import type { MetadataRoute } from "next";

// Explicitly welcome AI / answer-engine crawlers (GEO/LLMO). The `*` rule
// already allows them; naming them makes the intent unambiguous.
const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: "https://rateradar-web.vercel.app/sitemap.xml",
    host: "https://rateradar-web.vercel.app",
  };
}
