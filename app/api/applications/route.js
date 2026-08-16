/**
 * app/api/applications/route.js
 *
 * POST /api/applications
 *
 * Public intake endpoint. Accepts a multipart/form-data submission from the
 * registration form and stores the application + resume in MongoDB.
 *
 * Security layers (in order):
 *  1. Honeypot field check (bot trap)
 *  2. Cloudflare Turnstile token verification
 *  3. IP-based rate limiting (5 submissions per hour)
 *  4. Zod schema validation
 *  5. Duplicate SRM email detection
 *  6. OTP Verification check
 *  7. Password Generation & Hashing
 *  8. PDF magic-byte + size validation
 *  9. GridFS upload & Database insert
 * 10. Auto-assign the live task for every domain they picked
 * 11. Confirmation email with dashboard password, queued durably
 */

import { ObjectId }                       from 'mongodb'
import { getCollection }                  from '@/lib/db'
import { ApplicationSchema, TECH_DOMAINS, domainKeys } from '@/lib/schemas'
import { uploadResume, validatePdfBuffer } from '@/lib/storage'
import { checkRateLimit, getClientIp }    from '@/lib/ratelimit'
import { sendApplicationConfirmation, flushOutbox } from '@/lib/email'
import { after }                          from 'next/server'
import { withErrorHandling }              from '@/lib/rbac'
import { applicationWindowState, applicationsOpenAt, applicationsCloseAt, taskDeadlineFor, fmtIstDate } from '@/lib/recruitment'
import crypto                             from 'crypto'
import bcrypt                             from 'bcryptjs'

const DRIVE_ID = process.env.DRIVE_ID ?? '2026'

/**
 * This handler uploads a PDF, hashes a password, assigns up to two tasks and
 * waits for the confirmation email to actually leave. The default serverless
 * ceiling is too tight for that on a slow SMTP round trip, and a timeout here
 * costs the candidate their password.
 */
export const maxDuration = 60

/**
 * Human-facing applicant id: BND-### with three random digits.
 *
 * That is only 1000 codes per drive, so collisions are expected rather than
 * rare — we retry against the unique index and widen to four digits if the
 * space is genuinely crowded. Past ~1000 applicants, raise DIGITS.
 */
async function generateApplicantId(collection) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = `BND-${crypto.randomInt(100, 1000)}`
    const clash = await collection.countDocuments(
      { driveId: DRIVE_ID, applicantId: candidate },
      { limit: 1 }
    )
    if (clash === 0) return candidate
  }
  // 3-digit space is saturated — fall back to 4 so intake never blocks
  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = `BND-${crypto.randomInt(1000, 10000)}`
    const clash = await collection.countDocuments(
      { driveId: DRIVE_ID, applicantId: candidate },
      { limit: 1 }
    )
    if (clash === 0) return candidate
  }
  throw new Error('Could not allocate an applicant id')
}

// ─── Cloudflare Turnstile verification ───────────────────────────────────────

