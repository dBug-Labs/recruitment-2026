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

export const TECH_DOMAINS   = ['Web Development', 'AI / ML', 'App Development', 'QA Testing', 'Cybersecurity']
export const CORP_DOMAINS   = ['Creatives', 'Sponsorship', 'PR', 'Events', 'Videography']
export const ALL_DOMAINS    = [...TECH_DOMAINS, ...CORP_DOMAINS]

export const TECH_DOMAIN_KEYS = ['web', 'aiml', 'app', 'qa', 'cyber']
export const CORP_DOMAIN_KEYS = ['creatives', 'sponsi', 'pr', 'events', 'video']
export const ALL_DOMAIN_KEYS  = [...TECH_DOMAIN_KEYS, ...CORP_DOMAIN_KEYS]

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

  branch: z.enum(BRANCHES, {
    errorMap: () => ({ message: `Branch must be one of: ${BRANCHES.join(', ')}` }),
  }),

  department: z.enum(DEPARTMENTS, {
    errorMap: () => ({ message: `Department must be one of: ${DEPARTMENTS.join(', ')}` }),
  }),

  year: z.enum(YEARS, {
    errorMap: () => ({ message: `Year must be one of: ${YEARS.join(', ')}` }),
  }),

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
  type: z.enum(['github', 'drive'], {
    errorMap: () => ({ message: 'Submission type must be github or drive' }),
  }),
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
  domain: z.enum(ALL_DOMAIN_KEYS, {
    errorMap: () => ({ message: `Domain must be one of: ${ALL_DOMAIN_KEYS.join(', ')}` }),
  }),
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
  dueAt: z
    .string()
    .datetime({ message: 'Due date must be a valid ISO 8601 datetime' })
    .refine((d) => new Date(d) > new Date(), { message: 'Due date must be in the future' }),
  active: z.boolean().default(true),
  // documentFileId is added server-side after GridFS upload, not validated here
})

// ─── Interview Schema ─────────────────────────────────────────────────────────

export const InterviewSchema = z.object({
  applicationId: z.string().min(1),
  domain:        z.enum(ALL_DOMAIN_KEYS),
  slotAt: z
    .string()
    .datetime()
    .refine((d) => new Date(d) > new Date(), { message: 'Interview slot must be in the future' }),
  mode: z.enum(INTERVIEW_MODES),
  location: z.string().min(1, 'Location or link is required').trim(),
  panel: z.array(z.string().min(1)).min(1, 'At least one panel member is required'),
})

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
