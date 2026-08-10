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
 */

const DRY_RUN = process.env.EMAIL_DRY_RUN === 'true'
const FROM    = process.env.EMAIL_FROM ?? 'recruitment@yourdomain.com'

// ─── Nodemailer client (lazy) ─────────────────────────────────────────────────

let transporter = null
function getTransporter() {
  if (DRY_RUN) return null
  if (!transporter) {
    const nodemailer = require('nodemailer')
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
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
  if (DRY_RUN) {
    console.log('[email:dry-run] Would send email:')
    console.log(`  To:      ${payload.to}`)
    console.log(`  Subject: ${payload.subject}`)
    console.log(`  Text:\n${payload.text}`)
    return { id: `dry-run-${Date.now()}` }
  }

  const mailer = getTransporter()
  try {
    const info = await mailer.sendMail({
      from:    FROM,
      to:      payload.to,
      subject: payload.subject,
      html:    payload.html,
      text:    payload.text,
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
    .header  { text-align: center; padding-bottom: 32px; border-bottom: 1px solid #2a1f2e; }
    .logo    { font-size: 22px; font-weight: 700; color: #ff3a58; letter-spacing: 1px; }
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
      <div class="logo">🕷 dBug Labs</div>
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
export async function sendApplicationConfirmation({ name, email, applicationId, domains, password }) {
  const subject  = 'Application Received — dBug Labs Recruitment 2026'
  const domainList = domains.join(', ')
  const text = `Hi ${name},\n\nWe've received your application for dBug Labs Recruitment 2026!\n\nYour application reference ID is: ${applicationId}\nDomain preferences: ${domainList}\n\nDashboard Password: ${password}\nUse your email and this password to log in and track your status.\n\nWe'll review your application and get back to you soon.\n\ndBug Labs Team`
  const html = baseHtml(subject, `
    <h2>Application Received!</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>We've successfully received your application for <strong>dBug Labs Recruitment 2026</strong>. 🎉</p>
    <p>Your reference ID:</p>
    <div class="badge">${applicationId}</div>
    <p>Domain preferences: <strong>${domainList}</strong></p>
    <p><strong>Dashboard Password:</strong> <code style="background:rgba(255,45,79,0.2);padding:4px 8px;border-radius:4px;color:var(--pink)">${password}</code></p>
    <p>Use your email and the password above to log in to your dashboard and track your status.</p>
    <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/login" class="btn">Login to Dashboard →</a>
    <p style="margin-top:20px">Our team will review your application and reach out to you with the next steps. Keep an eye on your inbox!</p>
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
