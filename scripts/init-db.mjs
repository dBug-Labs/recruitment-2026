/**
 * scripts/init-db.mjs
 *
 * One-time database initialisation script.
 *
 * Creates all required collections, indexes, and validates the GridFS bucket.
 * Safe to run multiple times — uses createIndexes which is idempotent.
 *
 * Usage:
 *   node scripts/init-db.mjs
 *
 * Requires MONGODB_URI and MONGODB_DB to be set in .env.local
 */

import { createRequire } from 'module'
import { readFileSync }  from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local manually (no dotenv dependency needed)
try {
  const envPath = resolve(__dirname, '../.env.local')
  const lines   = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (key && !(key in process.env)) process.env[key] = val
  }
} catch {
  // .env.local may not exist in CI; env vars should already be set
}

const require = createRequire(import.meta.url)
const { MongoClient, GridFSBucket } = require('mongodb')

const uri    = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB

if (!uri)    { console.error('❌  MONGODB_URI is not set'); process.exit(1) }
if (!dbName) { console.error('❌  MONGODB_DB is not set');  process.exit(1) }

async function init() {
  console.log(`\n🔌  Connecting to MongoDB…`)
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)
  console.log(`✅  Connected to database: ${dbName}\n`)

  // ─── applications ─────────────────────────────────────────────────────────
  console.log('📋  Setting up collection: applications')
  await db.createCollection('applications').catch(() => {}) // already exists → fine
  const applications = db.collection('applications')
  await applications.createIndexes([
    // Prevent duplicate applications per email per drive
    { key: { driveId: 1, email: 1 }, unique: true, name: 'unique_email_per_drive' },
    { key: { status: 1 },            name: 'status' },
    { key: { domains: 1 },           name: 'domains' },
    { key: { createdAt: -1 },        name: 'created_at_desc' },
    { key: { driveId: 1 },           name: 'drive_id' },
  ])
  console.log('   ✓ Indexes created for applications\n')

  // ─── users ────────────────────────────────────────────────────────────────
  console.log('👤  Setting up collection: users')
  await db.createCollection('users').catch(() => {})
  const users = db.collection('users')
  await users.createIndexes([
    { key: { email: 1 }, unique: true, name: 'unique_email' },
    { key: { role: 1 },               name: 'role' },
    { key: { applicationId: 1 },      name: 'application_id', sparse: true },
  ])
  console.log('   ✓ Indexes created for users\n')

  // ─── tasks ────────────────────────────────────────────────────────────────
  console.log('📝  Setting up collection: tasks')
  await db.createCollection('tasks').catch(() => {})
  const tasks = db.collection('tasks')
  await tasks.createIndexes([
    { key: { driveId: 1, domain: 1 }, name: 'drive_domain' },
    { key: { active: 1 },             name: 'active' },
    { key: { createdAt: -1 },         name: 'created_at_desc' },
  ])
  console.log('   ✓ Indexes created for tasks\n')

  // ─── assignments ──────────────────────────────────────────────────────────
  console.log('🔗  Setting up collection: assignments')
  await db.createCollection('assignments').catch(() => {})
  const assignments = db.collection('assignments')
  await assignments.createIndexes([
    { key: { applicationId: 1 }, name: 'application_id' },
    { key: { taskId: 1 },        name: 'task_id' },
    { key: { status: 1 },        name: 'status' },
    { key: { assignedAt: -1 },   name: 'assigned_at_desc' },
    // One active assignment per candidate per task
    { key: { applicationId: 1, taskId: 1 }, unique: true, name: 'unique_assignment' },
  ])
  console.log('   ✓ Indexes created for assignments\n')

  // ─── interviews ───────────────────────────────────────────────────────────
  console.log('🗓  Setting up collection: interviews')
  await db.createCollection('interviews').catch(() => {})
  const interviews = db.collection('interviews')
  await interviews.createIndexes([
    { key: { applicationId: 1 }, name: 'application_id' },
    { key: { slotAt: 1 },        name: 'slot_at' },
    { key: { status: 1 },        name: 'status' },
  ])
  console.log('   ✓ Indexes created for interviews\n')

  // ─── auditLog ─────────────────────────────────────────────────────────────
  console.log('📜  Setting up collection: auditLog')
  await db.createCollection('auditLog').catch(() => {})
  const auditLog = db.collection('auditLog')
  await auditLog.createIndexes([
    { key: { actorId: 1 },  name: 'actor_id' },
    { key: { at: -1 },      name: 'at_desc' },
    { key: { action: 1 },   name: 'action' },
    { key: { 'target.collection': 1, 'target.id': 1 }, name: 'target' },
  ])
  console.log('   ✓ Indexes created for auditLog\n')

  // ─── GridFS bucket (resumes) ──────────────────────────────────────────────
  console.log('📄  Setting up GridFS bucket: resumes')
  // Instantiating the bucket creates the underlying collections if they don't exist
  const bucket = new GridFSBucket(db, { bucketName: 'resumes' })
  // Create indexes on the chunks collection explicitly
  await db.collection('resumes.files').createIndexes([
    { key: { 'metadata.applicationId': 1 }, name: 'application_id' },
    { key: { uploadDate: -1 },              name: 'upload_date_desc' },
  ])
  console.log('   ✓ GridFS bucket and indexes ready\n')

  // ─── Summary ──────────────────────────────────────────────────────────────
  const colNames = (await db.listCollections().toArray()).map((c) => c.name).sort()
  console.log('📦  Collections in database:')
  for (const name of colNames) console.log(`   • ${name}`)
  console.log('\n✅  Database initialisation complete!\n')

  await client.close()
}

init().catch((err) => {
  console.error('❌  Init failed:', err)
  process.exit(1)
})
