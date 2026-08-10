/**
 * app/api/auth/[...nextauth]/route.js
 *
 * Auth.js v5 catch-all route handler.
 * Handles all OAuth callbacks, sign-in, sign-out, and session endpoints.
 *
 * Routes handled:
 *  GET  /api/auth/providers
 *  GET  /api/auth/session
 *  GET  /api/auth/csrf
 *  GET  /api/auth/callback/credentials
 *  POST /api/auth/signin/credentials
 *  POST /api/auth/signout
 */

import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
