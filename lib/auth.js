/**
 * lib/auth.js
 *
 * Authentication configuration using Auth.js v5 (next-auth@beta).
 *
 * One Credentials provider serves two separate portals, told apart by the
 * `scope` field the sign-in form submits:
 *
 *   scope: 'candidate'  → /login       — SRM email / personal email / reg. no.
 *                                        + the password mailed on application
 *   scope: 'admin'      → /admin/login — password only: ADMIN_PASSWORD, or the
 *                                        password of a `users` document with
 *                                        role admin/domain_lead
 *
 * The scope matters: without it, submitting ADMIN_PASSWORD into the candidate
 * form would mint an admin session. Candidate sign-in can never return an
 * elevated role.
 *
 * Staff passwords must be unique per account — the password is what tells the
 * accounts apart now that /admin/login asks for no email. scripts/seed-admins
 * enforces that when it creates them.
 *
 * Setup:
 *  1. Add AUTH_SECRET to .env.local  (npx auth secret)
 *  2. Add ADMIN_PASSWORD to .env.local
 */

import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { getCollection } from './db.js'
import { ROLES }         from './rbac.js'
import bcrypt            from 'bcryptjs'
import { timingSafeEqual } from 'node:crypto'

export const SCOPES = Object.freeze({ CANDIDATE: 'candidate', ADMIN: 'admin' })

const DRIVE_ID = process.env.DRIVE_ID ?? '2026'

/** Length-safe, timing-safe string comparison for the shared admin password. */
function secretsMatch(a, b) {
  const left  = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Admin portal sign-in — password only, no email.
 *
 * Accepts the shared ADMIN_PASSWORD, or a staff account stored in `users`.
 * Since the form asks for nothing but a password, the password has to identify
 * the account too: we compare it against every staff hash and take the one
 * that matches. The staff list is a handful of people, and seed-admins.mjs
 * refuses to hand two accounts the same password, so at most one can match.
 */
async function authorizeStaff(password) {
  const adminPassword = process.env.ADMIN_PASSWORD

  if (adminPassword && secretsMatch(password, adminPassword)) {
    return {
      id:      'admin',
      name:    'Administrator',
      email:   'admin@dbug.local',
      role:    ROLES.ADMIN,
      domains: [],
    }
  }

  const users = await getCollection('users')
  const staff = await users
    .find({
      role:         { $in: [ROLES.ADMIN, ROLES.DOMAIN_LEAD] },
      passwordHash: { $exists: true, $ne: null },
    })
    .sort({ createdAt: 1 })
    .toArray()

  for (const account of staff) {
    if (!(await bcrypt.compare(password, account.passwordHash))) continue

    await users.updateOne(
      { _id: account._id },
      { $set: { lastLoginAt: new Date(), updatedAt: new Date() } }
    )

    return {
      id:      account._id.toString(),
      name:    account.name ?? account.email,
      email:   account.email,
      role:    account.role,
      domains: account.domains ?? [],
    }
  }

  return null
}

/**
 * Candidate portal sign-in — matches an application by SRM email, personal
 * email or registration number, then checks the mailed password.
 */
async function authorizeCandidate(email, password) {
  const identifier = email.trim()
  const applications = await getCollection('applications')

  const application = await applications.findOne({
    driveId: DRIVE_ID,
    $or: [
      { srmEmail:           identifier.toLowerCase() },
      { personalEmail:      identifier.toLowerCase() },
      { registrationNumber: identifier.toUpperCase() },
    ],
  })

  if (!application?.passwordHash) return null
  if (!(await bcrypt.compare(password, application.passwordHash))) return null

  const users = await getCollection('users')
  const now   = new Date()

  // upsert keeps this a single round trip and survives the unique email index
  await users.updateOne(
    { email: application.srmEmail },
    {
      $set: {
        name:          application.name,
        applicationId: application._id,
        role:          ROLES.CANDIDATE,
        provider:      'credentials',
        lastLoginAt:   now,
        updatedAt:     now,
      },
      $setOnInsert: { email: application.srmEmail, image: null, domains: [], createdAt: now },
    },
    { upsert: true }
  )

  const dbUser = await users.findOne({ email: application.srmEmail })

  return {
    id:            dbUser._id.toString(),
    name:          dbUser.name,
    email:         dbUser.email,
    role:          ROLES.CANDIDATE,
    domains:       dbUser.domains ?? [],
    applicationId: application._id.toString(),
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt' },
  trustHost: true,

  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email:    { label: 'Email or SRM ID', type: 'text' },
        password: { label: 'Password',        type: 'password' },
        scope:    { label: 'Scope',           type: 'text' },
      },
      async authorize(credentials) {
        const email    = credentials?.email?.toString() ?? ''
        const password = credentials?.password?.toString() ?? ''
        const scope    = credentials?.scope?.toString() ?? SCOPES.CANDIDATE

        if (!password) return null

        try {
          // The admin form submits no email at all — the password is the
          // entire credential, so anything sent in `email` is ignored here.
          if (scope === SCOPES.ADMIN) {
            return await authorizeStaff(password)
          }
          if (!email) return null
          return await authorizeCandidate(email, password)
        } catch (err) {
          console.error('[auth] authorize error:', err)
          return null
        }
      },
    }),
  ],

  callbacks: {
    /**
     * Adds role, applicationId, and userId to the JWT token.
     */
    async jwt({ token, user }) {
      // user object is only passed in on the initial sign-in
      if (user) {
        token.id            = user.id
        token.role          = user.role
        token.domains       = user.domains || []
        token.applicationId = user.applicationId || null
      }
      return token
    },

    /**
     * Exposes custom token fields on the session object.
     */
    async session({ session, token }) {
      if (token) {
        session.user.id            = token.id
        session.user.role          = token.role
        session.user.domains       = token.domains
        session.user.applicationId = token.applicationId
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',
  },
})
