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
 * 10. Confirmation email with dashboard password (non-blocking)
 */

import { ObjectId }                       from 'mongodb'
import { getCollection }                  from '@/lib/db'
import { ApplicationSchema, TECH_DOMAINS} from '@/lib/schemas'
import { uploadResume, validatePdfBuffer } from '@/lib/storage'
import { checkRateLimit, getClientIp }    from '@/lib/ratelimit'
import { sendApplicationConfirmation }    from '@/lib/email'
import { withErrorHandling }              from '@/lib/rbac'
import crypto                             from 'crypto'
import bcrypt                             from 'bcryptjs'

const DRIVE_ID = process.env.DRIVE_ID ?? '2026'

// ─── Cloudflare Turnstile verification ───────────────────────────────────────

async function verifyTurnstile(token) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true // skip in dev if no key
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

  // 2. Honeypot check
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

  // 7. Duplicate Check
  const appCol = await getCollection('applications')
  const existing = await appCol.findOne({ driveId: DRIVE_ID, srmEmail: data.srmEmail })
  if (existing) {
    return jsonError(
      'An application with this SRM email already exists.',
      409,
      { applicationId: existing._id.toString() }
    )
  }

  // 8. Generate Password & Hash
  const plainPassword = crypto.randomBytes(6).toString('hex') // e.g., '1a2b3c4d5e6f'
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

  if (resumeFile && resumeFile.size > 0) {
    const buffer      = Buffer.from(await resumeFile.arrayBuffer())
    const validation  = validatePdfBuffer(buffer)
    if (!validation.valid) {
      return jsonError(validation.reason, 422, { fields: { resume: validation.reason } })
    }

    const tempId = new ObjectId()
    const upload = await uploadResume(buffer, resumeFile.name, {
      applicationId: tempId.toString(),
      email:         data.srmEmail,
      driveId:       DRIVE_ID,
    })
    resumeData = { fileId: upload.fileId, filename: upload.filename }
  }

  // 10. Insert application document
  const now = new Date()
  const doc = {
    driveId:            DRIVE_ID,
    name:               data.name,
    personalEmail:      data.personalEmail,
    srmEmail:           data.srmEmail,
    registrationNumber: data.registrationNumber,
    branch:             data.branch,
    department:         data.department,
    year:               data.year,
    domains:            data.domains,
    question1:          data.question1,
    question2:          data.question2,
    resume:             resumeData,
    passwordHash:       passwordHash,
    status:             'submitted',
    assignedDomain:     null,
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

  // 11. Send confirmation email with password
  sendApplicationConfirmation({
    name:          data.name,
    email:         data.srmEmail,
    applicationId,
    domains:       data.domains,
    password:      plainPassword
  }).catch((err) => console.error('[email] Confirmation send failed:', err))

  return jsonSuccess(
    {
      applicationId,
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
