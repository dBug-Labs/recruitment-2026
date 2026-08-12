/**
 * Layout for the entire admin surface — /admin/login and every panel route.
 *
 * It exists to keep the panel structurally separate from the public site: the
 * (site) group owns all of the recruitment SEO, and this group owns none of
 * it. No canonical URL, no OG image, no keywords, no title suffix that names
 * the drive — just a noindex header on everything below it, so an admin URL
 * that leaks into a crawler's queue still never turns into a search result.
 */
export const metadata = {
  title: {
    default: "Admin",
    template: "%s | Admin",
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
  // Metadata objects are inherited wholesale unless a child sets the same key,
  // so these nulls keep the panel bare even if the root layout ever grows
  // social tags again.
  openGraph: null,
  twitter: null,
};

export default function AdminGroupLayout({ children }) {
  return children;
}
