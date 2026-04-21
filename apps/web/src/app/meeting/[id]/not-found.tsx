import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-3xl font-semibold">Meeting not found</h1>
      <p className="mt-4 text-zinc-400">
        We couldn&apos;t find a meeting with that ID. It may have been removed or the
        link is incorrect.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block text-emerald-400 hover:text-emerald-300"
      >
        ← Back to all meetings
      </Link>
    </main>
  );
}
