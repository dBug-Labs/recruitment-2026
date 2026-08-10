/**
 * scripts/send-test-email.mjs
 *
 * Sends one real email through the configured SMTP account so a template can be
 * checked in an actual inbox. Ignores EMAIL_DRY_RUN on purpose — that is the
 * whole point of this script.
 *
 * ─── How to run ──────────────────────────────────────────────────────────────
 *
 *   node scripts/send-test-email.mjs you@example.com
 *   node scripts/send-test-email.mjs you@example.com --template task
 *
 * Templates: confirmation (default) · otp · task · shortlist · interview · result
 *
 * Requires SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / EMAIL_FROM in
 * .env.local. Nothing is written to the database.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createRequire } from 'module'
import { loadEnvLocal } from './_env.mjs'

loadEnvLocal()

// The email module reads DRY_RUN at import time, so force a real send first.
process.env.EMAIL_DRY_RUN = 'false'

const require = createRequire(import.meta.url)
const nodemailer = require('nodemailer')

const to = process.argv[2]
const templateArg = process.argv.indexOf('--template')
const template = templateArg !== -1 ? process.argv[templateArg + 1] : 'confirmation'

if (!to || !to.includes('@')) {
  console.error('❌  Pass a recipient:  node scripts/send-test-email.mjs you@example.com')
  process.exit(1)
}

for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']) {
  if (!process.env[key]) {
    console.error(`❌  ${key} is not set in .env.local`)
    process.exit(1)
  }
}

const { sendApplicationConfirmation, sendTaskNotification, sendInterviewShortlist,
        sendInterviewInvitation, sendResultNotification, sendOtp,
        sendDeadlineExtended } = await import('../lib/email/index.js')

const days = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000)
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

const TEMPLATES = {
  confirmation: () => sendApplicationConfirmation({
    name: 'Shaurya',
    email: to,
    applicantId: 'BND-427',
    domains: ['Web Development', 'AI / ML'],
    password: '48213',
    dueAt: days(5),
  }),
  task: () => sendTaskNotification({
    name: 'Shaurya',
    email: to,
    taskTitle: 'Build a responsive recruitment landing page',
    dueAt: days(5),
    dashboardUrl: `${baseUrl}/dashboard/tasks`,
  }),
  otp: () => sendOtp({ email: to, otp: '369202' }),
  extended: () => sendDeadlineExtended({
    name: 'Shaurya',
    email: to,
    taskTitle: 'Build a responsive recruitment landing page',
    dueAt: days(3),
    dashboardUrl: `${baseUrl}/dashboard/tasks`,
  }),
  shortlist: () => sendInterviewShortlist({ name: 'Shaurya', email: to }),
  interview: () => sendInterviewInvitation({
    name: 'Shaurya',
    email: to,
    slotAt: days(3),
    mode: 'online',
    location: 'https://meet.google.com/dbug-interview',
  }),
  result: () => sendResultNotification({ name: 'Shaurya', email: to, selected: true }),
}

if (!TEMPLATES[template]) {
  console.error(`❌  Unknown template "${template}". Options: ${Object.keys(TEMPLATES).join(', ')}`)
  process.exit(1)
}

console.log(`\n📮  Sending "${template}" to ${to}`)
console.log(`    via ${process.env.SMTP_HOST}:${process.env.SMTP_PORT} as ${process.env.SMTP_USER}`)

// Verify the connection first so credential problems give a clear error.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_PORT === '465',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})

try {
  await transporter.verify()
  console.log('✅  SMTP connection and credentials OK')
} catch (err) {
  console.error('❌  SMTP verify failed:', err.message)
  process.exit(1)
}

try {
  const info = await TEMPLATES[template]()
  console.log(`✅  Sent. Message id: ${info?.messageId ?? '(none returned)'}`)
  if (info?.accepted?.length) console.log(`    accepted: ${info.accepted.join(', ')}`)
  if (info?.rejected?.length) console.log(`    rejected: ${info.rejected.join(', ')}`)
  console.log('\n    Check the inbox (and the spam folder).\n')
} catch (err) {
  console.error('❌  Send failed:', err.message)
  process.exit(1)
}
