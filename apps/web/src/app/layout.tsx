import type { Metadata } from "next";
import { Inter, JetBrains_Mono, IBM_Plex_Serif } from "next/font/google";
import Script from "next/script";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
const fundingChoicesId = adsenseClient?.replace(/^ca-/, "");

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
  title: {
    default: "RateRadar · Fed + ECB rate-decision probabilities",
    template: "%s · RateRadar",
  },
  description:
    "Track market-implied probabilities for Fed and ECB interest-rate decisions, with historical charts showing how expectations have shifted over days and weeks.",
  openGraph: {
    title: "RateRadar",
    description:
      "Fed + ECB rate-decision probabilities with historical tracking. See where rates are headed before the meeting.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RateRadar",
    description: "Fed + ECB rate-decision probabilities with historical tracking.",
  },
  other: adsenseClient
    ? { "google-adsense-account": adsenseClient }
    : undefined,
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
        <NavBar />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