async function verifyTurnstile(token) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true // no key configured → nothing to check

  // Turnstile widgets only solve on domains registered with the key, so a
  // configured key would otherwise make every local submission fail with 403.
  // Development skips the check; production always enforces it.
  if (process.env.NODE_ENV !== 'production') {
    if (!token) console.warn('[turnstile] no token — skipped verification (development)')
    return true
  }

  if (!token) return false

  const body = new URLSearchParams()
  body.set('secret',   secret)
  body.set('response', token)

  const res  = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json()
  return data.success === true
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export const POST = withErrorHandling(async function handler(request) {
  // 1. Parse multipart form data
  let formData
  try {
    formData = await request.formData()
  } catch {
    return jsonError('Invalid form data', 400)
  }

  // 2. Intake window. Development is let through with a warning so the form can
  //    still be exercised outside the real dates.
  const windowState = applicationWindowState()
  if (windowState !== 'open') {
    if (process.env.NODE_ENV === 'production') {
      return jsonError(
        windowState === 'before'
          ? `Applications open on ${fmtIstDate(applicationsOpenAt())}.`
          : `Applications closed on ${fmtIstDate(applicationsCloseAt())}.`,
        403,
        { window: windowState }
      )
    }
    console.warn(`[applications] intake window is "${windowState}" — allowed anyway (development)`)
  }

  // 3. Honeypot check
  const honeypot = formData.get('_hp') ?? ''
  if (honeypot !== '') {
    return jsonSuccess({ applicationId: 'bot-' + Date.now() }, 200)
  }

  // 3. Turnstile verification
  const turnstileToken = formData.get('cf-turnstile-response') ?? ''
  const turnstileOk    = await verifyTurnstile(turnstileToken)
  if (!turnstileOk) {
    return jsonError('Bot protection check failed. Please refresh and try again.', 403)
  }

  // 4. Rate limit by IP
  const ip = getClientIp(request)
  const rl = await checkRateLimit(ip, { limit: 5, windowSeconds: 3600 })
  if (!rl.allowed) {
    return jsonError('Too many applications from your IP. Please try again later.', 429)
  }

  // 5. Extract and validate form fields
  const raw = {
    name:               formData.get('name'),
    personalEmail:      formData.get('personalEmail'),
    srmEmail:           formData.get('srmEmail'),
    registrationNumber: formData.get('registrationNumber'),
    branch:             formData.get('branch'),
    department:         formData.get('department'),
    year:               formData.get('year'),
    domains:            formData.getAll('domains'),
    question1:          formData.get('question1'),
    question2:          formData.get('question2'),
  }

  const parsed = ApplicationSchema.safeParse(raw)
  if (!parsed.success) {
    const errors = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] ?? 'general'
      if (!errors[field]) errors[field] = issue.message
    }
    return jsonError('Validation failed', 422, { fields: errors })
  }

  const data = parsed.data

  // 6. OTP Verification Check
  const otpCol = await getCollection('otps')
  const otpRecord = await otpCol.findOne({ email: data.srmEmail })
  if (!otpRecord || !otpRecord.verified) {
    return jsonError('SRM email not verified. Please verify your email with OTP.', 403, { fields: { srmEmail: 'Email not verified' } })
  }

  // 7. Duplicate Check — one application per SRM email *and* per registration no.
  const appCol = await getCollection('applications')
  const existing = await appCol.findOne({
    driveId: DRIVE_ID,
    $or: [
      { srmEmail:           data.srmEmail },
      { registrationNumber: data.registrationNumber },
    ],
  })
  if (existing) {
    const clash = existing.srmEmail === data.srmEmail ? 'SRM email' : 'registration number'
    return jsonError(
      `An application with this ${clash} already exists.`,
      409,
      { applicationId: existing._id.toString() }
    )
  }

  // 8. Generate the short dashboard password (5 digits, as specified)
  const plainPassword = crypto.randomInt(10000, 100000).toString() // e.g. '48213'
  const passwordHash = await bcrypt.hash(plainPassword, 10)

  // 9. Handle Resume Upload
  const resumeFile = formData.get('resume')
  let resumeData   = null

  // Resume is required for 2nd Year technical applicants
  const isTech = data.domains.some(d => TECH_DOMAINS.includes(d))
  const resumeRequired = data.year === '2nd Year' && isTech
  
  if (resumeRequired && (!resumeFile || resumeFile.size === 0)) {
    return jsonError('Resume is required for 2nd Year technical applicants.', 422, {
      fields: { resume: 'Resume is required' },
    })
  }

  // The id is minted up front so the GridFS metadata and the application
  // document agree — GET /api/resumes/:applicationId looks the file up by it.
  const applicationObjectId = new ObjectId()

  if (resumeFile && resumeFile.size > 0) {
    const buffer      = Buffer.from(await resumeFile.arrayBuffer())
    const validation  = validatePdfBuffer(buffer)
    if (!validation.valid) {
      return jsonError(validation.reason, 422, { fields: { resume: validation.reason } })
    }

    const upload = await uploadResume(buffer, resumeFile.name, {
      applicationId: applicationObjectId.toString(),
      email:         data.srmEmail,
      driveId:       DRIVE_ID,
    })
    resumeData = { fileId: upload.fileId, filename: upload.filename }
  }

  // 10. Insert application document
  const now = new Date()
  const applicantId = await generateApplicantId(appCol)

  const doc = {
    _id:                applicationObjectId,
    applicantId,
    driveId:            DRIVE_ID,
    name:               data.name,
    personalEmail:      data.personalEmail,
    srmEmail:           data.srmEmail,
    registrationNumber: data.registrationNumber,
    branch:             data.branch,
    department:         data.department,
    year:               data.year,
    domains:            data.domains,
    // short keys alongside the labels — tasks, assignments and domain-lead
    // scoping all speak in keys, so filtering never has to translate
    domainKeys:         domainKeys(data.domains),
    question1:          data.question1,
    question2:          data.question2,
    resume:             resumeData,
    passwordHash:       passwordHash,
    status:             'submitted',
    assignedDomain:     null,
    assignedDomains:    [],
    source:             'web_form',
    userAgent:          request.headers.get('user-agent') ?? null,
    ip,
    createdAt:          now,
    updatedAt:          now,
  }

  const result = await appCol.insertOne(doc)
  const applicationId = result.insertedId.toString()

  // Clean up OTP record
  await otpCol.deleteOne({ _id: otpRecord._id })

  // 11. The candidate's own five-day clock starts now, not at a shared cut-off.
  const dueAt = taskDeadlineFor(now)

  // 12. Hand over a task straight away for *every* domain they picked, not just
  //     the first. Someone who chose two domains is judged on two briefs, so
  //     showing them one and hiding the other loses them half the drive.
  //     The pipeline is apply → task → shortlist, so waiting for a human to
  //     assign them would eat into the five days they were promised.
  const assignedDomains = []
  try {
    const tasksCol    = await getCollection('tasks')
    const assignments = await getCollection('assignments')

    for (const domain of doc.domainKeys) {
      const task = await tasksCol.findOne(
        { driveId: DRIVE_ID, domain, active: true },
        { sort: { createdAt: -1 } }
      )
      if (!task) {
        console.warn(`[applications] no active task for domain "${domain}" — nothing auto-assigned`)
        continue
      }

      await assignments.insertOne({
        driveId:       DRIVE_ID,
        applicationId: applicationObjectId,
        taskId:        task._id,
        domain:        task.domain,
        status:        'assigned',
        dueAt,
        submission:    null,
        history:       [],
        score:         null,
        feedback:      '',
        assignedBy:    { id: 'system', email: 'auto-assign' },
        assignedAt:    now,
        updatedAt:     now,
      })
      assignedDomains.push(task.domain)
    }

    if (assignedDomains.length > 0) {
      await appCol.updateOne(
        { _id: applicationObjectId },
        {
          $set: {
            status:          'task_assigned',
            // Kept singular for the existing admin scoping; the array is the
            // honest answer once someone holds two briefs.
            assignedDomain:  assignedDomains[0],
            assignedDomains,
            updatedAt:       now,
          },
        }
      )
    }
  } catch (err) {
    // A failed auto-assign must not lose the application; an admin can assign later.
    console.error('[applications] auto-assign failed:', err)
  }

  // 13. Send the confirmation with their password and personal deadline.
  //
  //     Fully awaited — the row is written *and* the message is put on the wire
  //     before this request returns. It has to be: the plaintext password exists
  //     nowhere else, and on serverless anything left running past the response
  //     is frozen, so "queue it and move on" silently meant "never sent".
  //     A failure here still leaves a durable row that later attempts retry.
  try {
    await sendApplicationConfirmation({
      name:          data.name,
      email:         data.srmEmail,
      applicantId,
      domains:       data.domains,
      password:      plainPassword,
      dueAt,
    })
  } catch (err) {
    console.error('[email] Confirmation send failed (queued for retry):', err)
  }

  // Anything parked by an earlier failure or by the daily budget gets a nudge
  // once the response is out. after() keeps the function alive to do it, which
  // a bare floating promise does not.
  after(async () => {
    try {
      await flushOutbox()
    } catch (err) {
      console.error('[email] post-response outbox drain failed:', err)
    }
  })

  return jsonSuccess(
    {
      applicationId,
      applicantId,
      dueAt:   dueAt.toISOString(),
      message: 'Application submitted successfully! Check your email for dashboard access.',
    },
    201
  )
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonSuccess(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function jsonError(message, status = 400, extra = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
