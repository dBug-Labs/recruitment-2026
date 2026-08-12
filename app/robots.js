import { SITE_URL, IS_INDEXABLE, PRIVATE_PATHS } from "@/lib/site";

/**
 * robots.txt
 *
 * Everything behind auth is disallowed outright — the candidate dashboard, the
 * admin panel and the API all serve personal data and have no business in a
 * search index. Non-production origins (previews, localhost) refuse everything
 * so a preview URL can never outrank the real site.
 */
export default function robots() {
  if (!IS_INDEXABLE) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS.map((p) => `${p}/`),
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
