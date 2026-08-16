/**
 * scripts/resend-confirmations.mjs
 *
 * Puts everyone who already registered back on an even footing.
 *
 * For every application in the drive it will:
 *
 *   1. Assign the live task for *every* domain they picked, not just the first.
 *   2. Reset all of their deadlines to one shared moment: now + TASK_WINDOW_DAYS.
 *   3. Mint a fresh dashboard password and email them the "Application
 *      Received" mail carrying it, their applicant id and the new deadline.
 *
 * ─── Why the password is new ─────────────────────────────────────────────────
 *
 * Passwords are stored as bcrypt hashes; the plaintext exists only in the
 * confirmation email. For anyone whose confirmation was eaten by the SMTP
 * budget there is no plaintext left to resend, so the only honest fix is to
 * rotate. Everyone gets a new one and everyone gets told what it is — which
 * also means an old confirmation, if they did receive one, stops working.
 *
 * ─── Ordering, and what happens when the send fails ──────────────────────────
 *
 * The mail goes out *before* the new hash is written. If delivery fails
 * permanently the candidate keeps the password they already have; nothing is
 * quietly changed out from under them. If it fails in a way the outbox will
 * retry (SMTP down, budget spent) the row already holds the message, so the new
 * password is still on its way and the hash is committed to match.
 *
 * ─── How to run ──────────────────────────────────────────────────────────────
 *
 *   node scripts/resend-confirmations.mjs --dry-run      # say what it would do
 *   node scripts/resend-confirmations.mjs                # do it
 *   node scripts/resend-confirmations.mjs --limit 50     # first 50 only
 *   node scripts/resend-confirmations.mjs --only ab1234@srmist.edu.in
 *   node scripts/resend-confirmations.mjs --applicant BND-863
 *   node scripts/resend-confirmations.mjs --force        # include already-resent
 *   node scripts/resend-confirmations.mjs --days 7       # deadline window
 *   node scripts/resend-confirmations.mjs --skip-mail    # tasks + deadlines only
 *
 * Safe to re-run: an application is skipped once it carries confirmationResentAt,
 * so a run stopped by the daily SMTP budget picks up where it left off tomorrow.
 *
 * ─── Backfilling a task published later ──────────────────────────────────────
 *
 * A domain with no active task is skipped with a warning, and anyone who picked
 * it simply gets nothing for that half of their application. Once the task
 * exists, hand it out without disturbing anything already settled:
 *
 *   node scripts/resend-confirmations.mjs --force --skip-mail --keep-deadlines
 *
 * That assigns only what is missing, leaves every existing deadline alone, and
 * mails nobody. A brand-new assignment inherits the deadline the candidate is
 * already working to, so their two tasks stay due at the same moment.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createRequire } from 'module'
import { loadEnvLocal } from './_env.mjs'

loadEnvLocal()

const require = createRequire(import.meta.url)
const { MongoClient } = require('mongodb')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

// Sends are inline by default, so a failure is something this script can see
// and react to rather than a background pump the process exits out from under.
const { sendApplicationConfirmation, quotaSnapshot, outboxSummary } = await import('../lib/email/index.js')
const { domainKeys } = await import('../lib/schemas.js')
// The outbox opens its own pooled connection through lib/db.js. Held here so
// the script can close it and actually exit.
const { clientPromise: libClientPromise } = await import('../lib/db.js')

// ─── Arguments ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const has  = (flag) => argv.includes(flag)
const val  = (flag) => {
  const i = argv.indexOf(flag)
  return i !== -1 ? argv[i + 1] : undefined
}
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const DRY_RUN   = has('--dry-run')
const FORCE     = has('--force')
const SKIP_MAIL = has('--skip-mail')
const KEEP_DUE  = has('--keep-deadlines')
const ONLY      = val('--only')?.toLowerCase()
const APPLICANT = val('--applicant')?.trim()
const LIMIT     = Number(val('--limit')) || 0
const DAYS      = Number(val('--days')) || Number(process.env.TASK_WINDOW_DAYS ?? 5)

const uri     = process.env.MONGODB_URI
const dbName  = process.env.MONGODB_DB
const DRIVE_ID = process.env.DRIVE_ID ?? '2026'

if (!uri)    { console.error('❌  MONGODB_URI is not set'); process.exit(1) }
if (!dbName) { console.error('❌  MONGODB_DB is not set');  process.exit(1) }

if (process.env.EMAIL_DRY_RUN === 'true' && !DRY_RUN && !SKIP_MAIL) {
  console.warn('⚠️   EMAIL_DRY_RUN=true — messages will be logged, not delivered.')
  console.warn('    Set EMAIL_DRY_RUN=false in .env.local for a real run.\n')
}

// One deadline for the whole cohort, fixed before the first row is touched, so
// the last candidate processed gets exactly what the first one did.
const startedAt = new Date()
const DUE_AT    = new Date(startedAt.getTime() + DAYS * 24 * 60 * 60 * 1000)

const istStr = (d) => d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' })

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔌  Connecting to ${dbName}…`)
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  const apps        = db.collection('applications')
  const tasks       = db.collection('tasks')
  const assignments = db.collection('assignments')

  const filter = { driveId: DRIVE_ID }
  if (ONLY) filter.srmEmail = ONLY
  if (APPLICANT) filter.applicantId = new RegExp(`^${escapeRegExp(APPLICANT)}$`, 'i')
  if (!FORCE && !ONLY && !APPLICANT) filter.confirmationResentAt = { $exists: false }

  const candidates = await apps.find(filter).sort({ createdAt: 1 }).toArray()
  const batch = LIMIT > 0 ? candidates.slice(0, LIMIT) : candidates

  console.log(`✅  Connected. Drive "${DRIVE_ID}".`)
  console.log(`\n📋  ${batch.length} application(s) to process${LIMIT > 0 ? ` (capped at ${LIMIT})` : ''}.`)
  if (APPLICANT) {
    console.log(`🎯  Applicant filter: ${APPLICANT}`)
  }
  console.log(KEEP_DUE
    ? '📅  --keep-deadlines — existing deadlines left exactly as they are.'
    : `📅  New deadline for everyone: ${istStr(DUE_AT)}  (now + ${DAYS} days)`)
  if (DRY_RUN) console.log('🧪  DRY RUN — nothing will be written or sent.')

  if (batch.length === 0) {
    console.log('\n   Nothing to do. Pass --force to include applications already resent.\n')
    await client.close()
    return
  }

  // The live task for each domain, resolved once instead of per candidate.
  const activeTasks = await tasks
    .find({ driveId: DRIVE_ID, active: true })
    .sort({ createdAt: -1 })
    .toArray()
  const taskByDomain = new Map()
  for (const task of activeTasks) {
    if (!taskByDomain.has(task.domain)) taskByDomain.set(task.domain, task)
  }
  console.log(`📝  Active tasks: ${taskByDomain.size ? [...taskByDomain.keys()].join(', ') : '(none)'}\n`)

  const stats = {
    assignmentsCreated: 0,
    deadlinesReset:     0,
    mailed:             0,
    queued:             0,
    mailFailed:         0,
    skipped:            0,
    missingTask:        [],
  }
  let budgetSpent = false

  // ── Phase 1: tasks and deadlines ───────────────────────────────────────────
  console.log('── Phase 1: assignments and deadlines ─────────────────────────')

  for (const app of batch) {
    const keys = app.domainKeys?.length ? app.domainKeys : domainKeys(app.domains ?? [])
    const existing = await assignments.find({ applicationId: app._id }).toArray()
    const heldTaskIds = new Set(existing.map((a) => a.taskId?.toString()))
    const created = []

    // With --keep-deadlines a new assignment joins whatever the candidate is
    // already working to, so their two tasks fall due together.
    const newDueAt = KEEP_DUE
      ? (existing.find((a) => a.dueAt)?.dueAt ?? DUE_AT)
      : DUE_AT

    for (const domain of keys) {
      const task = taskByDomain.get(domain)
      if (!task) {
        if (!stats.missingTask.includes(domain)) stats.missingTask.push(domain)
        continue
      }
      if (heldTaskIds.has(task._id.toString())) continue

      if (!DRY_RUN) {
        await assignments.insertOne({
          driveId:       DRIVE_ID,
          applicationId: app._id,
          taskId:        task._id,
          domain:        task.domain,
          status:        'assigned',
          dueAt:         newDueAt,
          submission:    null,
          history:       [],
          score:         null,
          feedback:      '',
          assignedBy:    { id: 'system', email: 'backfill' },
          assignedAt:    startedAt,
          updatedAt:     startedAt,
        })
      }
      created.push(task.domain)
      stats.assignmentsCreated++
    }

    // Reset every deadline they hold — including any assigned by hand earlier.
    if (KEEP_DUE) {
      // nothing to do: existing deadlines stand, new rows already carry newDueAt
    } else if (!DRY_RUN) {
      const res = await assignments.updateMany(
        { applicationId: app._id },
        { $set: { dueAt: DUE_AT, updatedAt: startedAt } }
      )
      stats.deadlinesReset += res.modifiedCount
    } else {
      stats.deadlinesReset += existing.length + created.length
    }

    const assignedDomains = [...new Set([...existing.map((a) => a.domain), ...created])].filter(Boolean)
    if (!DRY_RUN && assignedDomains.length > 0) {
      await apps.updateOne(
        { _id: app._id },
        {
          $set: {
            assignedDomain:  assignedDomains[0],
            assignedDomains,
            updatedAt:       startedAt,
            // Only move a candidate forward; never drag one back from a later
            // stage (interview_scheduled, selected) into task_assigned.
            ...(['submitted', 'under_review', 'shortlisted'].includes(app.status)
              ? { status: 'task_assigned' }
              : {}),
          },
        }
      )
    }

    if (created.length > 0) {
      console.log(`   + ${app.srmEmail.padEnd(28)} task(s) for ${created.join(', ')}`)
    }
  }

  console.log(`   ${stats.assignmentsCreated} assignment(s) created, ${stats.deadlinesReset} deadline(s) reset.`)
  if (stats.missingTask.length > 0) {
    console.log(`   ⚠️  No active task for: ${stats.missingTask.join(', ')} — those domains got nothing.`)
  }

  // ── Phase 2: passwords and mail ────────────────────────────────────────────
  if (SKIP_MAIL) {
    console.log('\n⏭   --skip-mail — no passwords rotated, no mail sent.')
  } else {
    console.log('\n── Phase 2: passwords and confirmation mail ───────────────────')
    const budget = DRY_RUN ? null : await quotaSnapshot()
    if (budget) {
      console.log(`   Budget today: ${budget.used}/${budget.limit} used, ${budget.remaining} left.\n`)
    }

    for (const app of batch) {
      if (budgetSpent) { stats.skipped++; continue }

      const password = crypto.randomInt(10000, 100000).toString()

      if (DRY_RUN) {
        console.log(`   → would mail ${app.srmEmail} (${app.applicantId ?? 'no id'}) a new password`)
        stats.mailed++
        continue
      }

      let queuedForRetry = false
      try {
        await sendApplicationConfirmation({
          name:        app.name,
          email:       app.srmEmail,
          applicantId: app.applicantId ?? '—',
          domains:     app.domains ?? [],
          password,
          dueAt:       KEEP_DUE ? null : DUE_AT,
          resend:      true,
        })
        stats.mailed++
      } catch (err) {
        if (err.outboxStatus === 'pending') {
          // Written down and waiting — the password will still reach them, so
          // it has to become the live one.
          queuedForRetry = true
          stats.queued++
          console.warn(`   ~ ${app.srmEmail.padEnd(28)} queued for retry: ${err.message}`)
        } else {
          stats.mailFailed++
          console.error(`   ✗ ${app.srmEmail.padEnd(28)} ${err.message}`)
          console.error('     password left unchanged — they keep the one they have')
          continue
        }

        if (err.code === 'EMAIL_QUOTA') {
          budgetSpent = true
          console.warn('\n   ⛔ Daily SMTP budget is spent. Stopping here.')
          console.warn('      Re-run this script tomorrow — processed rows are skipped automatically.')
        }
      }

      await apps.updateOne(
        { _id: app._id },
        {
          $set: {
            passwordHash:         await bcrypt.hash(password, 10),
            confirmationResentAt: new Date(),
            updatedAt:            new Date(),
            ...(queuedForRetry ? { confirmationQueued: true } : { confirmationQueued: false }),
          },
        }
      )

      if (!queuedForRetry) {
        console.log(`   ✓ ${app.srmEmail.padEnd(28)} ${app.applicantId ?? ''}`)
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n── Summary ────────────────────────────────────────────────────')
  console.log(`   assignments created : ${stats.assignmentsCreated}`)
  console.log(KEEP_DUE
    ? '   deadlines reset     : 0  (--keep-deadlines)'
    : `   deadlines reset     : ${stats.deadlinesReset}  → ${istStr(DUE_AT)}`)
  if (!SKIP_MAIL) {
    console.log(`   confirmations sent  : ${stats.mailed}`)
    console.log(`   queued for retry    : ${stats.queued}`)
    console.log(`   send failures       : ${stats.mailFailed}`)
    console.log(`   not reached (budget): ${stats.skipped}`)
  }

  if (!DRY_RUN && !SKIP_MAIL) {
    const [after, outbox] = await Promise.all([quotaSnapshot(), outboxSummary()])
    console.log(`\n   SMTP budget  : ${after.used}/${after.limit} used today, ${after.remaining} left`)
    console.log(`   outbox       : ${JSON.stringify(outbox.byStatus)}`)
    if ((outbox.byStatus.pending ?? 0) > 0) {
      console.log('   → run `npm run flush-outbox` once the budget resets to deliver the rest')
    }
  }
  console.log('')

  await client.close()
  await (await libClientPromise).close()
}

main().catch(async (err) => {
  console.error('\n❌  Backfill failed:', err)
  await (await libClientPromise).close().catch(() => {})
  process.exit(1)
})
