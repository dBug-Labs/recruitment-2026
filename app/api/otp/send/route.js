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
import crypto                          from 'crypto'

// Lazy nodemailer import for OTP emails
let _transporter = null
function getTransporter() {
  if (!_transporter) {
    const nodemailer = require('nodemailer')
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }
  return _transporter
}

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

  // Send OTP email
  if (process.env.EMAIL_DRY_RUN === 'true') {
    console.log(`[otp:dry-run] OTP for ${srmEmail}: ${otp}`)
  } else {
    const transporter = getTransporter()
    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? 'recruitment@yourdomain.com',
      to: srmEmail,
      subject: 'Your OTP — dBug Labs Recruitment 2026',
      html: otpEmailHtml(otp),
      text: `Your OTP for dBug Labs Recruitment is: ${otp}\nThis code expires in 10 minutes. Do not share it with anyone.`,
    })
  }

  return new Response(JSON.stringify({ success: true, message: 'OTP sent to your SRM email.' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

function otpEmailHtml(otp) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OTP Verification</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           background: #0d0a0f; color: #e8e0ec; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 40px 24px; }
    .header  { text-align: center; padding-bottom: 32px; border-bottom: 1px solid #2a1f2e; }
    .logo    { font-size: 22px; font-weight: 700; color: #ff3a58; letter-spacing: 1px; }
    .body    { padding: 32px 0; text-align: center; }
    .footer  { padding-top: 24px; border-top: 1px solid #2a1f2e;
               font-size: 13px; color: #7a6d7e; text-align: center; }
    .otp     { display: inline-block; background: #1c0f22; border: 1px solid #3d1f4a;
               border-radius: 10px; padding: 18px 36px; font-family: monospace;
               font-size: 32px; color: #b06bff; letter-spacing: 8px; margin: 24px 0; }
    h2       { color: #f2ebf4; margin: 0 0 16px; }
    p        { line-height: 1.6; color: #cec2d1; margin: 0 0 14px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">🕷 dBug Labs</div>
    </div>
    <div class="body">
      <h2>Email Verification</h2>
      <p>Use the following OTP to verify your SRM email address:</p>
      <div class="otp">${otp}</div>
      <p>This code expires in <strong>10 minutes</strong>.<br/>Do not share this code with anyone.</p>
    </div>
    <div class="footer">
      dBug Labs Recruitment 2026 &bull; This is an automated message, please do not reply.
    </div>
  </div>
</body>
</html>`
}

function jsonError(message, status = 400, extra = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
