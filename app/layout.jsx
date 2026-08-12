import { Anton, Oswald, Barlow } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton", display: "swap" });
const oswald = Oswald({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-oswald", display: "swap" });
const barlow = Barlow({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-barlow", display: "swap" });

/**
 * The root layout is deliberately just the document shell — fonts, stylesheet,
 * <html>/<body>. Everything that describes the *site* (title template, OG tags,
 * keywords, robots) sits in app/(site)/layout.jsx, and the admin panel gets its
 * own opposite of that in app/(admin)/layout.jsx. Nothing declared here can
 * leak recruitment marketing into the admin panel, or vice versa.
 */
export const metadata = {
  // Lets every route below use relative paths for canonical/OG URLs.
  metadataBase: new URL(SITE_URL),
  title: "dBug Labs",

  // Search Console verification — paste the token into the env var, or drop
  // this block once you have verified via DNS instead.
  ...(process.env.GOOGLE_SITE_VERIFICATION && {
    verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
  }),
};

// Next.js only emits the responsive viewport meta tag when a route exports one.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#08050a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${anton.variable} ${oswald.variable} ${barlow.variable}`}>
      <body>{children}</body>
    </html>
  );
}
