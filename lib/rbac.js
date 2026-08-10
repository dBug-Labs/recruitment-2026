/**
 * lib/rbac.js
 *
 * Role-Based Access Control helpers.
 *
 * All protected route handlers call these guards at the top of the function.
 * They throw a Response (or a plain Error) that the caller returns immediately.
 *
 * Usage in a route handler:
 *   import { requireRole, ROLES } from '@/lib/rbac'
 *   export async function GET(request) {
 *     const session = await getServerSession()
 *     requireRole(session, ROLES.ADMIN)
 *     // ... proceed
 *   }
 */

export const ROLES = Object.freeze({
  CANDIDATE:   'candidate',
  DOMAIN_LEAD: 'domain_lead',
  ADMIN:       'admin',
})

/** Role hierarchy — higher index = more privileged */
const ROLE_RANK = {
  [ROLES.CANDIDATE]:   0,
  [ROLES.DOMAIN_LEAD]: 1,
  [ROLES.ADMIN]:       2,
}

/**
 * Asserts a valid, authenticated session exists.
 * Returns the session user object for convenience.
 *
 * @param {object|null} session — the Auth.js session object
 * @throws {Response} 401 if no session
 */
export function requireAuth(session) {
  if (!session?.user) {
    throw unauthorizedResponse('Authentication required')
  }
  return session.user
}

/**
 * Asserts the session user holds at least the specified role.
 *
 * @param {object|null} session
 * @param {string} requiredRole — one of ROLES.*
 * @throws {Response} 401 if unauthenticated, 403 if insufficient role
 */
export function requireRole(session, requiredRole) {
  const user = requireAuth(session)
  const userRank = ROLE_RANK[user.role] ?? -1
  const reqRank  = ROLE_RANK[requiredRole] ?? 999
  if (userRank < reqRank) {
    throw forbiddenResponse(`Requires role: ${requiredRole}`)
  }
  return user
}

/**
 * Asserts the session user is an admin.
 * Shorthand for requireRole(session, ROLES.ADMIN).
 */
export function requireAdmin(session) {
  return requireRole(session, ROLES.ADMIN)
}

/** True when the user may see the admin panel at all. */
export function isStaff(user) {
  return user?.role === ROLES.ADMIN || user?.role === ROLES.DOMAIN_LEAD
}

/**
 * Asserts the session user is an admin OR a domain lead.
 * Use this for panel-wide guards; use requireDomainAccess for per-domain ones.
 */
export function requireStaff(session) {
  const user = requireAuth(session)
  if (!isStaff(user)) {
    throw forbiddenResponse('Admin or domain lead access required')
  }
  return user
}

/**
 * True when the user may act on a record touching any of `keys`.
 * Admins always may; domain leads only within their own domains.
 *
 * @param {object} user
 * @param {string[]} keys — domain *keys* (e.g. ['web', 'aiml'])
 */
export function hasDomainAccess(user, keys = []) {
  if (user?.role === ROLES.ADMIN) return true
  if (user?.role !== ROLES.DOMAIN_LEAD) return false
  const owned = Array.isArray(user.domains) ? user.domains : []
  return keys.some((k) => owned.includes(k))
}

/**
 * The identity recorded on documents this user creates.
 * The env-password admin has no `users` row, so its id is the literal string
 * 'admin' — never feed it to `new ObjectId()`.
 */
export function actorRef(user) {
  return { id: user?.id ?? 'unknown', email: user?.email ?? 'unknown' }
}

/**
 * Asserts the session user is an admin OR a domain lead whose assigned domains
 * include the given domain slug.
 *
 * @param {object|null} session
 * @param {string} domain — domain slug (e.g. 'web', 'aiml')
 */
export function requireDomainAccess(session, domain) {
  const user = requireAuth(session)
  if (user.role === ROLES.ADMIN) return user
  if (user.role === ROLES.DOMAIN_LEAD && Array.isArray(user.domains) && user.domains.includes(domain)) {
    return user
  }
  throw forbiddenResponse(`Access to domain "${domain}" is not permitted for your account`)
}

/**
 * Asserts the session user is the owner of an application OR an admin/lead.
 *
 * @param {object|null} session
 * @param {string} applicationId — the application's _id as string
 * @param {string} ownerApplicationId — the _id of the candidate's own application
 */
export function requireOwnerOrAdmin(session, applicationId, ownerApplicationId) {
  const user = requireAuth(session)
  if (user.role === ROLES.ADMIN || user.role === ROLES.DOMAIN_LEAD) return user
  if (user.applicationId?.toString() === applicationId) return user
  throw forbiddenResponse('You are not authorized to access this resource')
}

// ─── Response helpers ─────────────────────────────────────────────────────────

function unauthorizedResponse(message = 'Unauthorized') {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

function forbiddenResponse(message = 'Forbidden') {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Wraps a route handler so that thrown Responses are returned directly
 * and all other errors become 500s.
 *
 * Usage:
 *   export const GET = withErrorHandling(async (request) => { ... })
 */
export function withErrorHandling(handler) {
  return async function wrappedHandler(...args) {
    try {
      return await handler(...args)
    } catch (err) {
      if (err instanceof Response) return err
      console.error('[route error]', err)
      return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }
}
