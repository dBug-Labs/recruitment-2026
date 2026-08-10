/**
 * app/api/resumes/[applicationId]/route.js
 *
 * GET /api/resumes/:applicationId
 *
 * Streams the resume PDF for the specified application from GridFS.
 *
 * Authorization:
 *  - Administrators and domain leads may access any resume.
 *  - Candidates may only access their own resume (matched by session.user.applicationId).
 *  - Unauthenticated requests are rejected with 401.
 *
 * Note: params is a Promise in Next.js 16 — must be awaited.
 */

import { auth }             from '@/lib/auth'
import { streamResume }     from '@/lib/storage'
import { requireAuth, ROLES, withErrorHandling } from '@/lib/rbac'

export const GET = withErrorHandling(async function handler(request, { params }) {
  // Next.js 16: params is a Promise
  const { applicationId } = await params

  // Require authentication
  const session = await auth()
  const user    = requireAuth(session)

  // Authorization: admins and domain leads can access any resume;
  // candidates may only access their own
  if (user.role !== ROLES.ADMIN && user.role !== ROLES.DOMAIN_LEAD) {
    if (user.applicationId?.toString() !== applicationId) {
      return new Response(JSON.stringify({ error: 'You are not authorized to access this resume' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  // Fetch from GridFS
  let resumeInfo
  try {
    resumeInfo = await streamResume(applicationId)
  } catch (err) {
    if (err.status === 404) {
      return new Response(JSON.stringify({ error: 'Resume not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw err
  }

  const { stream, filename, contentType, length } = resumeInfo

  // Convert Node.js Readable stream → Web ReadableStream
  const webStream = new ReadableStream({
    start(controller) {
      stream.on('data',  (chunk) => controller.enqueue(chunk))
      stream.on('end',   ()      => controller.close())
      stream.on('error', (err)   => controller.error(err))
    },
    cancel() {
      stream.destroy()
    },
  })

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type':        contentType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
      ...(length ? { 'Content-Length': String(length) } : {}),
      // Prevent caching of sensitive documents
      'Cache-Control':       'private, no-store',
    },
  })
})
