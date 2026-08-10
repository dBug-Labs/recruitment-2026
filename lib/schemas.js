/**
 * lib/schemas.js
 *
 * Zod validation schemas — the single source of truth for all data shapes.
 * These are used on both the server (route handlers) and optionally on the
 * client for inline validation feedback.
 */

import { z } from 'zod'

// ─── Enumerations ─────────────────────────────────────────────────────────────

export const DEPARTMENTS    = ['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Biotech', 'Other']
export const BRANCHES       = ['B.Tech', 'M.Tech', 'BCA', 'MCA', 'B.Sc', 'M.Sc', 'Other']
export const YEARS          = ['1st Year', '2nd Year']

/**
 * The single source of truth for domains.
 * Applications store the human `label`; tasks, assignments and domain-lead
 * scoping all store the short `key`. Use the helpers below to move between them
 * instead of comparing the two forms directly.
 */
export const DOMAIN_META = [
  { key: 'web',       label: 'Web Development', group: 'tech' },
  { key: 'aiml',      label: 'AI / ML',         group: 'tech' },
  { key: 'app',       label: 'App Development', group: 'tech' },
  { key: 'qa',        label: 'QA Testing',      group: 'tech' },
  { key: 'cyber',     label: 'Cybersecurity',   group: 'tech' },
  { key: 'creatives', label: 'Creatives',       group: 'corp' },
  { key: 'sponsi',    label: 'Sponsorship',     group: 'corp' },
  { key: 'pr',        label: 'PR',              group: 'corp' },
  { key: 'events',    label: 'Events',          group: 'corp' },
  { key: 'video',     label: 'Videography',     group: 'corp' },
]

export const TECH_DOMAINS   = DOMAIN_META.filter((d) => d.group === 'tech').map((d) => d.label)
export const CORP_DOMAINS   = DOMAIN_META.filter((d) => d.group === 'corp').map((d) => d.label)
export const ALL_DOMAINS    = DOMAIN_META.map((d) => d.label)

export const TECH_DOMAIN_KEYS = DOMAIN_META.filter((d) => d.group === 'tech').map((d) => d.key)
export const CORP_DOMAIN_KEYS = DOMAIN_META.filter((d) => d.group === 'corp').map((d) => d.key)
export const ALL_DOMAIN_KEYS  = DOMAIN_META.map((d) => d.key)

const KEY_BY_LABEL = new Map(DOMAIN_META.map((d) => [d.label.toLowerCase(), d.key]))
const LABEL_BY_KEY = new Map(DOMAIN_META.map((d) => [d.key, d.label]))

/** Accepts a label ("Web Development") or a key ("web") and returns the key. */
export function domainKey(value) {
  if (!value) return null
  const v = String(value).trim()
  if (LABEL_BY_KEY.has(v)) return v
  return KEY_BY_LABEL.get(v.toLowerCase()) ?? null
}

/** Accepts a key ("web") or a label and returns the display label. */
export function domainLabel(value) {
  if (!value) return ''
  const v = String(value).trim()
  return LABEL_BY_KEY.get(v) ?? (KEY_BY_LABEL.has(v.toLowerCase()) ? v : v)
}

/** Maps an array of labels/keys to a de-duplicated array of keys. */
export function domainKeys(values = []) {
  return [...new Set(values.map(domainKey).filter(Boolean))]
}

export const SUBMISSION_TYPES = ['github', 'drive', 'either']
export const INTERVIEW_MODES  = ['online', 'offline']
export const ROLES = ['candidate', 'domain_lead', 'admin']

/** All valid application status values in lifecycle order */
export const APPLICATION_STATUSES = [
  'submitted',
  'under_review',
  'shortlisted',
  'task_assigned',
  'task_submitted',
  'interview_scheduled',
  'selected',
  'rejected',
]

/**
 * Valid status transitions.
 * Key = current status, Value = set of statuses it may move to.
 */
