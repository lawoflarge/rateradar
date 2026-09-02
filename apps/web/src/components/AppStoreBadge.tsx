/**
 * Official Apple "Download on the App Store" badge, used as the single
 * download call to action across the site.
 *
 * Every link carries a campaign token (`ct`) so App Store Connect attributes
 * the install to the page section it came from, and a matching `data-aso-cta`
 * attribute that the click measurement block reads. The badge artwork keeps
 * Apple's aspect ratio; distorting it breaks the marketing guidelines.
 */

export const APP_STORE_ID = "6768628917";

/** Campaign-tagged App Store link. `mt=8` is Apple's software media type. */
export function appStoreUrl(slug: string): string {
  return `https://apps.apple.com/app/id${APP_STORE_ID}?ct=${slug}&mt=8`;
}

interface AppStoreBadgeProps {
  /** Where on the page this badge sits, e.g. "hero", "features", "faq". */
  slug: string;
  /** Set on the first badge above the fold so it is not lazy loaded. */
  priority?: boolean;
  className?: string;
}

export function AppStoreBadge({
  slug,
  priority = false,
  className = "",
}: AppStoreBadgeProps) {
  return (
    <a
      href={appStoreUrl(slug)}
      data-aso-cta={slug}
      aria-label="Download RateRadar on the App Store"
      className={`inline-block leading-[0] transition-opacity hover:opacity-80 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/app-store-badge.svg"
        alt="Download on the App Store"
        width={120}
        height={40}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="h-[48px] w-auto max-w-full"
      />
    </a>
  );
}
