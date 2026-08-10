/**
 * app/api/otp/send/route.js
 *
 * POST /api/otp/send
 * Sends a 6-digit OTP to a validated SRM email address.
 * OTPs are stored in the `otps` MongoDB collection with a 10-minute TTL.
 * Rate limited: 3 OTPs per email per hour.
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

  // Rate limit: 3 OTPs per email per hour
  const rl = await checkRateLimit(`otp:${srmEmail}`, { limit: 3, windowSeconds: 3600 })
  if (!rl.allowed) {
    return jsonError('Too many OTP requests. Please try again later.', 429)
  }

  // Generate 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  // Store in MongoDB
  const col = await getCollection('otps')
  await col.deleteMany({ email: srmEmail }) // Remove any old OTPs
  await col.insertOne({
    email: srmEmail,
    otp,
    expiresAt,
    verified: false,
    createdAt: new Date(),
  })

  // Send OTP email (logged instead of sent while EMAIL_DRY_RUN=true)
  await sendOtp({ email: srmEmail, otp })

  return new Response(JSON.stringify({ success: true, message: 'OTP sent to your SRM email.' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

function jsonError(message, status = 400, extra = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
