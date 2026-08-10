/**
 * Shared presentation for application statuses.
 * Kept out of the page files so the list, the detail view and the candidate
 * dashboard can never drift into different labels for the same state.
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

/** Consistent India-time formatting for every date shown in the panel. */
export function fmtDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

export function fmtDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}
