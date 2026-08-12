/**
 * page.jsx is a Client Component (the form is interactive all the way down),
 * and metadata may only be exported from a Server Component — so the /apply
 * metadata lives in this layout instead.
 */

const TITLE = "Apply — dBug Labs Recruitments 2026";
const DESCRIPTION =
  "Apply to dBug Labs Recruitments 2026. Verify your SRM email, pick up to two of ten domains " +
  "across tech and corporate, and get your task brief straight away. Applications close 28 August 2026.";

export const metadata = {
  title: "Apply",
  description: DESCRIPTION,
  alternates: { canonical: "/apply" },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    url: "/apply",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function ApplyLayout({ children }) {
  return children;
}
