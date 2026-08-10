/**
 * lib/email/index.js
 *
 * Email dispatch layer.
 *
 * All emails are sent via Nodemailer (SMTP).
 * When EMAIL_DRY_RUN=true, emails are logged
 * to stdout instead of being sent — safe for development and staging.
 *
 * Exports one function per lifecycle event:
 *   sendApplicationConfirmation(data)
 *   sendTaskNotification(data)
 *   sendDeadlineReminder(data)
 *   sendDeadlineReminder(data)
 *   sendInterviewShortlist(data)
 *   sendInterviewInvitation(data)
 *   sendResultNotification(data)
 *   sendShortlistNotification(data)
 *   sendTaskSubmissionReceipt(data)
 */

import nodemailer from 'nodemailer'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * The club mark, attached inline rather than hot-linked.
 *
 * Mail clients block remote images by default and NEXT_PUBLIC_BASE_URL is
 * localhost in development, so a URL would show a broken box in both cases.
 * A cid: attachment renders straight away. Read once, reused for every send.
 */
const LOGO_CID = 'dbug-logo'
let logoAttachment
function getLogo() {
  if (logoAttachment === undefined) {
    try {
      logoAttachment = {
        filename: 'dbug-labs.png',
        content: readFileSync(join(process.cwd(), 'public', 'logo.png')),
        cid: LOGO_CID,
        contentDisposition: 'inline',
      }
    } catch (err) {
      console.warn('[email] logo not found, falling back to text mark:', err.message)
      logoAttachment = null
    }
  }
  return logoAttachment
}

// Read lazily so scripts can flip EMAIL_DRY_RUN before calling in.
const isDryRun = () => process.env.EMAIL_DRY_RUN === 'true'
const from     = () => process.env.EMAIL_FROM ?? 'recruitment@yourdomain.com'

// ─── Nodemailer client ────────────────────────────────────────────────────────

let transporter = null
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }
  return transporter
}

// ─── Internal send helper ─────────────────────────────────────────────────────

/**
 * @param {{ to: string, subject: string, html: string, text: string }} payload
 */
