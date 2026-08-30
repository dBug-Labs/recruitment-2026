/**
 * lib/email/index.js
 *
 * Every message the drive sends, and nothing about how it gets sent.
 *
 * Templates hand their rendered output to `dispatch()` in lib/email/outbox.js,
 * which writes it down before attempting delivery and rations the shared SMTP
 * budget. Each call declares a `kind`; the outbox reads that to decide what may
 * spend the reserve — see the header of outbox.js for why the reserve exists.
 *
 * When EMAIL_DRY_RUN=true nothing is sent or stored, only logged.
 *
 * Exports one function per lifecycle event:
 *   sendApplicationConfirmation(data)
 *   sendTaskNotification(data)
 *   sendDeadlineReminder(data)
 *   sendDeadlineExtended(data)          — pass bulk:true for a mass extension
 *   sendInterviewShortlist(data)
 *   sendInterviewInvitation(data)
 *   sendResultNotification(data)
 *   sendShortlistNotification(data)
 *   sendTaskSubmissionReceipt(data)
 *   sendOtp(data)
 *   sendAnnouncement(data)
 */

import { dispatch, PRIORITY } from './outbox.js'
import { LOGO_CID } from './transport.js'
import { domainLabel } from '../schemas.js'

/**
 * The WhatsApp group everyone who reaches the interview stage is asked to join.
 *
 * Both interview mails carry it — the shortlist notice and the invitation with
 * the slot — because a candidate may receive either one first depending on
 * whether a slot existed when they were moved. Defined once so rotating the
 * invite is a one-line change; a stale link here is silent, since a dead
 * WhatsApp invite still renders as a perfectly ordinary button.
 */
const INTERVIEW_GROUP_URL = 'https://chat.whatsapp.com/CdfY1j3NFVXBKb1w1yiFtM'

export { flushOutbox, quotaSnapshot, outboxSummary } from './outbox.js'

// ─── Internal send helper ─────────────────────────────────────────────────────

/**
 * @param {{ to: string, subject: string, html: string, text: string }} payload
 * @param {{ kind?: string, priority?: number, retry?: boolean, background?: boolean }} [options]
 */
