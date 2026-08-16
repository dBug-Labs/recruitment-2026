/**
 * app/api/otp/send/route.js
 *
 * POST /api/otp/send
 * Sends a 6-digit OTP to a validated SRM email address.
 * OTPs are stored in the `otps` MongoDB collection with a 10-minute TTL.
 *
 * Rate limited twice: 4 OTPs per email per hour, and 20 per IP per hour so one
 * machine cycling addresses cannot drain the day's sends.
 *
 * On top of that, lib/email/outbox.js refuses OTPs once the day's budget is
 * down to the reserve kept for application confirmations. That refusal reaches
 * the candidate as a 503 here rather than a cheerful "OTP sent" for a mail that
 * never left — the form asks them to try again shortly.
 */

import { getCollection }              from '@/lib/db'
import { OtpSendSchema }              from '@/lib/schemas'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { withErrorHandling }           from '@/lib/rbac'
import { sendOtp }                     from '@/lib/email'
import crypto                          from 'crypto'

export const POST = withErrorHandling(async function handler(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid JSON', 400)
  }

  const parsed = OtpSendSchema.safeParse(body)
  if (!parsed.success) {
    const errors = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] ?? 'general'
      if (!errors[field]) errors[field] = issue.message
    }
    return jsonError('Validation failed', 422, { fields: errors })
  }

  const { srmEmail } = parsed.data

  // An address that is already verified does not need another code — the form
  // asks for one on submit, and a reload should not cost a send.
  const col = await getCollection('otps')
  const verified = await col.findOne({ email: srmEmail, verified: true })
  if (verified && new Date(verified.expiresAt) > new Date()) {
    return jsonSuccess({ success: true, alreadyVerified: true, message: 'This email is already verified.' })
  }

  const perEmail = await checkRateLimit(`otp:${srmEmail}`, { limit: 4, windowSeconds: 3600 })
  if (!perEmail.allowed) {
    return jsonError('Too many OTP requests for this email. Please try again in an hour.', 429)
  }

  const perIp = await checkRateLimit(`otp-ip:${getClientIp(request)}`, { limit: 20, windowSeconds: 3600 })
  if (!perIp.allowed) {
    return jsonError('Too many OTP requests from this network. Please try again later.', 429)
  }

  // Generate 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  // Store in MongoDB
  await col.deleteMany({ email: srmEmail }) // Remove any old OTPs
  await col.insertOne({
    email: srmEmail,
    otp,
    expiresAt,
    verified: false,
    createdAt: new Date(),
  })

  // Send OTP email (logged instead of sent while EMAIL_DRY_RUN=true).
  // sendOtp delivers inline, so anything that comes back is a real failure.
  try {
    await sendOtp({ email: srmEmail, otp })
  } catch (err) {
    // No code reached them — drop the record so the next attempt starts clean
    // instead of leaving an OTP they were never told.
    await col.deleteMany({ email: srmEmail })

    if (err?.code === 'EMAIL_QUOTA') {
      console.warn('[otp] budget refused an OTP:', err.message)
      return jsonError(
        'We have hit today\'s email limit for verification codes. Please try again in a little while — '
        + 'the remaining sends are reserved for application confirmations.',
        503,
        { code: 'email_budget' }
      )
    }

    console.error('[otp] send failed:', err)
    return jsonError('We could not send the code right now. Please try again in a moment.', 502)
  }

  return jsonSuccess({ success: true, message: 'OTP sent to your SRM email.' })
})

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
