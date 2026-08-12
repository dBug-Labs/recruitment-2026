import { SITE_NAME, SITE_DESCRIPTION, IS_INDEXABLE } from "@/lib/site";

/**
 * Layout for the public site and the candidate portal — every route a
 * candidate or a visitor can reach. All of the recruitment-drive SEO lives
 * here rather than in the root layout, so the admin group (app/(admin)) never
 * inherits a single tag of it.
 */
export const metadata = {
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
    // Image comes from app/(site)/opengraph-image.jsx — Next wires it up.
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
};

export default function SiteLayout({ children }) {
  return children;
}
