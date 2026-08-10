/**
 * lib/storage.js
 *
 * PDF storage helpers using MongoDB GridFS.
 *
 * GridFS splits files into chunks and stores them across two
 * collections: `[bucket].files` (metadata) and `[bucket].chunks` (binary data).
 *
 * Exports:
 *   uploadResume(buffer, filename, metadata)  → { fileId, filename }
 *   streamResume(applicationId)               → ReadableStream
 *   deleteResume(applicationId)               → void
 *   validatePdfBuffer(buffer)                 → { valid, reason }
 *   uploadTaskDocument(buffer, filename, metadata) → { fileId, filename }
 *   streamTaskDocument(taskId)                → ReadableStream
 */

import { Readable } from 'stream'
import { ObjectId } from 'mongodb'
import { getGridFSBucket, getDb } from './db.js'

/** Maximum allowed PDF size: 4 MB (per plan spec) */
export const MAX_RESUME_BYTES = 4 * 1024 * 1024

/** PDF magic bytes — every valid PDF starts with these 4 bytes */
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]) // %PDF

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates a buffer as a PDF file.
 * Checks magic bytes and size.
 *
 * @param {Buffer} buffer
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validatePdfBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { valid: false, reason: 'File is empty' }
  }
  if (buffer.length > MAX_RESUME_BYTES) {
    return { valid: false, reason: `File exceeds the 4 MB limit (received ${(buffer.length / 1024 / 1024).toFixed(2)} MB)` }
  }
  if (!buffer.slice(0, 4).equals(PDF_MAGIC)) {
    return { valid: false, reason: 'File does not appear to be a valid PDF' }
  }
  return { valid: true }
}

// ─── Resume Upload ─────────────────────────────────────────────────────────────

export async function uploadResume(buffer, originalFilename, metadata = {}) {
  const bucket   = await getGridFSBucket()
  const filename = `${metadata.applicationId ?? 'unknown'}-${Date.now()}.pdf`

  return new Promise((resolve, reject) => {
    const readableStream = Readable.from(buffer)
    const uploadStream   = bucket.openUploadStream(filename, {
      contentType: 'application/pdf',
      metadata,
    })

    readableStream.pipe(uploadStream)

    uploadStream.on('finish', () => {
      resolve({
        fileId:   uploadStream.id.toString(),
        filename: uploadStream.filename,
      })
    })

    uploadStream.on('error', reject)
    readableStream.on('error', reject)
  })
}

export async function streamResume(applicationId) {
  const bucket = await getGridFSBucket()
  const cursor = bucket.find({ 'metadata.applicationId': applicationId }, { limit: 1, sort: { uploadDate: -1 } })
  const files  = await cursor.toArray()

  if (!files.length) {
    const err = new Error('Resume not found')
    err.status = 404
    throw err
  }

  const file   = files[0]
  const stream = bucket.openDownloadStream(file._id)

  return {
    stream,
    filename:    file.filename,
    contentType: file.contentType ?? 'application/pdf',
    length:      file.length,
  }
}

export async function deleteResume(applicationId) {
  const bucket = await getGridFSBucket()
  const cursor = bucket.find({ 'metadata.applicationId': applicationId })
  const files  = await cursor.toArray()

  await Promise.all(files.map((f) => bucket.delete(f._id)))
}

// ─── Task Document Upload ─────────────────────────────────────────────────────

export async function uploadTaskDocument(buffer, originalFilename, metadata = {}) {
  const db = await getDb()
  const bucket = new db.s.client.db(db.databaseName).gridFSBucket({ bucketName: 'taskDocs' })
  const filename = `${metadata.taskId ?? 'unknown'}-${Date.now()}.pdf`

  return new Promise((resolve, reject) => {
    const readableStream = Readable.from(buffer)
    const uploadStream   = bucket.openUploadStream(filename, {
      contentType: 'application/pdf',
      metadata,
    })

    readableStream.pipe(uploadStream)

    uploadStream.on('finish', () => {
      resolve({
        fileId:   uploadStream.id.toString(),
        filename: uploadStream.filename,
      })
    })

    uploadStream.on('error', reject)
    readableStream.on('error', reject)
  })
}

export async function streamTaskDocument(taskId) {
  const db = await getDb()
  const bucket = new db.s.client.db(db.databaseName).gridFSBucket({ bucketName: 'taskDocs' })
  const cursor = bucket.find({ 'metadata.taskId': taskId }, { limit: 1, sort: { uploadDate: -1 } })
  const files  = await cursor.toArray()

  if (!files.length) {
    const err = new Error('Task document not found')
    err.status = 404
    throw err
  }

  const file   = files[0]
  const stream = bucket.openDownloadStream(file._id)

  return {
    stream,
    filename:    file.filename,
    contentType: file.contentType ?? 'application/pdf',
    length:      file.length,
  }
}
