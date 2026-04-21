import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold text-zinc-100">Page not found</h1>
      <p className="mt-4 text-zinc-400">
        The URL you followed doesn&apos;t point to anything on RateRadar.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-md bg-emerald-400 px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-300"
      >
        Go to dashboard
      </Link>
    </main>
  );
}
