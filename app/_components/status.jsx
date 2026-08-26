/**
 * Shared presentation for application statuses.
 *
 * Lives outside both route groups because it is the one piece of UI the admin
 * panel and the candidate dashboard genuinely share — so the list, the detail
 * view and the dashboard can never drift into different labels for the same
 * state. Nothing else crosses the (site) / (admin) boundary.
 */

export const STATUS_META = {
  submitted:           { label: 'Submitted',           tone: 'neutral' },
  under_review:        { label: 'Under Review',        tone: 'neutral' },
  shortlisted:         { label: 'Shortlisted',         tone: 'info'    },
  task_assigned:       { label: 'Task Assigned',       tone: 'warn'    },
  task_submitted:      { label: 'Task Submitted',      tone: 'info'    },
  interview_scheduled: { label: 'Interview Scheduled', tone: 'warn'    },
  selected:            { label: 'Selected',            tone: 'good'    },
  rejected:            { label: 'Rejected',            tone: 'bad'     },
}

export function statusMeta(status) {
  return STATUS_META[status] ?? { label: status ?? 'Unknown', tone: 'neutral' }
}

/** Pure presentational pill — safe in server and client components alike. */
export function StatusPill({ status }) {
  const { label, tone } = statusMeta(status)
  return <span className={`pill ${tone}`}>{label}</span>
}

const ASSIGNMENT_META = {
  assigned:  { label: 'Awaiting submission', tone: 'neutral' },
  submitted: { label: 'Submitted',           tone: 'info'    },
  reviewed:  { label: 'Reviewed',            tone: 'good'    },
}

export function AssignmentPill({ status }) {
  const meta = ASSIGNMENT_META[status] ?? { label: status ?? '—', tone: 'neutral' }
  return <span className={`pill ${meta.tone}`}>{meta.label}</span>
}

/**
 * Consistent India-time formatting for every date shown in the panel.
 *
 * `timeZone` is not optional here. Without it these fall back to the runtime's
 * zone, which is UTC on the server and IST in the admin's browser — so a slot
 * booked for 9:00 PM rendered as 3:30 pm server-side and then flipped to 9:00
 * pm on hydration. Every stored date is a UTC instant; IST is the one zone the
 * drive is actually run in, so pin it and let both sides agree.
 */
const IST = 'Asia/Kolkata'

export function fmtDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', { timeZone: IST, dateStyle: 'medium' })
}

export function fmtDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', { timeZone: IST, dateStyle: 'medium', timeStyle: 'short' })
}
