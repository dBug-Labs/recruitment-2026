/**
 * lib/recruitment.js
 *
 * The drive's calendar, in one place.
 *
 * Two rules live here and nothing else should re-derive them:
 *
 *  1. The intake window — applications are only accepted between
 *     APPLICATIONS_OPEN_AT and APPLICATIONS_CLOSE_AT.
 *  2. The task window — every candidate gets exactly TASK_WINDOW_DAYS from
 *     *their own* registration, not from a shared cut-off. Apply on 28 Aug and
 *     the task is due 2 Sept; apply on the 12th and it is due the 17th.
 */

/** Days a candidate has to submit, counted from their registration. */
export const TASK_WINDOW_DAYS = Number(process.env.TASK_WINDOW_DAYS ?? 5)

const IST = 'Asia/Kolkata'

function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function applicationsOpenAt() {
  return parseDate(process.env.APPLICATIONS_OPEN_AT)
}

export function applicationsCloseAt() {
  return parseDate(process.env.APPLICATIONS_CLOSE_AT)
}

/**
 * Where we are in the intake window.
 * @returns {'before'|'open'|'closed'}
 */
export function applicationWindowState(now = new Date()) {
  const open = applicationsOpenAt()
  const close = applicationsCloseAt()
  if (open && now < open) return 'before'
  if (close && now > close) return 'closed'
  return 'open'
}

/**
 * The task deadline for a candidate who registered at `appliedAt`.
 * @param {Date|string|number} appliedAt
 * @returns {Date}
 */
export function taskDeadlineFor(appliedAt) {
  const start = new Date(appliedAt)
  const due = new Date(start)
  due.setDate(due.getDate() + TASK_WINDOW_DAYS)
  return due
}

/** Formats a date the way every candidate-facing surface should show it. */
export function fmtIst(value, opts = { dateStyle: 'long', timeStyle: 'short' }) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-IN', { timeZone: IST, ...opts })
}

/** Just the date, e.g. "28 August 2026". */
export function fmtIstDate(value) {
  return fmtIst(value, { dateStyle: 'long' })
}
