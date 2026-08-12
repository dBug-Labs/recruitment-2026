/**
 * scripts/seed-admins.mjs
 *
 * Creates or upgrades staff accounts listed in ADMIN_BOOTSTRAP_EMAILS.
 *
 * These accounts sign in at /admin/login with their own password, which is why
 * a password is required here — a users row without `passwordHash` can never
 * authenticate. (The shared ADMIN_PASSWORD from .env.local still works as a
 * break-glass login and needs no row at all.)
 *
 * /admin/login asks for a password and nothing else, so the password is what
 * identifies the account. Two accounts sharing one password would be
 * indistinguishable at sign-in, so this script seeds one account per run and
 * refuses a password that is already in use.
 *
 * Usage:
 *   node scripts/seed-admins.mjs --password "some-strong-password"
 *   node scripts/seed-admins.mjs --password "..." --role domain_lead --domains web,aiml
 */

import { createRequire } from 'module'
import { loadEnvLocal } from './_env.mjs'

loadEnvLocal()

const require = createRequire(import.meta.url)
const { MongoClient } = require('mongodb')
const bcrypt = require('bcryptjs')

const VALID_ROLES = ['admin', 'domain_lead']

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 ? process.argv[i + 1] : undefined
}

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('❌  MONGODB_URI is not set.')
    process.exit(1)
  }

  const emailsStr = process.env.ADMIN_BOOTSTRAP_EMAILS
  if (!emailsStr) {
    console.error('❌  ADMIN_BOOTSTRAP_EMAILS is not set. Use a comma-separated list of emails.')
    process.exit(1)
  }

  const emails = emailsStr.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  if (emails.length === 0) {
    console.error('❌  No valid emails found in ADMIN_BOOTSTRAP_EMAILS.')
    process.exit(1)
  }

  if (emails.length > 1) {
    console.error(
      `❌  ADMIN_BOOTSTRAP_EMAILS lists ${emails.length} emails, but sign-in is by password alone —\n` +
      '    every account needs its own. Set one email at a time and re-run with a different --password.'
    )
    process.exit(1)
  }

  const password = arg('password')
  if (!password || password.length < 8) {
    console.error('❌  Pass --password with at least 8 characters, e.g.\n    node scripts/seed-admins.mjs --password "correct-horse-battery"')
    process.exit(1)
  }

  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
    console.error('❌  That is the shared ADMIN_PASSWORD. A staff account needs a password of its own.')
    process.exit(1)
  }

  const role = arg('role') ?? 'admin'
  if (!VALID_ROLES.includes(role)) {
    console.error(`❌  --role must be one of: ${VALID_ROLES.join(', ')}`)
    process.exit(1)
  }

  const domains = (arg('domains') ?? '').split(',').map((d) => d.trim()).filter(Boolean)
  if (role === 'domain_lead' && domains.length === 0) {
    console.error('❌  A domain_lead needs --domains, e.g. --domains web,aiml')
    process.exit(1)
  }

  console.log('Connecting to MongoDB…')
  const client = new MongoClient(uri)
  await client.connect()
  const users = client.db(process.env.MONGODB_DB).collection('users')

  // A password already belonging to someone else would make the two accounts
  // indistinguishable at /admin/login, where the password is the only input.
  const others = await users
    .find({ role: { $in: VALID_ROLES }, passwordHash: { $exists: true, $ne: null } })
    .toArray()

  for (const other of others) {
    if (emails.includes(other.email)) continue
    if (await bcrypt.compare(password, other.passwordHash)) {
      console.error(`❌  ${other.email} already signs in with that password. Pick a different one.`)
      await client.close()
      process.exit(1)
    }
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const now = new Date()

  for (const email of emails) {
    const result = await users.updateOne(
      { email },
      {
        $set: { email, role, domains, passwordHash, updatedAt: now },
        $setOnInsert: { name: email.split('@')[0], createdAt: now },
      },
      { upsert: true }
    )
    const verb = result.upsertedCount ? '✨ created' : '🆙 updated'
    console.log(`${verb} ${email} as ${role}${domains.length ? ` (${domains.join(', ')})` : ''}`)
  }

  await client.close()
  console.log('\nDone. Sign in at /admin/login with the password you passed — that page asks for nothing else.')
}

run().catch((err) => {
  console.error('❌  seed-admins failed:', err)
  process.exit(1)
})
