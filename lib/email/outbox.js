/**
 * lib/email/outbox.js
 *
 * Every real email goes through here, and here is where the SMTP budget is
 * rationed.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────────
 *
 * One Gmail account sends everything: OTPs, confirmations, task notices. Gmail
 * caps that account at a few hundred messages a day, so a rush of OTP resends
 * could eat the whole allowance — and the "Application Received" mail, which
 * carries the candidate's dashboard password, would then fail with nothing to
 * catch it. The password was generated, hashed and stored; the only copy of the
 * plaintext died in a `console.error`. The candidate could never log in.
 *
 * Two rules fix that:
 *
 *  1. **A reserve.** OTPs and bulk announcements may only spend down to
 *     SMTP_DAILY_LIMIT − SMTP_OTP_RESERVE. The last slice of the day's budget
 *     belongs to mail a candidate cannot do without.
 *
 *  2. **A durable queue.** A message is written to `emailOutbox` before any
 *     send is attempted, so a failure is a row to retry rather than a lost
 *     password. Retryable failures back off and are picked up by the next pump
 *     or by `npm run flush-outbox`.
 *
 * ─── Knobs ───────────────────────────────────────────────────────────────────
 *
 *   SMTP_DAILY_LIMIT        total sends per IST day        (default 450)
 *   SMTP_OTP_RESERVE        slots kept for critical mail   (default 120)
 *   SMTP_MIN_INTERVAL_MS    gap between sends              (default 900)
 *   EMAIL_MAX_ATTEMPTS      tries before giving up         (default 6)
 *   EMAIL_OUTBOX=off        bypass the queue entirely      (send-test-email)
 */

import { deliver, isDryRun, isRetryable, isQuotaError } from './transport.js'

// The db module throws at import time when MONGODB_URI is unset, so it is
// pulled in lazily — that keeps EMAIL_OUTBOX=off usable with no database.
let dbModule
async function coll(name) {
  if (!dbModule) dbModule = await import('../db.js')
  return dbModule.getCollection(name)
}

/** Lower number drains first. */
export const PRIORITY = Object.freeze({ HIGH: 1, NORMAL: 5, LOW: 9 })

/**
 * Mail a candidate is stuck without. These may spend the reserve; everything
 * else stops short of it.
 */
const CRITICAL_KINDS = new Set([
  'confirmation',
  'task',
  'deadline',
  'deadline-extended',
  'interview',
  'shortlist',
  'result',
  'submission-receipt',
])

const num = (value, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

const dailyLimit    = () => num(process.env.SMTP_DAILY_LIMIT, 450)
const otpReserve    = () => num(process.env.SMTP_OTP_RESERVE, 120)
const minIntervalMs = () => num(process.env.SMTP_MIN_INTERVAL_MS, 900)
const maxAttempts   = () => Math.max(1, num(process.env.EMAIL_MAX_ATTEMPTS, 6))

const isOutboxEnabled = () => process.env.EMAIL_OUTBOX !== 'off'

/** Grows to a day, because a quota failure is not clearing in five minutes. */
const BACKOFF_MS = [60_000, 5 * 60_000, 20 * 60_000, 60 * 60_000, 4 * 60 * 60_000, 12 * 60 * 60_000]
const backoffFor = (attempts) => BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length) - 1]

/** A `sending` row older than this was orphaned by a crash or a redeploy. */
const CLAIM_STALE_MS = 10 * 60_000

// ─── The day's budget ─────────────────────────────────────────────────────────

const IST = 'Asia/Kolkata'

/**
 * The bucket key: an IST calendar day, e.g. "2026-08-16".
 *
 * Gmail's cap is really a rolling 24 hours, but the drive is run on IST dates
 * and a day bucket is what a human reading `emailQuota` expects to see.
 */
function quotaKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

/** Next IST midnight — when a budget-blocked message is worth trying again. */
function nextBudgetReset(now = new Date()) {
  const istNow = new Date(now.toLocaleString('en-US', { timeZone: IST }))
  const istMidnight = new Date(istNow)
  istMidnight.setHours(24, 0, 0, 0)
  return new Date(now.getTime() + (istMidnight.getTime() - istNow.getTime()))
}

