import { SITE_URL, PUBLIC_ROUTES } from "@/lib/site";

/**
 * sitemap.xml — only the four public routes. Everything else needs a session,
 * so listing it would just hand crawlers a wall of redirects to /login.
 */
export default function sitemap() {
  const lastModified = new Date();

  return PUBLIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: new URL(path, SITE_URL).toString(),
    lastModified,
    changeFrequency,
    priority,
  }));
}
