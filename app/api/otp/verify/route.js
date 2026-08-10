/**
 * app/api/otp/verify/route.js
 *
 * POST /api/otp/verify
 * Verifies the 6-digit OTP for the given SRM email address.
 * Updates the `otps` record to `verified: true` if successful.
 */

import { getCollection }     from '@/lib/db'
import { OtpVerifySchema }   from '@/lib/schemas'
import { withErrorHandling } from '@/lib/rbac'

export const POST = withErrorHandling(async function handler(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid JSON', 400)
  }

  const parsed = OtpVerifySchema.safeParse(body)
  if (!parsed.success) {
    const errors = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] ?? 'general'
      if (!errors[field]) errors[field] = issue.message
    }
    return jsonError('Validation failed', 422, { fields: errors })
  }

  const { srmEmail, otp } = parsed.data

  const col = await getCollection('otps')
  const record = await col.findOne({ email: srmEmail })

  if (!record) {
    return jsonError('No OTP found. Please request a new one.', 404, { code: 'not_found' })
  }

  if (record.verified) {
    return jsonSuccess({ verified: true, message: 'Email already verified.' })
  }

  if (new Date() > new Date(record.expiresAt)) {
    await col.deleteOne({ _id: record._id }) // cleanup
    return jsonError('OTP expired. Please request a new one.', 410, { code: 'expired' })
  }

  if (record.otp !== otp) {
    return jsonError('Invalid OTP', 400, { code: 'invalid' })
  }

  // Mark as verified
  await col.updateOne({ _id: record._id }, { $set: { verified: true } })

  return jsonSuccess({ verified: true, message: 'Email verified successfully.' })
})

function jsonSuccess(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function jsonError(message, status = 400, extra = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
