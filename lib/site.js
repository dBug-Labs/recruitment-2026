/**
 * lib/site.js
 *
 * Single source of truth for everything SEO needs to know about the site:
 * the canonical origin, the brand strings and the list of indexable routes.
 *
 * The origin comes from `NEXT_PUBLIC_SITE_URL` because canonical tags, OG
 * image URLs, robots.txt and sitemap.xml all need a fully-qualified URL that
 * the app cannot infer at build time. Set it once per environment:
 *
 *   NEXT_PUBLIC_SITE_URL=https://your-domain.com
 *
 * On Vercel we fall back to the deployment URL so previews still emit valid
 * absolute URLs, and to localhost in dev so `next build` never breaks.
 */

function resolveSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/+$/, '')

  // Vercel injects this for every deployment (no protocol).
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`

  return 'http://localhost:3000'
}

export const SITE_URL = resolveSiteUrl()

/** True only on the real production domain — previews and dev stay unindexed. */
export const IS_INDEXABLE =
  process.env.NODE_ENV === 'production' &&
  Boolean(process.env.NEXT_PUBLIC_SITE_URL) &&
  process.env.VERCEL_ENV !== 'preview'

export const SITE_NAME = 'dBug Labs'

export const SITE_TAGLINE = 'Brand New Day — Recruitments 2026'

export const SITE_DESCRIPTION =
  'dBug Labs Recruitments 2026 at SRM are open. Apply to ten domains across tech and corporate, ' +
  'get your task brief instantly, and track every stage — application, task, shortlist, interview, result.'

/**
 * Public, indexable routes. Everything else (dashboard, admin, API) is
 * behind auth and is explicitly excluded in app/robots.js.
 */
export const PUBLIC_ROUTES = [
  { path: '/', priority: 1.0, changeFrequency: 'daily' },
  { path: '/apply', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/fit', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/login', priority: 0.3, changeFrequency: 'monthly' },
]

/** Routes that must never reach an index, in robots.txt and meta tags alike. */
export const PRIVATE_PATHS = ['/admin', '/dashboard', '/api']

export const absoluteUrl = (path = '/') => new URL(path, SITE_URL).toString()
