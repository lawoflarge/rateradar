import type { Metadata } from "next";
import { Inter, JetBrains_Mono, IBM_Plex_Serif } from "next/font/google";
import Script from "next/script";
import { APP_STORE_ID, appStoreUrl } from "@/components/AppStoreBadge";
import { AsoAnalytics } from "@/components/AsoAnalytics";
import { JsonLd } from "@/components/JsonLd";
import { NavBar } from "@/components/NavBar";
import { NativeNavBridge } from "@/components/NativeNavBridge";
import { SiteFooter } from "@/components/SiteFooter";
import { StickyAnchorAd } from "@/components/StickyAnchorAd";
import "./globals.css";

const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
const fundingChoicesId = adsenseClient?.replace(/^ca-/, "");

const SITE_URL = "https://rateradar-web.vercel.app";

/**
 * iOS Safari Smart App Banner. `app-argument` is the page the app is opened
 * with, so a visitor who already has RateRadar installed lands in the app
 * instead of bouncing off the store.
 */
const SMART_BANNER = `app-id=${APP_STORE_ID}, app-argument=${SITE_URL}`;

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const plexSerif = IBM_Plex_Serif({
  variable: "--font-plex-serif",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "RateRadar · Fed + ECB rate-decision probabilities",
    template: "%s · RateRadar",
  },
  description:
    "Track market-implied probabilities for Fed and ECB interest-rate decisions, with historical charts showing how expectations have shifted over days and weeks.",
  applicationName: "RateRadar",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "RateRadar",
    description:
      "Fed + ECB rate-decision probabilities with historical tracking. See where rates are headed before the meeting.",
    type: "website",
    siteName: "RateRadar",
    locale: "en_US",
    url: SITE_URL,
    images: ["/api/og/default"],
  },
  twitter: {
    card: "summary_large_image",
    title: "RateRadar",
    description: "Fed + ECB rate-decision probabilities with historical tracking.",
    images: ["/api/og/default"],
  },
  appleWebApp: { capable: true, title: "RateRadar" },
  manifest: "/site.webmanifest",
  other: {
    "apple-itunes-app": SMART_BANNER,
    ...(adsenseClient ? { "google-adsense-account": adsenseClient } : {}),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${plexSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-cream text-ink flex flex-col">
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "RateRadar",
            url: SITE_URL,
            description:
              "Market-implied probabilities for Fed and ECB interest-rate decisions, with historical tracking.",
          }}
        />
        {/* The app itself. No aggregateRating: the App Store listing has no
            ratings yet, and inventing one would be a lie to the crawler. */}
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "RateRadar: Fed Rate Tracker",
            applicationCategory: "FinanceApplication",
            operatingSystem: "iOS 17.0 or later",
            softwareVersion: "1.3.0",
            url: SITE_URL,
            installUrl: appStoreUrl("schema"),
            description:
              "RateRadar tracks the market-implied probability of every upcoming US Federal Reserve and European Central Bank interest rate decision, showing whether a hold, cut, or hike is priced in, plus 60 days of history of how those odds have moved.",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
              availability: "https://schema.org/InStock",
            },
            author: { "@type": "Person", name: "Levin Schwab" },
          }}
        />
        {fundingChoicesId && (
          <>
            <Script
              id="funding-choices-loader"
              async
              src={`https://fundingchoicesmessages.google.com/i/${fundingChoicesId}?ers=1`}
              strategy="beforeInteractive"
            />
            <Script id="funding-choices-presence" strategy="beforeInteractive">
              {`(function(){function s(){if(!window.frames['googlefcPresent']){if(document.body){var i=document.createElement('iframe');i.style='width:0;height:0;border:none;z-index:-1000;left:-1000px;top:-1000px;display:none';i.name='googlefcPresent';document.body.appendChild(i);}else{setTimeout(s,0);}}}s();})();`}
            </Script>
          </>
        )}
        {adsenseClient && (
          <Script
            id="adsense-loader"
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        <NativeNavBridge />
        <NavBar />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <StickyAnchorAd />
        <AsoAnalytics />
      </body>
    </html>
  );
}