async function sendEmail(payload, options = {}) {
  return dispatch(payload, options)
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
 * `resend: true` prepends a banner saying the password is a new one and any
 * earlier email is now stale — scripts/resend-confirmations.mjs sets it, since
 * a rotated password with no warning just reads as a duplicate to ignore.
 *
 * @param {{ name: string, email: string, applicantId: string, domains: string[],
 *           password?: string, dueAt?: Date|string, resend?: boolean }} data
 */
export async function sendApplicationConfirmation({ name, email, applicantId, domains, password, dueAt, resend = false }) {
  const subject  = 'Application Received — dBug Labs Recruitment 2026'
  const domainList = domains.join(', ')
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const dueStr = dueAt
    ? new Date(dueAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' })
    : null

  // On a resend the password below is a new one and any earlier email is now
  // wrong. Saying so up front saves a round of "my password doesn't work".
  const resendNoteText = resend
    ? `NOTE: This replaces any earlier email from us. The password below is a new one — `
      + `an older password will no longer work, and the deadline shown here is the one that counts.\n\n`
    : ''

  const clockLine = resend
    ? `Everyone now has ${dueStr ? 'until the date above' : 'the same window'} — the clock was reset for all applicants, so you have the full window from today.`
    : `Everyone gets 5 days from the moment they apply, so your clock has already started.`

  const text = `Hi ${name},\n\n`
    + resendNoteText
    + `We've received your application for dBug Labs Recruitment 2026!\n\n`
    + `Your applicant ID: ${applicantId}\nDomain preferences: ${domainList}\n\n`
    + `Dashboard password: ${password}\nLog in at ${baseUrl}/login with your SRM email and this password.\n\n`
    + (dueStr ? `Your task is due by ${dueStr}. ${clockLine}\n\n` : '')
    + (domains.length > 1
        ? `You picked two domains, so there is a brief for each on your dashboard — submit a link for both.\n\n`
        : '')
    + `dBug Labs Team`

  const html = baseHtml(subject, `
    <h2>Application Received!</h2>
    <p>Hi <strong>${escapeHtml(name)}</strong>,</p>
    ${resend ? `
    <div style="margin:0 0 20px;padding:14px 16px;border:1px solid rgba(255,45,79,.4);border-radius:8px;
                background:rgba(255,45,79,.1)">
      <p style="margin:0;font-size:14.5px;color:#ffc2cd">
        <strong>This replaces any earlier email from us.</strong> The password below is a new one —
        an older password will no longer work — and the deadline shown here is the one that counts.
      </p>
    </div>` : ''}
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
        ${resend
          ? 'The clock was reset for every applicant, so you have the full window from today.'
          : 'Everyone gets <strong>5 days from the moment they apply</strong> — your clock has already started.'}
        ${domains.length > 1
          ? 'You picked two domains, so there is <strong>a brief for each</strong> on your dashboard — submit a GitHub or Drive link for both before the deadline.'
          : 'The brief appears on your dashboard; submit a GitHub or Drive link before the deadline.'}
      </p>
    </div>` : ''}
    <p style="margin-top:20px">Keep an eye on your inbox — everything after this comes by email too.</p>
    <p>All the best,<br/><strong>dBug Labs Team</strong></p>
  `)
  // The only copy of the plaintext password. It jumps the queue and may spend
  // the reserve — a candidate who never gets this one can never log in.
  return sendEmail({ to: email, subject, html, text }, {
    kind: 'confirmation', priority: PRIORITY.HIGH,
  })
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
  return sendEmail({ to: email, subject, html, text }, { kind: 'task' })
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
  return sendEmail({ to: email, subject, html, text }, { kind: 'deadline' })
}

/**
 * Sent when an admin pushes a candidate's task deadline back.
 *
 * `bulk: true` marks it as one of a mass extension. That sends it under a
 * different kind, which is deliberately *not* in the outbox's CRITICAL_KINDS:
 * a blast to two hundred candidates then stops at the reserve instead of
 * eating the slots that carry dashboard passwords. Nobody is stranded by that
 * — the new date is already on their dashboard, and the queued mail goes out
 * after the budget rolls over at IST midnight.
 *
 * `background: true` queues without waiting for SMTP. Only pass it when
 * something else will drain the outbox (`npm run flush-outbox`).
 *
 * @param {{ name: string, email: string, taskTitle: string, dueAt: Date|string,
 *           dashboardUrl: string, reason?: string, bulk?: boolean, background?: boolean }} data
 */
export async function sendDeadlineExtended({ name, email, taskTitle, dueAt, dashboardUrl, reason, bulk = false, background = false }) {
  const subject = `More time on your task — dBug Labs`
  const dueStr = new Date(dueAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' })
  const text = `Hi ${name},\n\nWe've extended your deadline for "${taskTitle}".\n\nNew deadline: ${dueStr}\n`
    + (reason ? `\nNote: ${reason}\n` : '')
    + `\nJust one task per domain: the brief lists several, and you only have to complete`
    + ` ONE of them. Pick whichever suits you best — you are not expected to do them all.`
    + ` If you applied to two domains, that is one task in each.\n`
    + `\nSubmit here: ${dashboardUrl}\n\ndBug Labs Team`
  const html = baseHtml(subject, `
    <h2>You have more time</h2>
    <p>Hi <strong>${escapeHtml(name)}</strong>,</p>
    <p>We've pushed back your deadline for <strong>${escapeHtml(taskTitle)}</strong>.</p>
    <div style="margin:20px 0;padding:16px 18px;border:1px solid #3d1f4a;border-radius:8px;background:#160c1b">
      <div style="font-size:12px;letter-spacing:1.5px;color:#7a6d7e;margin-bottom:6px">NEW DEADLINE</div>
      <div style="font-size:17px;color:#ff8fa3;font-weight:600">${dueStr}</div>
    </div>
    <div style="margin:20px 0;padding:16px 18px;border:1px solid #3d1f4a;border-radius:8px;background:#160c1b">
      <div style="font-size:12px;letter-spacing:1.5px;color:#7a6d7e;margin-bottom:8px">JUST ONE TASK PER DOMAIN</div>
      <div style="font-size:14px;color:#cec2d1;line-height:1.7">
        The brief lists several tasks — you only have to complete
        <strong style="color:#f2ebf4">one</strong> of them. Choose whichever suits you best
        and submit that. You are <strong style="color:#f2ebf4">not</strong> expected to do them all.<br/>
        Applied to two domains? That&rsquo;s one task in each.
      </div>
    </div>
    ${reason ? `<p>${escapeHtml(reason)}</p>` : ''}
    <a href="${dashboardUrl}" class="btn">Open your task →</a>
    <p style="margin-top:20px"><strong>dBug Labs Team</strong></p>
  `)
  return sendEmail({ to: email, subject, html, text }, bulk
    ? { kind: 'deadline-extended-bulk', priority: PRIORITY.LOW, background }
    : { kind: 'deadline-extended', background })
}

/**
 * Sent when an interview is scheduled.
 *
 * @param {{ name: string, email: string, slotAt: Date|string, mode: string, location: string }} data
 */
export async function sendInterviewInvitation({ name, email, slotAt, mode, location, domain }) {
  const subject = 'Interview Scheduled — dBug Labs Recruitment 2026'
  const slotStr = new Date(slotAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' })
  const modeLabel = mode === 'online' ? 'Online (Video Call)' : 'Offline (In-Person)'
  const text = `Hi ${name},\n\nCongratulations! You have been shortlisted for a${domain ? ' ' + domainLabel(domain) : 'n'} interview.\n\nDate & Time: ${slotStr}\nMode: ${modeLabel}\nLocation / Link: ${location}\n`
    + `\nIMPORTANT: Join the interviews WhatsApp group — all further updates, any`
    + ` change of slot, and last-minute instructions go out there.\n${INTERVIEW_GROUP_URL}\n`
    + `\ndBug Labs Team`
  const html = baseHtml(subject, `
    <h2>🎉 You're Invited to an Interview!</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>Congratulations! You've been shortlisted ${domain ? `for the <strong>${domainLabel(domain)}</strong> domain ` : ''}and we'd love to meet you.</p>
    <p><strong>Date & Time:</strong> ${slotStr}</p>
    <p><strong>Mode:</strong> ${modeLabel}</p>
    <p><strong>${mode === 'online' ? 'Meeting Link' : 'Venue'}:</strong> ${location}</p>
    <div style="margin:24px 0;padding:16px 18px;border:1px solid #3d1f4a;border-radius:8px;background:#160c1b">
      <div style="font-size:12px;letter-spacing:1.5px;color:#7a6d7e;margin-bottom:8px">ONE MORE THING</div>
      <div style="font-size:14px;color:#cec2d1;line-height:1.7;margin-bottom:14px">
        Join the interviews WhatsApp group. Every further update — any change of slot,
        and the last-minute instructions before your round — goes out there.
      </div>
      <a href="${INTERVIEW_GROUP_URL}" class="btn" style="margin-top:0">Join the WhatsApp group →</a>
      <div style="font-size:12px;color:#7a6d7e;margin-top:12px;word-break:break-all">
        ${INTERVIEW_GROUP_URL}
      </div>
    </div>
    <p>Please confirm your availability. We look forward to speaking with you!</p>
    <p><strong>dBug Labs Team</strong></p>
  `)
  return sendEmail({ to: email, subject, html, text }, { kind: 'interview' })
}

/**
 * Sent when a candidate is shortlisted for an interview (before slot assignment).
 *
 * @param {{ name: string, email: string }} data
 */
export async function sendInterviewShortlist({ name, email, domain }) {
  const subject = 'You are Shortlisted! — dBug Labs Recruitment 2026'
  const text = `Hi ${name},\n\nCongratulations! You have been shortlisted for a${domain ? ' ' + domainLabel(domain) : 'n'} interview.\n\nWe will reach out to you shortly with the interview date, time, and mode.\n`
    + `\nIMPORTANT: Join the interviews WhatsApp group — your slot and every`
    + ` further update go out there.\n${INTERVIEW_GROUP_URL}\n`
    + `\ndBug Labs Team`
  const html = baseHtml(subject, `
    <h2>🎉 You're Shortlisted!</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>Congratulations! Your application and task submission stood out, and you have been shortlisted for a${domain ? ` <strong>${domainLabel(domain)}</strong>` : 'n'} interview with the dBug Labs core team.</p>
    <p>We are currently preparing the interview schedule. You will receive another email shortly with your interview date, time, and mode details.</p>
    <div style="margin:24px 0;padding:16px 18px;border:1px solid #3d1f4a;border-radius:8px;background:#160c1b">
      <div style="font-size:12px;letter-spacing:1.5px;color:#7a6d7e;margin-bottom:8px">JOIN THIS FIRST</div>
      <div style="font-size:14px;color:#cec2d1;line-height:1.7;margin-bottom:14px">
        Everyone at the interview stage is in the WhatsApp group. Your slot and every
        update after it go out there — join now so you do not miss yours.
      </div>
      <a href="${INTERVIEW_GROUP_URL}" class="btn" style="margin-top:0">Join the WhatsApp group →</a>
      <div style="font-size:12px;color:#7a6d7e;margin-top:12px;word-break:break-all">
        ${INTERVIEW_GROUP_URL}
      </div>
    </div>
    <p>Get ready to showcase your skills and passion. We look forward to speaking with you soon!</p>
    <p style="margin-top:20px"><strong>dBug Labs Team</strong></p>
  `)
  return sendEmail({ to: email, subject, html, text }, { kind: 'shortlist' })
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
  // retry: false — a code that turns up after its ten minutes is worse than
  // none, so a failed OTP is dead rather than queued. Capped below the reserve
  // so OTP traffic can never starve confirmations.
  return sendEmail({ to: email, subject, html, text }, {
    kind: 'otp', priority: PRIORITY.LOW, retry: false,
  })
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
  // Announcements go out in bulk, so they queue behind anything transactional
  // and stop at the reserve rather than eating the day's whole allowance.
  return sendEmail({ to: email, subject, html, text }, {
    kind: 'announcement', priority: PRIORITY.LOW,
  })
}

/**
 * Sent when a candidate's application is shortlisted after initial review.
 *
 * @param {{ name: string, email: string }} data
 */
export async function sendShortlistNotification({ name, email, domain }) {
  const subject = 'You\'re Shortlisted! — dBug Labs Recruitment 2026'
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const text = `Hi ${name},\n\nGreat news! Your application has been reviewed and you have been shortlisted for the next stage of dBug Labs Recruitment 2026${domain ? ` in the ${domainLabel(domain)} domain` : ''}.\n\nYou will receive a task assignment shortly. Keep an eye on your dashboard and inbox.\n\nLog in: ${baseUrl}/login\n\ndBug Labs Team`
  const html = baseHtml(subject, `
    <h2>🎉 You're Shortlisted!</h2>
    <p>Hi <strong>${escapeHtml(name)}</strong>,</p>
    <p>Great news — your application has been reviewed and you've been <strong>shortlisted</strong> for the next stage of dBug Labs Recruitment 2026${domain ? ` for the <strong>${domainLabel(domain)}</strong> domain` : ''}!</p>
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
  return sendEmail({ to: email, subject, html, text }, { kind: 'shortlist' })
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
  return sendEmail({ to: email, subject, html, text }, { kind: 'submission-receipt' })
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
    return sendEmail({ to: email, subject, html, text }, { kind: 'result' })
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
    return sendEmail({ to: email, subject, html, text }, { kind: 'result' })
  }
}