export const STATUS_TRANSITIONS = {
  submitted:           new Set(['under_review', 'rejected']),
  under_review:        new Set(['shortlisted', 'rejected']),
  shortlisted:         new Set(['task_assigned', 'interview_scheduled', 'rejected']),
  task_assigned:       new Set(['task_submitted', 'rejected']),
  task_submitted:      new Set(['interview_scheduled', 'rejected']),
  interview_scheduled: new Set(['selected', 'rejected']),
  selected:            new Set(),
  rejected:            new Set(),
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Count words in a string */
function wordCount(str) {
  return str.trim().split(/\s+/).filter(Boolean).length
}

/**
 * A datetime string that must parse and lie in the future.
 *
 * zod v4's `.datetime()` only accepts UTC "Z" strings — it rejects both the
 * `datetime-local` value an <input> produces ("2026-09-01T10:00") and any
 * offset form ("...+05:30"), so we parse leniently instead.
 */
function futureDatetime(label) {
  return z
    .string()
    .min(1, `${label} is required`)
    .refine((d) => !Number.isNaN(Date.parse(d)), { message: `${label} must be a valid date and time` })
    .refine((d) => new Date(d) > new Date(), { message: `${label} must be in the future` })
}

// ─── Application Schema ───────────────────────────────────────────────────────

export const ApplicationSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim(),

  personalEmail: z
    .string()
    .email('Must be a valid email address')
    .transform((v) => v.toLowerCase().trim()),

  srmEmail: z
    .string()
    .email('Must be a valid SRM email')
    .regex(
      /^[a-zA-Z]{2}\d{4}@srmist\.edu\.in$/i,
      'SRM email must follow the format xx1234@srmist.edu.in'
    )
    .transform((v) => v.toLowerCase().trim()),

  registrationNumber: z
    .string()
    .length(15, 'Registration number must be exactly 15 characters')
    .regex(/^RA2\d{12}$/i, 'Registration number must follow the format RA2xxxxxxxxxxxx (15 digits)')
    .transform((v) => v.toUpperCase()),

  // Branch and department are free text: the university's real course names are
  // messier than any list we could keep current. BRANCHES / DEPARTMENTS survive
  // only as datalist suggestions on the form.
  branch: z
    .string()
    .min(2, 'Enter your branch')
    .max(60, 'Branch must be at most 60 characters')
    .trim(),

  department: z
    .string()
    .min(2, 'Enter your department')
    .max(80, 'Department must be at most 80 characters')
    .trim(),

  // Note: zod v4 takes `error`, not v3's `errorMap` — the latter is silently ignored.
  year: z.enum(YEARS, { error: `Year must be one of: ${YEARS.join(', ')}` }),

  domains: z
    .array(z.enum(ALL_DOMAINS))
    .min(1, 'Select at least 1 domain preference')
    .max(2, 'Select at most 2 domain preferences'),

  question1: z
    .string()
    .min(10, 'Please write at least 10 characters')
    .max(2000, 'Response is too long')
    .trim()
    .refine((v) => wordCount(v) <= 200, { message: 'Response must be at most 200 words' }),

  question2: z
    .string()
    .min(10, 'Please write at least 10 characters')
    .max(2000, 'Response is too long')
    .trim()
    .refine((v) => wordCount(v) <= 200, { message: 'Response must be at most 200 words' }),
})

// ─── Task Submission Schema ───────────────────────────────────────────────────

export const TaskSubmissionSchema = z.object({
  assignmentId: z.string().min(1),
  type: z.enum(['github', 'drive'], { error: 'Submission type must be github or drive' }),
  url: z.string().url('Must be a valid URL').refine(
    (url) => {
      try {
        const { hostname } = new URL(url)
        return (
          hostname === 'github.com' ||
          hostname.endsWith('.github.com') ||
          hostname === 'drive.google.com' ||
          hostname === 'docs.google.com'
        )
      } catch {
        return false
      }
    },
    { message: 'URL must be a GitHub or Google Drive link' }
  ),
  notes: z
    .string()
    .max(300, 'Notes must be at most 300 characters')
    .optional()
    .default(''),
})

// ─── Task (admin) Schema ──────────────────────────────────────────────────────

