import { Anton, Oswald, Barlow } from "next/font/google";
import "./globals.css";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, IS_INDEXABLE } from "@/lib/site";

const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton", display: "swap" });
const oswald = Oswald({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-oswald", display: "swap" });
const barlow = Barlow({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-barlow", display: "swap" });

export const metadata = {
  // Lets every route below use relative paths for canonical/OG URLs.
  metadataBase: new URL(SITE_URL),

  title: {
    default: "dBug Labs — Brand New Day | Recruitments '26",
    // Child routes set a bare title and inherit the brand suffix from here.
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "education",
  keywords: [
    "dBug Labs",
    "dBug Labs recruitment",
    "dBug Labs SRM",
    "SRM club recruitment 2026",
    "Brand New Day",
    "SRM technical club",
    "web development club SRM",
    "AI ML club SRM",
    "student club recruitment",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,

  alternates: { canonical: "/" },

  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "dBug Labs — Brand New Day | Recruitments '26",
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_IN",
    // Image comes from app/opengraph-image.jsx — Next wires it up automatically.
  },

  twitter: {
    card: "summary_large_image",
    title: "dBug Labs — Brand New Day | Recruitments '26",
    description: SITE_DESCRIPTION,
  },

  // Previews and local builds stay out of the index; only the real domain
  // (NEXT_PUBLIC_SITE_URL set, production build) is allowed to rank.
  robots: IS_INDEXABLE
    ? {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
          "max-video-preview": -1,
        },
      }
    : { index: false, follow: false },

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
