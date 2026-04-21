import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "RateRadar — Fed + ECB rate-decision probabilities",
    template: "%s · RateRadar",
  },
  description:
    "Track market-implied probabilities for Fed and ECB interest-rate decisions, with historical charts showing how expectations have shifted over days and weeks.",
  openGraph: {
    title: "RateRadar",
    description:
      "Fed + ECB rate-decision probabilities with historical tracking. See where rates are headed — before the meeting.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RateRadar",
    description: "Fed + ECB rate-decision probabilities with historical tracking.",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-950 text-zinc-100 flex flex-col">
        <NavBar />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
