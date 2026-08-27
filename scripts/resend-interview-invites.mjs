/**
 * scripts/resend-interview-invites.mjs
 *
 * Emails the slot to every candidate whose interview was scheduled but never
 * actually told about it.
 *
 * ─── Why any interview is in that state ──────────────────────────────────────
 *
 * POST /api/admin/interviews used to fire the invitation and not wait for it:
 *
 *     sendInterviewInvitation({ … }).catch(err => console.error(err))
 *
 * That reads as "a mail failure must not lose the scheduled interview", and on
 * a long-lived server it would be exactly that. On serverless the function is
 * frozen the instant the response is returned, so the detached promise was
 * killed part-way through — often before the outbox row was even written. The
 * interview was saved, the panel said "Interview Scheduled", and nothing left
 * the building. The route now awaits the send and stamps `invitedAt`; this
 * script cleans up everything scheduled before that.
 *
 * A row that made it into `emailOutbox` is `npm run flush-outbox`'s job. This
 * one is for interviews with no row at all, which is why it re-renders the
 * message from the interview document rather than looking for a queued copy.
 *
 * ─── How to run ──────────────────────────────────────────────────────────────
 *
 *   node scripts/resend-interview-invites.mjs --dry-run   # list, send nothing
 *   node scripts/resend-interview-invites.mjs             # send them
 *   node scripts/resend-interview-invites.mjs --only ab1234@srmist.edu.in
 *   node scripts/resend-interview-invites.mjs --limit 20
 *   node scripts/resend-interview-invites.mjs --force     # re-send already-invited
 *   node scripts/resend-interview-invites.mjs --past      # include past slots
 *
 * ─── --group-only ────────────────────────────────────────────────────────────
 *
 *   node scripts/resend-interview-invites.mjs --group-only
 *
 * Sends the WhatsApp group link on its own instead of the full invitation, for
 * candidates whose invite went out before the link was added to the template.
 * Repeating the whole invitation would read as a duplicate and prompt the one
 * question it must not — "has my slot moved?" — so that mail confirms the slot
 * and asks for one thing. It is also how to reach everyone if the WhatsApp
 * invite is ever rotated mid-drive: --group-only --force.
 *
 * The two modes keep separate stamps (`invitedAt`, `groupInviteAt`), so
 * neither can be mistaken for the other on a re-run.
 *
 * Safe to re-run: the stamp is written on success, so a run stopped by the
 * daily SMTP budget picks up exactly where it left off.
 *
 * Interviews whose slot has already gone are skipped by default — mailing
 * someone about an interview that was yesterday helps nobody. Pass --past if
 * you are backfilling records deliberately.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createRequire } from 'module'
import { loadEnvLocal } from './_env.mjs'

loadEnvLocal()

const require = createRequire(import.meta.url)
const { MongoClient } = require('mongodb')

// Sends are inline by default, so a failure is something this script can see
// and react to rather than a background pump the process exits out from under.
const { sendInterviewInvitation, sendInterviewGroupInvite, quotaSnapshot, outboxSummary } =
  await import('../lib/email/index.js')
const { clientPromise: libClientPromise } = await import('../lib/db.js')

// ─── Arguments ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const has  = (flag) => argv.includes(flag)
const val  = (flag) => {
  const i = argv.indexOf(flag)
  return i !== -1 ? argv[i + 1] : undefined
}

const DRY_RUN    = has('--dry-run')
const FORCE      = has('--force')
const PAST       = has('--past')
const GROUP_ONLY = has('--group-only')
const ONLY       = val('--only')?.toLowerCase()
const LIMIT      = Number(val('--limit')) || 0

/** What the run sends, and the stamp that says it already did. */
const MODE = GROUP_ONLY
  ? { label: 'WhatsApp group link', stamp: 'groupInviteAt', errField: 'groupInviteError' }
  : { label: 'interview invitation', stamp: 'invitedAt',    errField: 'inviteError'      }

const uri      = process.env.MONGODB_URI
const dbName   = process.env.MONGODB_DB
const DRIVE_ID = process.env.DRIVE_ID ?? '2026'

if (!uri)    { console.error('❌  MONGODB_URI is not set'); process.exit(1) }
if (!dbName) { console.error('❌  MONGODB_DB is not set');  process.exit(1) }

if (process.env.EMAIL_DRY_RUN === 'true' && !DRY_RUN) {
  console.warn('⚠️   EMAIL_DRY_RUN=true — messages will be logged, not delivered.')
  console.warn('    Set EMAIL_DRY_RUN=false in .env.local for a real run.\n')
}

