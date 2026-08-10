/**
 * scripts/clear-dev.mjs
 *
 * Deletes the sample data that `seed-dev.mjs` created, leaving real
 * applications alone. Everything the seeder writes carries `source: 'seed'`,
 * so this only removes records with that marker.
 *
 * ─── How to run ──────────────────────────────────────────────────────────────
 *
 *   npm run clear-dev                # remove seeded sample data only
 *   npm run clear-dev -- --dry-run   # count what would go, delete nothing
 *   npm run clear-dev -- --all       # ALSO delete real applications for this drive
 *
 * Or call it directly:
 *
 *   node scripts/clear-dev.mjs
 *   node scripts/clear-dev.mjs --dry-run
 *   node scripts/clear-dev.mjs --all --yes
 *
 * Notes:
 *   • `--all` wipes every application, task, assignment, interview, OTP and
 *     uploaded file for DRIVE_ID — including genuine candidate submissions.
 *     It refuses to run unless you also pass `--yes`.
 *   • Refuses to run at all when NODE_ENV=production.
 *   • Reads MONGODB_URI / MONGODB_DB / DRIVE_ID from .env.local.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createRequire } from 'module'
import { loadEnvLocal } from './_env.mjs'

loadEnvLocal()

const require = createRequire(import.meta.url)
const { MongoClient, GridFSBucket } = require('mongodb')

const uri    = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB
const DRIVE  = process.env.DRIVE_ID ?? '2026'

const DRY_RUN = process.argv.includes('--dry-run')
const ALL     = process.argv.includes('--all')
const YES     = process.argv.includes('--yes')

if (process.env.NODE_ENV === 'production') {
  console.error('❌  Refusing to delete data with NODE_ENV=production.')
  process.exit(1)
}
if (!uri || !dbName) {
  console.error('❌  MONGODB_URI and MONGODB_DB must be set.')
  process.exit(1)
}
if (ALL && !YES) {
  console.error(
    '❌  --all deletes REAL candidate applications for drive ' + DRIVE + '.\n' +
    '    Re-run with --yes if that is genuinely what you want:\n' +
    '        node scripts/clear-dev.mjs --all --yes'
  )
  process.exit(1)
}

async function run() {
  console.log(`\n🔌  Connecting to ${dbName} (drive ${DRIVE})…`)
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  const applications = db.collection('applications')
  const tasks        = db.collection('tasks')
  const assignments  = db.collection('assignments')
  const interviews   = db.collection('interviews')
  const users        = db.collection('users')
  const otps         = db.collection('otps')

  // Scope: seeded records only, unless --all was passed.
  const appFilter  = ALL ? { driveId: DRIVE } : { driveId: DRIVE, source: 'seed' }
  const taskFilter = ALL ? { driveId: DRIVE } : { driveId: DRIVE, source: 'seed' }

  const doomedApps  = await applications.find(appFilter,  { projection: { _id: 1 } }).toArray()
  const doomedTasks = await tasks.find(taskFilter, { projection: { _id: 1 } }).toArray()
  const appIds  = doomedApps.map((a) => a._id)
  const taskIds = doomedTasks.map((t) => t._id)

  const counts = {
    applications: appIds.length,
    tasks:        taskIds.length,
    assignments:  await assignments.countDocuments({
      $or: [{ applicationId: { $in: appIds } }, { taskId: { $in: taskIds } }],
    }),
    interviews:   await interviews.countDocuments({ applicationId: { $in: appIds } }),
    users:        await users.countDocuments(ALL ? { role: { $ne: 'admin' } } : { source: 'seed' }),
    otps:         await otps.countDocuments(ALL ? {} : { source: 'seed' }),
  }

  console.log(`\n${DRY_RUN ? '🔍  Would delete' : '🧹  Deleting'} ${ALL ? '(EVERYTHING for this drive)' : '(seeded sample data only)'}:`)
  for (const [name, n] of Object.entries(counts)) {
    console.log(`   ${String(n).padStart(5)}  ${name}`)
  }

  if (DRY_RUN) {
    console.log('\n✅  Dry run — nothing was deleted.\n')
    await client.close()
    return
  }

  // Child records first, so nothing is orphaned if this dies halfway.
  await assignments.deleteMany({
    $or: [{ applicationId: { $in: appIds } }, { taskId: { $in: taskIds } }],
  })
  await interviews.deleteMany({ applicationId: { $in: appIds } })

  // GridFS: resumes belong to the doomed applications, briefs to the doomed tasks
  let filesRemoved = 0
  const appIdStrings  = new Set(appIds.map((id) => id.toString()))
  const taskIdStrings = new Set(taskIds.map((id) => id.toString()))

  for (const [bucketName, keep] of [['resumes', appIdStrings], ['taskDocs', taskIdStrings]]) {
    const bucket = new GridFSBucket(db, { bucketName })
    const files = await bucket.find({}).toArray()
    for (const file of files) {
      const owner = bucketName === 'resumes'
        ? file.metadata?.applicationId
        : file.metadata?.taskId
      if (ALL || (owner && keep.has(owner))) {
        await bucket.delete(file._id)
        filesRemoved += 1
      }
    }
  }

  await applications.deleteMany(appFilter)
  await tasks.deleteMany(taskFilter)
  await users.deleteMany(ALL ? { role: { $ne: 'admin' } } : { source: 'seed' })
  await otps.deleteMany(ALL ? {} : { source: 'seed' })

  if (ALL) {
    await db.collection('auditLog').deleteMany({})
    console.log('   audit log cleared')
  }

  console.log(`   ${String(filesRemoved).padStart(5)}  GridFS files`)
  console.log('\n✅  Done. Re-seed any time with:  npm run seed-dev:fresh\n')

  await client.close()
}

run().catch((err) => {
  console.error('❌  clear-dev failed:', err)
  process.exit(1)
})
