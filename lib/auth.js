/**
 * lib/auth.js
 *
 * Authentication configuration using Auth.js v5 (next-auth@beta).
 *
 * Supported providers:
 *  - Credentials (Admin password, Candidate email + personal password)
 *
 * Setup:
 *  1. Add AUTH_SECRET to .env.local
 *  2. Add ADMIN_PASSWORD to .env.local
 */

import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { getCollection } from './db.js'
import { ROLES }         from './rbac.js'
import bcrypt            from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt' },

  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email or SRM ID', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const { email, password } = credentials

        // Admin Auth
        if (password === process.env.ADMIN_PASSWORD) {
          // If they just entered the admin password (with or without email)
          return {
            id: 'admin',
            name: 'Admin',
            email: 'admin@dbug.local',
            role: ROLES.ADMIN,
          }
        }

        // Candidate Auth
        if (email && password) {
          const emailLower = email.toLowerCase().trim()
          const emailUpper = email.toUpperCase().trim()
          try {
            const applications = await getCollection('applications')
            const application = await applications.findOne({
              $or: [
                { srmEmail: emailLower },
                { personalEmail: emailLower },
                { registrationNumber: emailUpper }
              ],
              driveId: process.env.DRIVE_ID ?? '2026',
            })

            if (!application || !application.passwordHash) {
              return null
            }

            const isValid = await bcrypt.compare(password, application.passwordHash)
            if (!isValid) {
              return null
            }

            const users = await getCollection('users')
            
            // Find existing user or create new one
            let dbUser = await users.findOne({ email: application.srmEmail })

            if (!dbUser) {
              const result = await users.insertOne({
                email:         application.srmEmail,
                name:          application.name,
                image:         null,
                applicationId: application._id,
                role:          ROLES.CANDIDATE,
                domains:       [],
                provider:      'credentials',
                lastLoginAt:   new Date(),
                createdAt:     new Date(),
                updatedAt:     new Date(),
              })
              
              dbUser = await users.findOne({ _id: result.insertedId })
            } else {
              await users.updateOne(
                { _id: dbUser._id },
                {
                  $set: {
                    lastLoginAt: new Date(),
                    updatedAt:   new Date(),
                  },
                }
              )
            }

            return {
              id: dbUser._id.toString(),
              name: dbUser.name,
              email: dbUser.email,
              role: dbUser.role,
              domains: dbUser.domains,
              applicationId: dbUser.applicationId?.toString() ?? null,
            }
          } catch (err) {
            console.error('[auth] credentials authorize error:', err)
            return null
          }
        }

        return null
      }
    })
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