const ceilingFor = (kind) =>
  CRITICAL_KINDS.has(kind) ? dailyLimit() : Math.max(0, dailyLimit() - otpReserve())

/**
 * Claims one slot of today's budget.
 *
 * Increments first and rolls back when the count runs past the ceiling, so two
 * concurrent submissions can never both read "one slot left" and both take it.
 *
 * @param {string} kind
 * @returns {Promise<{ ok: boolean, used: number, ceiling: number }>}
 */
async function reserveQuota(kind) {
  const col     = await coll('emailQuota')
  const key     = quotaKey()
  const bucket  = CRITICAL_KINDS.has(kind) ? 'critical' : 'throttled'
  const ceiling = ceilingFor(kind)

  const doc = await col.findOneAndUpdate(
    { _id: key },
    { $inc: { total: 1, [bucket]: 1 }, $set: { updatedAt: new Date() } },
    { upsert: true, returnDocument: 'after' }
  )

  const used = doc?.total ?? 1
  if (used > ceiling) {
    await col.updateOne({ _id: key }, { $inc: { total: -1, [bucket]: -1 } })
    return { ok: false, used: used - 1, ceiling }
  }
  return { ok: true, used, ceiling }
}

/** Hands a slot back when the message never actually left. */
async function releaseQuota(kind) {
  const col    = await coll('emailQuota')
  const bucket = CRITICAL_KINDS.has(kind) ? 'critical' : 'throttled'
  await col.updateOne({ _id: quotaKey() }, { $inc: { total: -1, [bucket]: -1 } })
}

/**
 * Burns the rest of the day.
 *
 * Called when the provider itself says it is done — our own count clearly
 * disagrees with theirs, and theirs is the one that matters.
 */
async function markDayExhausted() {
  const col = await coll('emailQuota')
  await col.updateOne(
    { _id: quotaKey() },
    { $set: { total: dailyLimit(), exhaustedAt: new Date(), updatedAt: new Date() } },
    { upsert: true }
  )
}

/** What is left in today's budget, for the admin panel and the scripts. */
export async function quotaSnapshot() {
  const col = await coll('emailQuota')
  const doc = await col.findOne({ _id: quotaKey() })
  const used = doc?.total ?? 0
  return {
    day:       quotaKey(),
    used,
    limit:     dailyLimit(),
    reserve:   otpReserve(),
    remaining: Math.max(0, dailyLimit() - used),
    /** What an OTP or an announcement still has to play with. */
    throttledRemaining: Math.max(0, dailyLimit() - otpReserve() - used),
  }
}

// ─── Send spacing ─────────────────────────────────────────────────────────────

let lastSendAt = 0

async function spaceOutSends() {
  const gap = minIntervalMs()
  if (gap <= 0) return
  const wait = lastSendAt + gap - Date.now()
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastSendAt = Date.now()
}

// ─── The queue ────────────────────────────────────────────────────────────────

/**
 * Writes a message down before anyone tries to send it.
 *
 * @param {{ to: string, subject: string, html: string, text: string }} payload
 * @param {{ kind?: string, priority?: number, retry?: boolean, meta?: object }} [options]
 */
export async function enqueue(payload, options = {}) {
  const { kind = 'other', priority = PRIORITY.NORMAL, retry = true, meta } = options
  const col = await coll('emailOutbox')
  const now = new Date()

  const result = await col.insertOne({
    to:            payload.to,
    subject:       payload.subject,
    html:          payload.html,
    text:          payload.text,
    kind,
    priority,
    retry,
    critical:      CRITICAL_KINDS.has(kind),
    status:        'pending',
    attempts:      0,
    nextAttemptAt: now,
    lastError:     null,
    messageId:     null,
    sentAt:        null,
    createdAt:     now,
    updatedAt:     now,
    ...(meta ? { meta } : {}),
  })

  return result.insertedId
}

/** Frees rows a crashed process left mid-flight. */
async function reclaimStaleClaims() {
  const col = await coll('emailOutbox')
  await col.updateMany(
    { status: 'sending', claimedAt: { $lt: new Date(Date.now() - CLAIM_STALE_MS) } },
    { $set: { status: 'pending', updatedAt: new Date() } }
  )
}

