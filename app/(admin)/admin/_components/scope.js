/**
 * Query scoping for the admin panel.
 *
 * Admins see the whole drive; domain leads only ever see records touching a
 * domain they own. Every panel page builds its Mongo filter through here so a
 * single missed check can't leak another domain's candidates.
 */

import { ROLES } from '@/lib/rbac'

export const DRIVE_ID = process.env.DRIVE_ID ?? '2026'

/** Filter for the `applications` collection. */
export function applicationScope(user, extra = {}) {
  const query = { driveId: DRIVE_ID, ...extra }
  if (user?.role === ROLES.DOMAIN_LEAD) {
    query.domainKeys = { $in: user.domains ?? [] }
  }
  return query
}

/** Filter for collections keyed by a single `domain` field (tasks, assignments). */
export function domainScope(user, extra = {}) {
  const query = { driveId: DRIVE_ID, ...extra }
  if (user?.role === ROLES.DOMAIN_LEAD) {
    query.domain = { $in: user.domains ?? [] }
  }
  return query
}

/** The domain keys this user may pick from in forms. */
export function allowedDomains(user, allKeys) {
  if (user?.role === ROLES.DOMAIN_LEAD) {
    return allKeys.filter((k) => (user.domains ?? []).includes(k))
  }
  return allKeys
}