export const TaskSchema = z.object({
  driveId: z.string().min(1),
  domain: z.enum(ALL_DOMAIN_KEYS, { error: `Domain must be one of: ${ALL_DOMAIN_KEYS.join(', ')}` }),
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(150, 'Title must be at most 150 characters')
    .trim(),
  brief: z.string().min(1, 'Task brief is required'),
  resources: z
    .array(
      z.object({
        label: z.string().min(1),
        url:   z.string().url(),
      })
    )
    .optional()
    .default([]),
  submissionType: z.enum(SUBMISSION_TYPES),
  dueAt: futureDatetime('Due date'),
  active: z.boolean().default(true),
  // documentFileId is added server-side after GridFS upload, not validated here
})

/** Fields an admin may edit on an existing task (no document re-upload). */
export const TaskUpdateSchema = TaskSchema.pick({
  title: true,
  brief: true,
  submissionType: true,
  active: true,
}).extend({
  dueAt: futureDatetime('Due date').optional(),
  resources: TaskSchema.shape.resources,
}).partial()

// ─── Interview Schema ─────────────────────────────────────────────────────────

export const InterviewSchema = z.object({
  applicationId: z.string().min(1),
  domain:        z.enum(ALL_DOMAIN_KEYS, { error: 'Pick a valid domain' }),
  slotAt:        futureDatetime('Interview slot'),
  mode:          z.enum(INTERVIEW_MODES, { error: 'Mode must be online or offline' }),
  location:      z.string().min(1, 'Location or link is required').trim(),
  panel:         z.array(z.string().min(1)).min(1, 'At least one panel member is required'),
  notes:         z.string().max(500).optional().default(''),
})

// ─── Assignment Schema ────────────────────────────────────────────────────────

/** Payload for POST /api/admin/assignments — hands a task to a candidate. */
export const AssignmentSchema = z.object({
  applicationId: z.string().min(1, 'Pick a candidate'),
  taskId:        z.string().min(1, 'Pick a task'),
  // Optional per-candidate override; falls back to the task's own deadline.
  dueAt:         futureDatetime('Due date').optional(),
})

/**
 * Payload for PATCH /api/admin/assignments/[id].
 *
 * Covers both things an admin does to an assignment: recording a review
 * (score/feedback) and extending the deadline. At least one has to be present,
 * and the route treats them separately — extending a deadline must not mark an
 * unsubmitted task as reviewed.
 */
export const AssignmentPatchSchema = z
  .object({
    score:    z.coerce.number().min(0, 'Score cannot be negative').max(100, 'Score is out of 100').nullable().optional(),
    feedback: z.string().max(1000, 'Feedback must be at most 1000 characters').optional(),
    dueAt:    futureDatetime('New deadline').optional(),
    reason:   z.string().max(200, 'Reason must be at most 200 characters').optional(),
  })
  .refine(
    (v) => v.score !== undefined || v.feedback !== undefined || v.dueAt !== undefined,
    { message: 'Nothing to update' }
  )

/** @deprecated kept so older imports keep resolving — use AssignmentPatchSchema. */
export const AssignmentReviewSchema = AssignmentPatchSchema

// ─── Status Update Schema ─────────────────────────────────────────────────────

export const StatusUpdateSchema = z.object({
  applicationId: z.string().min(1),
  status:        z.enum(APPLICATION_STATUSES),
}).refine(
  // Note: actual transition validation needs the *current* status from the DB;
  // that check happens inside the route handler using STATUS_TRANSITIONS.
  () => true
)

// Status transition schema used by PATCH /api/admin/applications/[id]
export const StatusTransitionSchema = z.object({
  status: z.enum(APPLICATION_STATUSES),
})

// ─── OTP Schemas ──────────────────────────────────────────────────────────────

export const OtpSendSchema = z.object({
  srmEmail: z
    .string()
    .email()
    .regex(/^[a-zA-Z]{2}\d{4}@srmist\.edu\.in$/i, 'Invalid SRM email format')
    .transform((v) => v.toLowerCase().trim()),
})

export const OtpVerifySchema = z.object({
  srmEmail: z
    .string()
    .email()
    .transform((v) => v.toLowerCase().trim()),
  otp: z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must be numeric'),
})
