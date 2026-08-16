/**
 * scripts/flush-outbox.mjs
 *
 * Delivers whatever is still sitting in `emailOutbox`.
 *
 * Anything the SMTP account could not take at the time — the budget was spent,
 * Gmail was throttling, the box was unreachable — stays as a pending row with a
 * retry time. The running app drains those on its own whenever it next sends
 * something, but a quiet night means nothing triggers it. This is the manual
 * nudge, and the thing to run the morning after the budget resets.
 *
 * ─── How to run ──────────────────────────────────────────────────────────────
 *
 *   node scripts/flush-outbox.mjs            # deliver everything due
 *   node scripts/flush-outbox.mjs --status   # just report, send nothing
 *
 * Rows whose retry time has not arrived yet are left alone; run it again later.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { loadEnvLocal } from './_env.mjs'

loadEnvLocal()

const statusOnly = process.argv.includes('--status')

if (!process.env.MONGODB_URI) { console.error('❌  MONGODB_URI is not set'); process.exit(1) }
if (!process.env.MONGODB_DB)  { console.error('❌  MONGODB_DB is not set');  process.exit(1) }

const { flushOutbox, quotaSnapshot, outboxSummary } = await import('../lib/email/index.js')
const { clientPromise } = await import('../lib/db.js')

const before = await outboxSummary()
const budget = await quotaSnapshot()

console.log('\n📬  Outbox')
console.log(`    by status : ${JSON.stringify(before.byStatus)}`)
if (Object.keys(before.pendingByKind).length > 0) {
  console.log(`    undelivered by kind : ${JSON.stringify(before.pendingByKind)}`)
}
console.log(`\n📊  SMTP budget for ${budget.day}`)
console.log(`    ${budget.used}/${budget.limit} used · ${budget.remaining} left`)
console.log(`    ${budget.throttledRemaining} of those are available to OTPs and announcements`)
console.log(`    (the last ${budget.reserve} are held back for application confirmations)`)

if (statusOnly) {
  console.log('\n    --status — nothing sent.\n')
} else if ((before.byStatus.pending ?? 0) === 0) {
  console.log('\n✅  Nothing pending.\n')
} else {
  console.log(`\n🚚  Draining ${before.byStatus.pending} pending message(s)…\n`)
  const result = await flushOutbox()
  console.log(`\n    sent     : ${result.sent}`)
  console.log(`    deferred : ${result.deferred}  (budget — parked until IST midnight)`)
  console.log(`    failed   : ${result.failed}`)
  if (result.stopped === 'quota') {
    console.log('\n⛔  Stopped: the daily SMTP budget is spent. Try again after IST midnight.')
  }

  const after = await outboxSummary()
  console.log(`\n📬  Now: ${JSON.stringify(after.byStatus)}`)
  if ((after.byStatus.failed ?? 0) > 0) {
    console.log('    Rows marked "failed" gave a permanent error (bad address, rejected sender).')
    console.log('    Inspect them with: db.emailOutbox.find({ status: "failed" })')
  }
  console.log('')
}

const client = await clientPromise
await client.close()
