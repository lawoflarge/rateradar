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
      <h1 className="text-3xl font-semibold text-zinc-100">Something went wrong</h1>
      <p className="mt-4 text-zinc-400">
        We&apos;ve logged the error and will investigate. In the meantime, try
        refreshing or head back to the dashboard.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-zinc-600">ref: {error.digest}</p>
      )}
      <div className="mt-8 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:border-emerald-400 hover:text-emerald-300"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-300"
        >
          Dashboard
        </Link>
      </div>
    </main>
  );
}
