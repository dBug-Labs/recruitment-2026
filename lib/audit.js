/**
 * lib/audit.js
 *
 * Append-only audit logger.
 *
 * Every significant admin action (status changes, task assignments, interview
 * scheduling, bulk email sends) must call logAudit so that there is a full
 * paper trail in the auditLog collection.
 *
 * Documents are never updated or deleted — only inserted.
 *
 * Usage:
 *   import { logAudit } from '@/lib/audit'
 *   await logAudit({
 *     actorId:    session.user.id,
 *     actorEmail: session.user.email,
 *     action:     'status_change',
 *     target:     { collection: 'applications', id: applicationId },
 *     before:     { status: 'shortlisted' },
 *     after:      { status: 'task_assigned' },
 *     ip,
 *   })
 */

import { getCollection } from './db.js'

/**
 * @typedef {Object} AuditEntry
 * @property {string}  actorId    — the authenticated user's _id (string)
 * @property {string}  actorEmail — the authenticated user's email
 * @property {string}  action     — a snake_case action label (e.g. 'status_change')
 * @property {object}  target     — { collection, id } of the affected document
 * @property {object}  [before]   — the previous state of the changed fields
 * @property {object}  [after]    — the new state of the changed fields
 * @property {string}  [ip]       — client IP address
 */

/**
 * Appends a single audit entry to the auditLog collection.
 * This function never throws — errors are logged to stderr but do not
 * interrupt the calling request.
 *
 * @param {AuditEntry} entry
 */
export async function logAudit({ actorId, actorEmail, action, target, before, after, ip }) {
  try {
    const col = await getCollection('auditLog')
    await col.insertOne({
      actorId,
      actorEmail,
      action,
      target,
      before:  before  ?? null,
      after:   after   ?? null,
      ip:      ip      ?? null,
      at:      new Date(),
    })
  } catch (err) {
    // Audit failures must never crash the main request.
    console.error('[audit] Failed to write audit log entry:', err?.message ?? err)
  }
}

/**
 * Convenience wrapper that reads the IP from a NextRequest object.
 *
 * @param {import('next/server').NextRequest} request
 * @param {Omit<AuditEntry, 'ip'>} entry
 */
export async function logAuditFromRequest(request, entry) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
  return logAudit({ ...entry, ip })
}