/**
 * Takes the next due message, highest priority and oldest first.
 *
 * `criticalOnly` narrows to mail that may spend the reserve — the drain flips
 * it on once the throttled tier runs out, so a queue of announcements cannot
 * make the pump walk past a confirmation waiting behind them.
 */
async function claimNext(criticalOnly = false) {
  const col = await coll('emailOutbox')
  return col.findOneAndUpdate(
    {
      status:        'pending',
      nextAttemptAt: { $lte: new Date() },
      ...(criticalOnly ? { critical: true } : {}),
    },
    { $set: { status: 'sending', claimedAt: new Date(), updatedAt: new Date() } },
    { sort: { priority: 1, createdAt: 1 }, returnDocument: 'after' }
  )
}

/**
 * Spends a slot, sends, and records the outcome on the row.
 *
 * Throws on failure. The thrown error carries `outboxStatus` so a caller can
 * tell "this will be retried, the recipient will still get it" apart from
 * "this is dead, do nothing that assumed it arrived".
 */
async function deliverRecord(record) {
  const col = await coll('emailOutbox')

  const reservation = await reserveQuota(record.kind)
  if (!reservation.ok) {
    await col.updateOne(
      { _id: record._id },
      {
        $set: {
          status:        'pending',
          nextAttemptAt: nextBudgetReset(),
          lastError:     `Daily SMTP budget spent (${reservation.used}/${reservation.ceiling})`,
          updatedAt:     new Date(),
        },
      }
    )
    const err = new Error(
      CRITICAL_KINDS.has(record.kind)
        ? `Daily SMTP budget spent (${reservation.used}/${reservation.ceiling}) — queued for tomorrow.`
        : `Today's OTP and bulk-mail budget is spent (${reservation.used}/${reservation.ceiling}). ` +
          `The remaining sends are reserved for application confirmations.`
    )
    err.code         = 'EMAIL_QUOTA'
    err.outboxStatus = 'pending'
    throw err
  }

  await spaceOutSends()

  try {
    const info = await deliver(record)
    await col.updateOne(
      { _id: record._id },
      {
        $set: {
          status:    'sent',
          sentAt:    new Date(),
          messageId: info?.messageId ?? null,
          lastError: null,
          updatedAt: new Date(),
        },
      }
    )
    return info
  } catch (err) {
    // The message never left, so the slot was not actually spent.
    await releaseQuota(record.kind).catch(() => {})
    if (isQuotaError(err)) await markDayExhausted().catch(() => {})

    const attempts  = (record.attempts ?? 0) + 1
    const willRetry = record.retry !== false && isRetryable(err) && attempts < maxAttempts()
    const status    = willRetry ? 'pending' : 'failed'

    await col.updateOne(
      { _id: record._id },
      {
        $set: {
          status,
          attempts,
          lastError:     err.message,
          nextAttemptAt: isQuotaError(err)
            ? nextBudgetReset()
            : new Date(Date.now() + backoffFor(attempts)),
          updatedAt:     new Date(),
        },
      }
    )

    err.outboxStatus = status
    throw err
  }
}

let pumping = null

/**
 * Drains everything that is due, then stops. Safe to call from anywhere —
 * concurrent callers share the one in-flight run.
 *
 * @returns {Promise<{ sent: number, failed: number, stopped: string|null }>}
 */
