/**
 * lib/email/transport.js
 *
 * The raw SMTP pipe — nodemailer, the inline logo, and the rules for telling a
 * temporary failure apart from a permanent one.
 *
 * Nothing here knows about queues, quotas or templates; lib/email/outbox.js
 * layers those on top and lib/email/index.js writes the messages.
 *
 * Imports stay relative so `node scripts/*.mjs` can pull this in directly —
 * the `@/` alias only resolves inside the Next build.
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
export const LOGO_CID = 'dbug-logo'
let logoAttachment

export function getLogo() {
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
export const isDryRun = () => process.env.EMAIL_DRY_RUN === 'true'
export const mailFrom = () => process.env.EMAIL_FROM ?? 'recruitment@yourdomain.com'

// ─── Nodemailer client ────────────────────────────────────────────────────────

let transporter = null

export function getTransporter() {
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

/**
 * Puts one message on the wire. Throws on any SMTP or network failure —
 * classifying that failure is the caller's job, see isRetryable / isQuotaError.
 *
 * @param {{ to: string, subject: string, html: string, text: string }} payload
 */
export async function deliver(payload) {
  const mailer = getTransporter()
  const logo   = getLogo()
  return mailer.sendMail({
    from:    mailFrom(),
    to:      payload.to,
    subject: payload.subject,
    html:    payload.html,
    text:    payload.text,
    ...(logo ? { attachments: [logo] } : {}),
  })
}

// ─── Failure classification ───────────────────────────────────────────────────

/** Socket-level problems that say nothing about the message itself. */
const RETRYABLE_NET_CODES = new Set([
  'ECONNECTION', 'ECONNRESET', 'ETIMEDOUT', 'ESOCKET', 'EAI_AGAIN', 'EDNS', 'ECONNREFUSED',
])

/** How Gmail words "you have sent as much as you may send today". */
const QUOTA_PATTERN = /5\.4\.5|daily (?:user )?sending (?:quota|limit)|rate limit|too many (?:messages|login)/i

function replyText(error) {
  return String(error?.response ?? error?.message ?? '')
}

/**
 * True when the provider is refusing *for now* — the send is worth another go
 * later. Everything else (a bad address, a rejected sender) is permanent and
 * retrying only burns quota.
 *
 * @param {unknown} error
 */
export function isRetryable(error) {
  if (!error) return false

  const status = error.responseCode
  if (typeof status === 'number') {
    // 4xx in SMTP means "transient, try again"; 5xx means "do not bother".
    if (status >= 400 && status < 500) return true
    // …except Gmail, which reports its daily cap as a permanent-looking 550.
    if (QUOTA_PATTERN.test(replyText(error))) return true
    return false
  }

  return RETRYABLE_NET_CODES.has(String(error.code))
}

/**
 * True when the failure is specifically "the account is out of sends".
 * The outbox stops the whole drain on these rather than working through the
 * backlog one doomed message at a time.
 *
 * @param {unknown} error
 */
export function isQuotaError(error) {
  if (!error) return false
  if (error.code === 'EMAIL_QUOTA') return true
  return QUOTA_PATTERN.test(replyText(error))
}
