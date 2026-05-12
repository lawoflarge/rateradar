"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production, forward to PostHog/Sentry once configured
    console.error("RateRadar runtime error:", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="font-serif text-5xl font-medium tracking-tight text-ink">
        Something went wrong
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-ink-soft">
        We&apos;ve logged the error and will investigate. In the meantime, try
        refreshing or head back to the dashboard.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs tabular-nums text-ink-mute">
          ref: {error.digest}
        </p>
      )}
      <div className="mt-10 flex justify-center gap-6">
        <button
          type="button"
          onClick={reset}
          className="border border-ink/25 bg-cream-soft px-4 py-2 text-sm text-ink hover:border-cut hover:text-cut"
        >
          Try again
        </button>
        <Link
          href="/"
          className="text-cut hover:underline underline-offset-4"
        >
          Go to dashboard →
        </Link>
      </div>
    </main>
  );
}
