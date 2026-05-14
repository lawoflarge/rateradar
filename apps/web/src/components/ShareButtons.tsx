"use client";

import { useState } from "react";

interface Props {
  meetingId: string;
  title: string;
}

export function ShareButtons({ meetingId, title }: Props) {
  const [copied, setCopied] = useState(false);

  const url =
    typeof window === "undefined"
      ? `https://rateradar-web.vercel.app/meeting/${meetingId}`
      : `${window.location.origin}/meeting/${meetingId}`;

  const tweetText = encodeURIComponent(`${title} · via RateRadar`);
  const encodedUrl = encodeURIComponent(url);
  const twitterHref = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodedUrl}`;
  const linkedinHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API blocked — no-op
    }
  }

  return (
    <div className="rounded-none border border-ink/15 bg-cream-soft p-5">
      <div className="mb-3 text-xs uppercase tracking-wide text-ink-mute">
        Share this meeting
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={twitterHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-ink/25 bg-cream-soft px-3 py-1.5 text-sm text-ink hover:border-cut hover:text-cut"
        >
          Share on Twitter / X
        </a>
        <a
          href={linkedinHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-ink/25 bg-cream-soft px-3 py-1.5 text-sm text-ink hover:border-cut hover:text-cut"
        >
          Share on LinkedIn
        </a>
        <button
          type="button"
          onClick={copyLink}
          className="rounded-md border border-ink/25 bg-cream-soft px-3 py-1.5 text-sm text-ink hover:border-cut hover:text-cut"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
