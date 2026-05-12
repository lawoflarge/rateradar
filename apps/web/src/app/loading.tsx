export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      {/* Header skeleton */}
      <div className="mb-16">
        <div className="h-8 w-8 animate-pulse bg-cream-soft" />
        <div className="mt-10 h-12 w-full max-w-2xl animate-pulse bg-cream-soft" />
        <div className="mt-4 h-6 w-3/4 animate-pulse bg-cream-soft" />
      </div>

      {/* Hero skeleton */}
      <div className="mb-12 h-40 animate-pulse border border-ink/15 bg-cream-soft" />

      {/* Most-likely path skeleton */}
      <div className="mb-6 h-40 animate-pulse border border-ink/15 bg-cream-soft" />

      {/* Section skeletons */}
      <div className="space-y-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-80 animate-pulse border border-ink/15 bg-cream-soft"
          />
        ))}
      </div>
    </main>
  );
}