async function sendEmail(payload) {
  if (isDryRun()) {
    console.log('[email:dry-run] Would send email:')
    console.log(`  To:      ${payload.to}`)
    console.log(`  Subject: ${payload.subject}`)
    console.log(`  Text:\n${payload.text}`)
    return { id: `dry-run-${Date.now()}` }
  }

  const mailer = getTransporter()
  const logo = getLogo()
  try {
    const info = await mailer.sendMail({
      from:    from(),
      to:      payload.to,
      subject: payload.subject,
      html:    payload.html,
      text:    payload.text,
      ...(logo ? { attachments: [logo] } : {}),
    })
    return info
  } catch (error) {
    console.error('[email] Nodemailer error:', error)
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

// ─── Template helpers ─────────────────────────────────────────────────────────

function baseHtml(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           background: #0d0a0f; color: #e8e0ec; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 40px 24px; }
    .header  { text-align: center; padding-bottom: 28px; border-bottom: 1px solid #2a1f2e; }
    .logo    { font-size: 21px; font-weight: 700; color: #ff3a58; letter-spacing: 1.5px;
               margin-top: 10px; }
    .logoImg { display: block; margin: 0 auto; width: 56px; height: 56px; border: 0; }
    .body    { padding: 32px 0; }
    .footer  { padding-top: 24px; border-top: 1px solid #2a1f2e;
               font-size: 13px; color: #7a6d7e; text-align: center; }
    .badge   { display: inline-block; background: #1c0f22; border: 1px solid #3d1f4a;
               border-radius: 6px; padding: 10px 18px; font-family: monospace;
               font-size: 15px; color: #b06bff; letter-spacing: 2px; margin: 16px 0; }
    h2       { color: #f2ebf4; margin: 0 0 16px; }
    p        { line-height: 1.6; color: #cec2d1; margin: 0 0 14px; }
    a        { color: #ff3a58; }
    .btn     { display: inline-block; background: linear-gradient(135deg, #ff3a58, #b06bff);
               color: #fff !important; padding: 12px 28px; border-radius: 8px;
               text-decoration: none; font-weight: 600; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <img src="cid:${LOGO_CID}" alt="dBug Labs" class="logoImg" width="56" height="56" />
      <div class="logo">dBUG LABS</div>
    </div>
    <div class="body">${bodyHtml}</div>
    <div class="footer">
      dBug Labs Recruitment 2026 &bull; This is an automated message, please do not reply.
    </div>
  </div>
</body>
</html>`
}

// ─── Exported email functions ─────────────────────────────────────────────────

/**
 * Sent immediately after a successful application submission.
 *
 * @param {{ name: string, email: string, applicationId: string, domains: string[], password?: string }} data
 */
export async function sendApplicationConfirmation({ name, email, applicantId, domains, password, dueAt }) {
  const subject  = 'Application Received — dBug Labs Recruitment 2026'
  const domainList = domains.join(', ')
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const dueStr = dueAt
    ? new Date(dueAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' })
    : null

  const text = `Hi ${name},\n\nWe've received your application for dBug Labs Recruitment 2026!\n\n`
    + `Your applicant ID: ${applicantId}\nDomain preferences: ${domainList}\n\n`
    + `Dashboard password: ${password}\nLog in at ${baseUrl}/login with your SRM email and this password.\n\n`
    + (dueStr ? `Your task is due by ${dueStr}. Everyone gets 5 days from the moment they apply, so your clock has already started.\n\n` : '')
    + `dBug Labs Team`

  const html = baseHtml(subject, `
    <h2>Application Received!</h2>
    <p>Hi <strong>${escapeHtml(name)}</strong>,</p>
    <p>We've successfully received your application for <strong>dBug Labs Recruitment 2026</strong>. 🎉</p>
    <p>Your applicant ID — quote this in any email to us:</p>
    <div class="badge">${applicantId}</div>
    <p>Domain preferences: <strong>${escapeHtml(domainList)}</strong></p>
    <p><strong>Dashboard password:</strong>
      <code style="background:rgba(255,45,79,0.2);padding:4px 8px;border-radius:4px;color:#ff8fa3">${password}</code>
    </p>
    <p>Log in with your SRM email and the password above to track your status.</p>
    <a href="${baseUrl}/login" class="btn">Login to Dashboard →</a>
    ${dueStr ? `
    <div style="margin-top:26px;padding:16px 18px;border:1px solid #3d1f4a;border-radius:8px;background:#160c1b">
      <div style="font-size:12px;letter-spacing:1.5px;color:#7a6d7e;margin-bottom:6px">YOUR TASK DEADLINE</div>
      <div style="font-size:17px;color:#ff8fa3;font-weight:600">${dueStr}</div>
      <p style="margin:10px 0 0;font-size:14px">
        Everyone gets <strong>5 days from the moment they apply</strong> — your clock has already started.
        The brief appears on your dashboard; submit a GitHub or Drive link before the deadline.
      </p>
    </div>` : ''}
    <p style="margin-top:20px">Keep an eye on your inbox — everything after this comes by email too.</p>
    <p>All the best,<br/><strong>dBug Labs Team</strong></p>
  `)
  return sendEmail({ to: email, subject, html, text })
}

/**
 * Sent when a task is assigned to a shortlisted candidate.
 *
 * @param {{ name: string, email: string, taskTitle: string, dueAt: Date|string, dashboardUrl: string }} data
 */
export async function sendTaskNotification({ name, email, taskTitle, dueAt, dashboardUrl }) {
  const subject  = `Task Assigned: ${taskTitle} — dBug Labs`
  const dueStr   = new Date(dueAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' })
  const text = `Hi ${name},\n\nYou have been assigned a task: "${taskTitle}"\n\nDeadline: ${dueStr}\n\nLog in to your dashboard to view the task details and submit your work:\n${dashboardUrl}\n\ndBug Labs Team`
  const html = baseHtml(subject, `
    <h2>Task Assigned!</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>You've been shortlisted and assigned a task for dBug Labs Recruitment 2026!</p>
    <p><strong>Task:</strong> ${taskTitle}</p>
    <p><strong>Deadline:</strong> ${dueStr}</p>
    <p>Log in to your dashboard to view the full task brief and submit your work:</p>
    <a href="${dashboardUrl}" class="btn">Open Dashboard →</a>
    <p style="margin-top:20px">Good luck! We're excited to see what you build.</p>
    <p><strong>dBug Labs Team</strong></p>
  `)
  return sendEmail({ to: email, subject, html, text })
}

/**
 * Sent as a reminder before the task deadline.
 *
 * @param {{ name: string, email: string, taskTitle: string, dueAt: Date|string, dashboardUrl: string }} data
 */
export async function sendDeadlineReminder({ name, email, taskTitle, dueAt, dashboardUrl }) {
  const subject = `Reminder: Task Due Soon — ${taskTitle}`
  const dueStr  = new Date(dueAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' })
  const text = `Hi ${name},\n\nThis is a reminder that your task "${taskTitle}" is due on ${dueStr}.\n\nSubmit your work here: ${dashboardUrl}\n\ndBug Labs Team`
  const html = baseHtml(subject, `
    <h2>⏰ Deadline Reminder</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>Just a reminder — your task <strong>"${taskTitle}"</strong> is due on <strong>${dueStr}</strong>.</p>
    <p>Make sure to submit before the deadline!</p>
    <a href="${dashboardUrl}" class="btn">Submit Now →</a>
    <p style="margin-top:20px"><strong>dBug Labs Team</strong></p>
  `)
  return sendEmail({ to: email, subject, html, text })
}

/**
 * Sent when an admin pushes a candidate's task deadline back.
 *
 * @param {{ name: string, email: string, taskTitle: string, dueAt: Date|string, dashboardUrl: string, reason?: string }} data
 */
export async function sendDeadlineExtended({ name, email, taskTitle, dueAt, dashboardUrl, reason }) {
  const subject = `More time on your task — dBug Labs`
  const dueStr = new Date(dueAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' })
  const text = `Hi ${name},\n\nWe've extended your deadline for "${taskTitle}".\n\nNew deadline: ${dueStr}\n`
    + (reason ? `\nNote: ${reason}\n` : '')
    + `\nSubmit here: ${dashboardUrl}\n\ndBug Labs Team`
  const html = baseHtml(subject, `
    <h2>You have more time</h2>
    <p>Hi <strong>${escapeHtml(name)}</strong>,</p>
    <p>We've pushed back your deadline for <strong>${escapeHtml(taskTitle)}</strong>.</p>
    <div style="margin:20px 0;padding:16px 18px;border:1px solid #3d1f4a;border-radius:8px;background:#160c1b">
      <div style="font-size:12px;letter-spacing:1.5px;color:#7a6d7e;margin-bottom:6px">NEW DEADLINE</div>
      <div style="font-size:17px;color:#ff8fa3;font-weight:600">${dueStr}</div>
    </div>
    ${reason ? `<p>${escapeHtml(reason)}</p>` : ''}
    <a href="${dashboardUrl}" class="btn">Open your task →</a>
    <p style="margin-top:20px"><strong>dBug Labs Team</strong></p>
  `)
  return sendEmail({ to: email, subject, html, text })
}

/**
 * Sent when an interview is scheduled.
 *
 * @param {{ name: string, email: string, slotAt: Date|string, mode: string, location: string }} data
 */
export async function sendInterviewInvitation({ name, email, slotAt, mode, location }) {
  const subject = 'Interview Scheduled — dBug Labs Recruitment 2026'
  const slotStr = new Date(slotAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' })
  const modeLabel = mode === 'online' ? 'Online (Video Call)' : 'Offline (In-Person)'
  const text = `Hi ${name},\n\nCongratulations! You have been shortlisted for an interview.\n\nDate & Time: ${slotStr}\nMode: ${modeLabel}\nLocation / Link: ${location}\n\ndBug Labs Team`
  const html = baseHtml(subject, `
    <h2>🎉 You're Invited to an Interview!</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>Congratulations! You've been shortlisted and we'd love to meet you.</p>
    <p><strong>Date & Time:</strong> ${slotStr}</p>
    <p><strong>Mode:</strong> ${modeLabel}</p>
    <p><strong>${mode === 'online' ? 'Meeting Link' : 'Venue'}:</strong> ${location}</p>
    <p>Please confirm your availability. We look forward to speaking with you!</p>
    <p><strong>dBug Labs Team</strong></p>
  `)
  return sendEmail({ to: email, subject, html, text })
}

/**
 * Sent when a candidate is shortlisted for an interview (before slot assignment).
 *
 * @param {{ name: string, email: string }} data
 */
export async function sendInterviewShortlist({ name, email }) {
  const subject = 'You are Shortlisted! — dBug Labs Recruitment 2026'
  const text = `Hi ${name},\n\nCongratulations! You have been shortlisted for an interview.\n\nWe will reach out to you shortly with the interview date, time, and mode.\n\ndBug Labs Team`
  const html = baseHtml(subject, `
    <h2>🎉 You're Shortlisted!</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>Congratulations! Your application and task submission stood out, and you have been shortlisted for an interview with the dBug Labs core team.</p>
    <p>We are currently preparing the interview schedule. You will receive another email shortly with your interview date, time, and mode details.</p>
    <p>Get ready to showcase your skills and passion. We look forward to speaking with you soon!</p>
    <p style="margin-top:20px"><strong>dBug Labs Team</strong></p>
  `)
  return sendEmail({ to: email, subject, html, text })
}

/**
 * The six-digit OTP that verifies an SRM email on the application form.
 * Lives here so it gets the same shell, logo and dry-run behaviour as the rest.
 *
 * @param {{ email: string, otp: string }} data
 */
export async function sendOtp({ email, otp }) {
  const subject = 'Your OTP — dBug Labs Recruitment 2026'
  const text = `Your OTP for dBug Labs Recruitment is: ${otp}\nIt expires in 10 minutes. Do not share it with anyone.`
  const html = baseHtml(subject, `
    <div style="text-align:center">
      <h2>Email Verification</h2>
      <p>Use this code to verify your SRM email address:</p>
      <div style="display:inline-block;background:#1c0f22;border:1px solid #3d1f4a;border-radius:10px;
                  padding:16px 34px;font-family:monospace;font-size:31px;color:#b06bff;
                  letter-spacing:8px;margin:20px 0">${otp}</div>
      <p>It expires in <strong>10 minutes</strong>.<br/>Do not share this code with anyone.</p>
    </div>
  `)
  return sendEmail({ to: email, subject, html, text })
}

/**
 * Free-form announcement sent from the admin panel to a filtered audience.
 *
 * @param {{ name: string, email: string, subject: string, message: string }} data
 */
export async function sendAnnouncement({ name, email, subject, message }) {
  const greeting = name ? `Hi ${name},` : 'Hi,'
  const text = `${greeting}\n\n${message}\n\ndBug Labs Team`
  const paragraphs = message
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('')
  const html = baseHtml(subject, `
    <h2>${escapeHtml(subject)}</h2>
    <p>${escapeHtml(greeting)}</p>
    ${paragraphs}
    <p style="margin-top:20px"><strong>dBug Labs Team</strong></p>
  `)
  return sendEmail({ to: email, subject, html, text })
}

/**
 * Sent when a candidate's application is shortlisted after initial review.
 *
 * @param {{ name: string, email: string }} data
 */
export async function sendShortlistNotification({ name, email }) {
  const subject = 'You\'re Shortlisted! — dBug Labs Recruitment 2026'
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const text = `Hi ${name},\n\nGreat news! Your application has been reviewed and you have been shortlisted for the next stage of dBug Labs Recruitment 2026.\n\nYou will receive a task assignment shortly. Keep an eye on your dashboard and inbox.\n\nLog in: ${baseUrl}/login\n\ndBug Labs Team`
  const html = baseHtml(subject, `
    <h2>🎉 You're Shortlisted!</h2>
    <p>Hi <strong>${escapeHtml(name)}</strong>,</p>
    <p>Great news — your application has been reviewed and you've been <strong>shortlisted</strong> for the next stage of dBug Labs Recruitment 2026!</p>
    <p>Here's what happens next:</p>
    <div style="margin:20px 0;padding:16px 18px;border:1px solid #3d1f4a;border-radius:8px;background:#160c1b">
      <div style="font-size:14px;color:#cec2d1;line-height:1.8">
        📋 You'll receive a <strong>task assignment</strong> shortly<br/>
        ⏰ You'll have <strong>5 days</strong> to complete and submit it<br/>
        💻 Everything will appear on your <strong>dashboard</strong>
      </div>
    </div>
    <p>Keep an eye on your inbox — your task details are on the way.</p>
    <a href="${baseUrl}/login" class="btn">Open Dashboard →</a>
    <p style="margin-top:20px"><strong>dBug Labs Team</strong></p>
  `)
  return sendEmail({ to: email, subject, html, text })
}

/**
 * Sent to confirm receipt of a candidate's task submission.
 *
 * @param {{ name: string, email: string, taskTitle: string, late: boolean }} data
 */
export async function sendTaskSubmissionReceipt({ name, email, taskTitle, late }) {
  const subject = `Task Submitted${late ? ' (Late)' : ''} — dBug Labs Recruitment 2026`
  const text = `Hi ${name},\n\nWe've received your submission for "${taskTitle}".${late ? ' Note: This was submitted after the deadline.' : ''}\n\nOur team will review it and get back to you with next steps.\n\ndBug Labs Team`
  const html = baseHtml(subject, `
    <h2>📬 Submission Received!</h2>
    <p>Hi <strong>${escapeHtml(name)}</strong>,</p>
    <p>We've received your submission for <strong>${escapeHtml(taskTitle)}</strong>.</p>
    ${late ? '<p style="color:#ff8fa3">⚠️ <strong>Note:</strong> This was submitted after the deadline.</p>' : ''}
    <div style="margin:20px 0;padding:16px 18px;border:1px solid #3d1f4a;border-radius:8px;background:#160c1b">
      <div style="font-size:14px;color:#cec2d1;line-height:1.8">
        ✅ Submission recorded<br/>
        🔍 Our team will review your work<br/>
        📧 You'll hear from us with the next steps
      </div>
    </div>
    <p>Sit tight — we'll be in touch soon.</p>
    <p style="margin-top:20px"><strong>dBug Labs Team</strong></p>
  `)
  return sendEmail({ to: email, subject, html, text })
}

/** Minimal HTML escaping for admin-authored copy dropped into templates. */
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Sent when the final outcome is recorded for a candidate.
 *
 * @param {{ name: string, email: string, selected: boolean, onboardingUrl?: string }} data
 */
export async function sendResultNotification({ name, email, selected, onboardingUrl }) {
  if (selected) {
    const subject = '🎉 Welcome to dBug Labs!'
    const text = `Hi ${name},\n\nWe are thrilled to let you know that you have been selected to join dBug Labs! 🎉\n\nWelcome to the team!\n\ndBug Labs Team`
    const html = baseHtml(subject, `
      <h2>🎉 You Made It!</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>We are absolutely thrilled to let you know that you have been <strong>selected to join dBug Labs</strong> for the 2026 cohort!</p>
      <p>Welcome to the team — we can't wait to build amazing things together.</p>
      ${onboardingUrl ? `<a href="${onboardingUrl}" class="btn">Complete Onboarding →</a>` : ''}
      <p style="margin-top:20px"><strong>dBug Labs Team</strong></p>
    `)
    return sendEmail({ to: email, subject, html, text })
  } else {
    const subject = 'dBug Labs Recruitment 2026 — Application Update'
    const text = `Hi ${name},\n\nThank you for your interest in dBug Labs. After careful consideration, we're unable to move forward with your application at this time.\n\nWe genuinely appreciate the time and effort you put into applying and we hope to see you again in future cycles.\n\ndBug Labs Team`
    const html = baseHtml(subject, `
      <h2>Thank You for Applying</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>Thank you for your interest in dBug Labs and the time you invested in your application.</p>
      <p>After careful consideration, we are unable to move forward with your application for this recruitment cycle.</p>
      <p>We genuinely appreciate your enthusiasm and encourage you to keep building and learning. We hope to see you again in future cycles!</p>
      <p><strong>dBug Labs Team</strong></p>
    `)
    return sendEmail({ to: email, subject, html, text })
  }
}