export function pump() {
  if (pumping) return pumping

  pumping = (async () => {
    const stats = { sent: 0, failed: 0, deferred: 0, stopped: null }
    // Flips on once the throttled tier is spent for the day.
    let criticalOnly = false

    try {
      await reclaimStaleClaims()
      for (;;) {
        const record = await claimNext(criticalOnly)
        if (!record) break

        try {
          await deliverRecord(record)
          stats.sent++
          continue
        } catch (err) {
          // Our own ration refused it; the row is already parked until tomorrow.
          if (err.code === 'EMAIL_QUOTA') {
            stats.deferred++
            if (record.critical) {
              // The hard cap. Nothing else is getting out today either.
              stats.stopped = 'quota'
              console.warn('[email] daily budget spent — pausing the outbox:', err.message)
              break
            }
            // Only OTPs and bulk mail are out. Anything a candidate actually
            // needs still has the reserve, so keep draining just those.
            if (criticalOnly) break
            criticalOnly = true
            console.warn('[email] throttled tier spent — reserve now serves critical mail only')
            continue
          }

          stats.failed++
          if (isQuotaError(err)) {
            // The provider itself said stop, whatever our own count thought.
            stats.stopped = 'quota'
            console.warn('[email] provider refused further sends:', err.message)
            break
          }
          console.error(`[email] ${record.kind} → ${record.to} failed (${err.outboxStatus}):`, err.message)
        }
      }
    } catch (err) {
      stats.stopped = 'error'
      console.error('[email] outbox pump crashed:', err)
    } finally {
      pumping = null
    }
    return stats
  })()

  return pumping
}

/** Sends one specific row now and surfaces whatever happens. */
async function drainOne(id) {
  const col = await coll('emailOutbox')
  const record = await col.findOneAndUpdate(
    { _id: id, status: 'pending' },
    { $set: { status: 'sending', claimedAt: new Date(), updatedAt: new Date() } },
    { returnDocument: 'after' }
  )
  if (!record) throw new Error('Outbox row is no longer pending — another worker took it')
  return deliverRecord(record)
}

/** Drains the queue to empty. For scripts and the admin flush button. */
export async function flushOutbox() {
  return pump()
}

/** Counts by status, so a script can say what is still owed. */
export async function outboxSummary() {
  const col = await coll('emailOutbox')
  const rows = await col
    .aggregate([{ $group: { _id: { status: '$status', kind: '$kind' }, count: { $sum: 1 } } }])
    .toArray()

  const byStatus = {}
  const byKind   = {}
  for (const row of rows) {
    byStatus[row._id.status] = (byStatus[row._id.status] ?? 0) + row.count
    if (row._id.status !== 'sent') {
      byKind[row._id.kind] = (byKind[row._id.kind] ?? 0) + row.count
    }
  }
  return { byStatus, pendingByKind: byKind }
}

// ─── What the templates call ──────────────────────────────────────────────────

/**
 * Hands a rendered message to the outbox and, by default, sends it right there.
 *
 * ─── Why inline, and not "queue it and move on" ──────────────────────────────
 *
 * This used to write the row and hand it to the background pump, which is the
 * textbook shape and is wrong here. The app runs on serverless: the function is
 * frozen the instant the response is returned, so the pump was killed mid-send.
 * Confirmation rows sat in `sending` forever, `attempts` still 0, and the
 * candidate never got the password — which exists nowhere else, since it is
 * stored only as a bcrypt hash. OTPs were unaffected purely because they had
 * always asked to send inline.
 *
 * So the row is still written first, for durability, quota and retry — but the
 * send happens before the caller gets its answer. It costs the request a second
 * or two, and it is the only way to actually know the message went. Pass
 * `background: true` only where nothing depends on the outcome and something
 * else is guaranteed to drain the queue.
 *
 * Order of checks:
 *   dry run          — log it, send nothing.
 *   EMAIL_OUTBOX=off — straight down the pipe, no database involved.
 *   otherwise        — write the row, then send it.
 *
 * @param {{ to: string, subject: string, html: string, text: string }} payload
 * @param {{ kind?: string, priority?: number, retry?: boolean, background?: boolean }} [options]
 */
export async function dispatch(payload, options = {}) {
  if (isDryRun()) {
    console.log('[email:dry-run] Would send email:')
    console.log(`  To:      ${payload.to}`)
    console.log(`  Kind:    ${options.kind ?? 'other'}`)
    console.log(`  Subject: ${payload.subject}`)
    console.log(`  Text:\n${payload.text}`)
    return { id: `dry-run-${Date.now()}` }
  }

  if (!isOutboxEnabled()) return deliver(payload)

  const id = await enqueue(payload, options)

  if (options.background) {
    pump()
    return { queued: true, outboxId: id.toString() }
  }

  return drainOne(id)
}
