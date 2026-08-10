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
import { loadEnvLocal }  from './_env.mjs'

loadEnvLocal()

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
  // The old build indexed `email`, a field applications never had — every
  // document therefore indexed as null and the second insert collided.
  await applications.dropIndex('unique_email_per_drive').catch(() => {})
  // an earlier build shipped this as a (broken) sparse index — rebuild it
  await applications.dropIndex('unique_applicant_id').catch(() => {})
  await applications.createIndexes([
    // One application per SRM email, and per registration number, per drive
    { key: { driveId: 1, srmEmail: 1 },           unique: true, name: 'unique_srm_email_per_drive' },
    { key: { driveId: 1, registrationNumber: 1 }, unique: true, name: 'unique_reg_no_per_drive' },
    // BND-### applicant ids, unique per drive. This must be a *partial* index,
    // not a sparse one: a compound sparse index only skips a document when every
    // indexed field is missing, so rows predating applicantId would all collide
    // on { driveId, null }.
    {
      key: { driveId: 1, applicantId: 1 },
      unique: true,
      name: 'unique_applicant_id',
      partialFilterExpression: { applicantId: { $type: 'string' } },
    },
    { key: { status: 1 },     name: 'status' },
    { key: { domains: 1 },    name: 'domains' },
    { key: { domainKeys: 1 }, name: 'domain_keys' },
    { key: { createdAt: -1 }, name: 'created_at_desc' },
    { key: { driveId: 1 },    name: 'drive_id' },
  ])
  console.log('   ✓ Indexes created for applications\n')

  // ─── otps ─────────────────────────────────────────────────────────────────
  console.log('🔑  Setting up collection: otps')
  await db.createCollection('otps').catch(() => {})
  const otps = db.collection('otps')
  await otps.createIndexes([
    { key: { email: 1 }, unique: true, name: 'unique_email' },
    // Mongo sweeps expired codes on its own — no cleanup job needed
    { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: 'ttl_expires_at' },
  ])
  console.log('   ✓ Indexes created for otps\n')

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
    { key: { driveId: 1 },       name: 'drive_id' },
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
  console.log('📄  Setting up GridFS buckets: resumes, taskDocs')
  // Instantiating the bucket creates the underlying collections if they don't exist
  new GridFSBucket(db, { bucketName: 'resumes' })
  new GridFSBucket(db, { bucketName: 'taskDocs' })
  await db.collection('resumes.files').createIndexes([
    { key: { 'metadata.applicationId': 1 }, name: 'application_id' },
    { key: { uploadDate: -1 },              name: 'upload_date_desc' },
  ])
  await db.collection('taskDocs.files').createIndexes([
    { key: { 'metadata.taskId': 1 }, name: 'task_id' },
    { key: { uploadDate: -1 },       name: 'upload_date_desc' },
  ])
  console.log('   ✓ GridFS buckets and indexes ready\n')

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
