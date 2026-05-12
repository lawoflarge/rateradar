import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <div className="flex justify-center">
        <BrandMark />
      </div>
      <h1 className="mt-8 font-serif text-5xl font-medium tracking-tight text-ink">
        Page not found
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-ink-soft">
        The URL you followed doesn&apos;t point to anything on RateRadar.
      </p>
      <Link
        href="/"
        className="mt-10 inline-block text-cut hover:underline underline-offset-4"
      >
        Go to dashboard →
      </Link>
    </main>
  );
}
