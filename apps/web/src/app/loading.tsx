export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      {/* Header skeleton */}
      <div className="mb-16">
        <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-800" />
        <div className="mt-10 h-12 w-full max-w-2xl animate-pulse rounded bg-zinc-900" />
        <div className="mt-4 h-6 w-3/4 animate-pulse rounded bg-zinc-900" />
      </div>

      {/* Hero skeleton */}
      <div className="mb-12 h-40 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />

      {/* Most-likely path skeleton */}
      <div className="mb-6 h-40 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900" />

      {/* Section skeletons */}
      <div className="space-y-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-80 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900"
          />
        ))}
      </div>
    </main>
  );
}