const istStr = (d) =>
  new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' })

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔌  Connecting to ${dbName}…`)
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  const interviewsCol = db.collection('interviews')

  const match = { driveId: DRIVE_ID, status: 'scheduled' }
  // Neither stamp existed before this fix, so "missing" and "null" both mean
  // the same thing: nobody was told.
  if (!FORCE) match[MODE.stamp] = { $in: [null, undefined] }
  if (!PAST)  match.slotAt = { $gte: new Date() }

  const rows = await interviewsCol
    .aggregate([
      { $match: match },
      { $sort: { slotAt: 1 } },
      { $lookup: { from: 'applications', localField: 'applicationId', foreignField: '_id', as: 'application' } },
      { $unwind: { path: '$application', preserveNullAndEmptyArrays: true } },
    ])
    .toArray()

  const filtered = ONLY
    ? rows.filter((r) => r.application?.srmEmail?.toLowerCase() === ONLY)
    : rows
  const batch = LIMIT > 0 ? filtered.slice(0, LIMIT) : filtered

  console.log(`✅  Connected. Drive "${DRIVE_ID}".`)
  console.log(`\n✉️   Sending: ${MODE.label}`)
  console.log(`📋  ${batch.length} interview(s) still owed one${LIMIT > 0 ? ` (capped at ${LIMIT})` : ''}.`)
  if (!PAST) console.log('⏭️   Past slots skipped — pass --past to include them.')
  if (FORCE) console.log(`🔁  --force — interviews already carrying ${MODE.stamp} are included too.`)
  if (DRY_RUN) console.log('🧪  DRY RUN — nothing will be written or sent.')

  if (batch.length === 0) {
    console.log('\n   Nothing to do.\n')
    await client.close()
    await (await libClientPromise).close()
    return
  }

  const stats = { sent: 0, queued: 0, failed: 0, skipped: 0, orphaned: 0 }
  let budgetSpent = false

  console.log('')
  for (const iv of batch) {
    const app = iv.application
    const who = app?.srmEmail ?? '(no application)'
    const label = `${(app?.name ?? 'Unknown').padEnd(22)} ${who.padEnd(28)} ${istStr(iv.slotAt)}`

    if (!app?.srmEmail) {
      // The application was deleted out from under the interview. Nothing to
      // send to, and inventing an address would be worse than saying so.
      console.log(`   ⚠️   ${label}  — orphaned interview, no candidate to mail`)
      stats.orphaned++
      continue
    }

    if (budgetSpent) { stats.skipped++; continue }

    if (DRY_RUN) {
      console.log(`   🧪  ${label}`)
      stats.sent++
      continue
    }

    try {
      if (GROUP_ONLY) {
        await sendInterviewGroupInvite({
          name:   app.name,
          email:  app.srmEmail,
          slotAt: iv.slotAt,
        })
      } else {
        await sendInterviewInvitation({
          name:     app.name,
          email:    app.srmEmail,
          slotAt:   iv.slotAt,
          mode:     iv.mode,
          location: iv.location,
        })
      }
      await interviewsCol.updateOne(
        { _id: iv._id },
        { $set: { [MODE.stamp]: new Date(), [MODE.errField]: null, updatedAt: new Date() } }
      )
      console.log(`   ✅  ${label}`)
      stats.sent++
    } catch (err) {
      // A `pending` row is already written and will go out on the next flush,
      // so the candidate is still going to hear from us — that is not a failure
      // to report as one. The stamp stays unset so a re-run confirms it.
      if (err.outboxStatus === 'pending') {
        console.log(`   📮  ${label}  — queued for retry (${err.message})`)
        stats.queued++
      } else {
        console.log(`   ❌  ${label}  — ${err.message}`)
        stats.failed++
        await interviewsCol.updateOne(
          { _id: iv._id },
          { $set: { [MODE.errField]: err.message, updatedAt: new Date() } }
        )
      }
      if (err.code === 'EMAIL_QUOTA') {
        budgetSpent = true
        console.log('\n⛔  Daily SMTP budget spent — stopping here. Re-run after IST midnight.\n')
      }
    }
  }

  console.log('\n📊  Summary')
  console.log(`   invitations sent : ${stats.sent}${DRY_RUN ? ' (dry run)' : ''}`)
  console.log(`   queued for retry : ${stats.queued}`)
  console.log(`   failed           : ${stats.failed}`)
  console.log(`   orphaned         : ${stats.orphaned}`)
  console.log(`   not reached      : ${stats.skipped}`)

  if (!DRY_RUN) {
    const [budget, outbox] = await Promise.all([quotaSnapshot(), outboxSummary()])
    console.log(`\n   SMTP budget : ${budget.used}/${budget.limit} used today, ${budget.remaining} left`)
    console.log(`   outbox      : ${JSON.stringify(outbox.byStatus)}`)
    if ((outbox.byStatus.pending ?? 0) > 0) {
      console.log('   → run `npm run flush-outbox` to deliver the rest')
    }
  }
  console.log('')

  await client.close()
  await (await libClientPromise).close()
}

main().catch(async (err) => {
  console.error('\n❌  Resend failed:', err)
  await (await libClientPromise).close().catch(() => {})
  process.exit(1)
})
