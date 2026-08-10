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
 *   scope: 'admin'      → /admin/login — ADMIN_PASSWORD, or a `users` document
 *                                        with role admin/domain_lead
 *
 * The scope matters: without it, submitting ADMIN_PASSWORD into the candidate
 * form would mint an admin session. Candidate sign-in can never return an
 * elevated role.
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

export const SCOPES = Object.freeze({ CANDIDATE: 'candidate', ADMIN: 'admin' })

const DRIVE_ID = process.env.DRIVE_ID ?? '2026'

/**
 * Admin portal sign-in.
 * Accepts the shared ADMIN_PASSWORD, or a staff account stored in `users`.
 */
async function authorizeStaff(email, password) {
  const adminPassword = process.env.ADMIN_PASSWORD

  if (adminPassword && password === adminPassword) {
    const normalized = email?.toLowerCase().trim()
    return {
      id:      'admin',
      name:    'Administrator',
      email:   normalized && normalized.includes('@') ? normalized : 'admin@dbug.local',
      role:    ROLES.ADMIN,
      domains: [],
    }
  }

  if (!email) return null

  const users = await getCollection('users')
  const staff = await users.findOne({
    email: email.toLowerCase().trim(),
    role:  { $in: [ROLES.ADMIN, ROLES.DOMAIN_LEAD] },
  })

  if (!staff?.passwordHash) return null
  if (!(await bcrypt.compare(password, staff.passwordHash))) return null

  await users.updateOne(
    { _id: staff._id },
    { $set: { lastLoginAt: new Date(), updatedAt: new Date() } }
  )

  return {
    id:      staff._id.toString(),
    name:    staff.name ?? staff.email,
    email:   staff.email,
    role:    staff.role,
    domains: staff.domains ?? [],
  }
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
          if (scope === SCOPES.ADMIN) {
            return await authorizeStaff(email, password)
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
