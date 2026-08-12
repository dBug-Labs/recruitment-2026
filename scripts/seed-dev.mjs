/**
 * scripts/seed-dev.mjs
 *
 * Fills the development database with a believable recruitment drive so the
 * candidate portal, the admin panel and every API can be exercised without
 * hand-entering data.
 *
 * Every seeded candidate shares one password (see DEV_PASSWORD) so you can log
 * in as any of them at /login.
 *
 * Usage:
 *   node scripts/seed-dev.mjs           # add/refresh seeded records
 *   node scripts/seed-dev.mjs --fresh   # wipe this drive's data first
 *
 * Refuses to run against NODE_ENV=production.
 */

import { createRequire } from 'module'
import { Readable } from 'stream'
import { loadEnvLocal } from './_env.mjs'

loadEnvLocal()

const require = createRequire(import.meta.url)
const { MongoClient, ObjectId, GridFSBucket } = require('mongodb')
const bcrypt = require('bcryptjs')

const uri     = process.env.MONGODB_URI
const dbName  = process.env.MONGODB_DB
const DRIVE   = process.env.DRIVE_ID ?? '2026'
const FRESH   = process.argv.includes('--fresh')

/** The password every seeded candidate (and the seeded domain lead) uses. */
const DEV_PASSWORD = 'dbug1234'

/** Mirrors TASK_WINDOW_DAYS in lib/recruitment.js. */
const TASK_WINDOW_DAYS = Number(process.env.TASK_WINDOW_DAYS ?? 5)

if (process.env.NODE_ENV === 'production') {
  console.error('❌  Refusing to seed a production database.')
  process.exit(1)
}
if (!uri || !dbName) {
  console.error('❌  MONGODB_URI and MONGODB_DB must be set.')
  process.exit(1)
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const days = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000)

/** [name, srmPrefix, year, branch, dept, [domain labels], status] */
const CANDIDATES = [
  ['Aarav Menon',     'am1001', '1st Year', 'B.Tech', 'CSE',        ['Web Development', 'AI / ML'],      'submitted'],
  ['Diya Krishnan',   'dk1002', '2nd Year', 'B.Tech', 'IT',         ['Web Development'],                 'under_review'],
  ['Rohan Verma',     'rv1003', '2nd Year', 'B.Tech', 'CSE',        ['AI / ML', 'Cybersecurity'],        'shortlisted'],
  ['Ananya Iyer',     'ai1004', '1st Year', 'B.Tech', 'ECE',        ['Creatives', 'PR'],                 'shortlisted'],
  ['Kabir Sharma',    'ks1005', '2nd Year', 'B.Tech', 'CSE',        ['Web Development', 'App Development'], 'task_assigned'],
  ['Meera Nair',      'mn1006', '2nd Year', 'BCA',    'IT',         ['AI / ML'],                         'task_assigned'],
  ['Vihaan Reddy',    'vr1007', '2nd Year', 'B.Tech', 'CSE',        ['Web Development'],                 'task_submitted'],
  ['Sara Thomas',     'st1008', '1st Year', 'B.Sc',   'Other',      ['Creatives'],                       'task_submitted'],
  ['Arjun Pillai',    'ap1009', '2nd Year', 'B.Tech', 'EEE',        ['QA Testing', 'Web Development'],   'interview_scheduled'],
  ['Ishita Bose',     'ib1010', '1st Year', 'B.Tech', 'CSE',        ['Events', 'Sponsorship'],           'interview_scheduled'],
  ['Neel Kapoor',     'nk1011', '2nd Year', 'B.Tech', 'CSE',        ['AI / ML'],                         'selected'],
  ['Tara Joshi',      'tj1012', '1st Year', 'B.Tech', 'Mechanical', ['Videography'],                     'rejected'],
]

const DOMAIN_KEY_BY_LABEL = {
  'Web Development': 'web',
  'AI / ML': 'aiml',
  'App Development': 'app',
  'QA Testing': 'qa',
  'Cybersecurity': 'cyber',
  'Creatives': 'creatives',
  'Sponsorship': 'sponsi',
  'PR': 'pr',
  'Events': 'events',
  'Videography': 'video',
}

const TASKS = [
  {
    domain: 'web',
    title: 'Build a responsive recruitment landing page',
    brief: 'Recreate a single-screen landing page from the reference design.\n\nRequirements:\n• Responsive from 360px to 1440px\n• No UI framework — plain CSS or Tailwind only\n• Deploy it and include the live link in your README\n\nWe are judging layout accuracy, responsiveness and code readability.',
    submissionType: 'either',
    dueDays: 7,
  },
  {
    domain: 'aiml',
    title: 'Train a text classifier on a small dataset',
    brief: 'Pick any public dataset with at least three classes.\n\nDeliverables:\n• A notebook covering EDA, training and evaluation\n• A short write-up of what you tried and what failed\n• Confusion matrix and per-class F1 in the README\n\nAccuracy matters less than how you reason about the results.',
    submissionType: 'github',
    dueDays: 9,
  },
  {
    domain: 'creatives',
    title: 'Design a three-post recruitment campaign',
    brief: 'Design three Instagram posts announcing dBug Labs Recruitments 2026.\n\nDeliverables:\n• Three 1080x1080 exports\n• The source file (Figma link or .psd)\n• One paragraph on the visual direction you chose',
    submissionType: 'drive',
    dueDays: 6,
  },
]

/** A tiny but structurally valid PDF, so task-document downloads work in dev. */
function makePdf(title) {
  const text = `BT /F1 14 Tf 40 90 Td (${title.replace(/[()\\]/g, '')}) Tj ET`
  return Buffer.from(
    `%PDF-1.4\n` +
    `1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n` +
    `2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
    `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 420 140]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n` +
    `4 0 obj<</Length ${text.length}>>stream\n${text}\nendstream endobj\n` +
    `5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n` +
    `trailer<</Size 6/Root 1 0 R>>\n%%EOF\n`,
    'latin1'
  )
}

function uploadPdf(bucket, filename, buffer, metadata) {
  return new Promise((res, rej) => {
    const up = bucket.openUploadStream(filename, { contentType: 'application/pdf', metadata })
    Readable.from(buffer).pipe(up)
    up.on('finish', () => res(up.id.toString()))
    up.on('error', rej)
  })
}

// ─── Seed ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log(`\n🔌  Connecting to ${dbName}…`)
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  const applications = db.collection('applications')
  const tasksCol     = db.collection('tasks')
  const assignments  = db.collection('assignments')
  const interviews   = db.collection('interviews')
  const users        = db.collection('users')

  if (FRESH) {
    console.log('🧹  Wiping existing data for drive', DRIVE)
    const ids = await applications.find({ driveId: DRIVE }, { projection: { _id: 1 } }).toArray()
    const appIds = ids.map((a) => a._id)
    await Promise.all([
      assignments.deleteMany({ applicationId: { $in: appIds } }),
      interviews.deleteMany({ applicationId: { $in: appIds } }),
      applications.deleteMany({ driveId: DRIVE }),
      tasksCol.deleteMany({ driveId: DRIVE }),
      users.deleteMany({ role: 'candidate' }),
      db.collection('auditLog').deleteMany({}),
    ])
    for (const name of ['taskDocs', 'resumes']) {
      const bucket = new GridFSBucket(db, { bucketName: name })
      const files = await bucket.find({}).toArray()
      await Promise.all(files.map((f) => bucket.delete(f._id)))
    }
  }

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10)
  const now = new Date()

  // ── tasks (with a real PDF in GridFS) ──────────────────────────────────────
  const taskDocs = new GridFSBucket(db, { bucketName: 'taskDocs' })
  const taskIdByDomain = {}

  for (const t of TASKS) {
    const _id = new ObjectId()
    const fileId = await uploadPdf(taskDocs, `${_id.toString()}-brief.pdf`, makePdf(t.title), {
      taskId: _id.toString(),
      domain: t.domain,
    })
    await tasksCol.insertOne({
      _id,
      driveId: DRIVE,
      domain: t.domain,
      title: t.title,
      brief: t.brief,
      resources: [{ label: 'dBug Labs handbook', url: 'https://example.com/handbook' }],
      submissionType: t.submissionType,
      dueAt: days(t.dueDays),
      active: true,
      documentFileId: fileId,
      createdBy: { id: 'admin', email: 'admin@dbug.local' },
      // marker `clear-dev.mjs` uses to remove sample data without touching real records
      source: 'seed',
      createdAt: now,
      updatedAt: now,
    })
    taskIdByDomain[t.domain] = _id
    console.log(`📝  Task created: ${t.title}`)
  }

  // ── candidates ─────────────────────────────────────────────────────────────
  let created = 0
  const seededLogins = []

  for (const [i, c] of CANDIDATES.entries()) {
    const [name, prefix, year, branch, department, domains, status] = c
    const srmEmail = `${prefix}@srmist.edu.in`
    const registrationNumber = `RA2${String(411000000000 + i).padStart(12, '0')}`.slice(0, 15)
    const keys = domains.map((d) => DOMAIN_KEY_BY_LABEL[d])

    const _id = new ObjectId()
    // Spread across the last few days so every seeded five-day window is still live
    const appliedAt = days(-(4 - i * 0.3))

    await applications.deleteOne({ driveId: DRIVE, srmEmail })
    await applications.insertOne({
      _id,
      // matches the BND-### format the intake route generates
      applicantId: `BND-${100 + i * 7 + (i % 3)}`,
      driveId: DRIVE,
      name,
      personalEmail: `${prefix}@gmail.com`,
      srmEmail,
      registrationNumber,
      branch,
      department,
      year,
      domains,
      domainKeys: keys,
      question1: `I want to join dBug Labs because I have spent the last year building small projects on my own and I am ready to build with people who push me. I care about ${domains[0].toLowerCase()} and want to go deeper with a team.`,
      question2: `I have shipped three side projects, contributed to two open source repos, and led my class technical club. I pick things up quickly and I am comfortable being the person who reads the docs.`,
      resume: null,
      passwordHash,
      status,
      assignedDomain: ['task_assigned', 'task_submitted'].includes(status) ? keys[0] : null,
      source: 'seed',
      userAgent: 'seed-script',
      ip: '127.0.0.1',
      createdAt: appliedAt,
      updatedAt: now,
    })

    created += 1
    seededLogins.push({ name, srmEmail, registrationNumber, status })

    // assignment for candidates who are at or past the task stage
    if (['task_assigned', 'task_submitted'].includes(status)) {
      const taskId = taskIdByDomain[keys[0]] ?? taskIdByDomain.web
      const submitted = status === 'task_submitted'
      const submission = submitted
        ? {
            type: 'github',
            url: `https://github.com/${prefix}/dbug-task`,
            notes: 'README covers setup. Deployed link is in the repo description.',
            submittedAt: days(-1),
            late: false,
          }
        : null

      await assignments.deleteOne({ applicationId: _id, taskId })
      await assignments.insertOne({
        driveId: DRIVE,
        applicationId: _id,
        taskId,
        domain: keys[0],
        status: submitted ? 'submitted' : 'assigned',
        // the same rule the app uses: five days from when *they* registered
        dueAt: new Date(appliedAt.getTime() + TASK_WINDOW_DAYS * 24 * 60 * 60 * 1000),
        submission,
        history: submission ? [submission] : [],
        score: null,
        feedback: '',
        assignedBy: { id: 'admin', email: 'admin@dbug.local' },
        assignedAt: days(-5),
        source: 'seed',
        updatedAt: now,
      })
    }

    // interview for candidates at the interview stage
    if (status === 'interview_scheduled') {
      await interviews.deleteOne({ applicationId: _id })
      await interviews.insertOne({
        driveId: DRIVE,
        applicationId: _id,
        domain: keys[0],
        slotAt: days(2 + (i % 3)),
        mode: i % 2 === 0 ? 'online' : 'offline',
        location: i % 2 === 0 ? 'https://meet.google.com/dbug-dev-slot' : 'Tech Park, Seminar Hall 2',
        panel: ['Aditi R', 'Rahul S'],
        notes: '',
        status: 'scheduled',
        scheduledBy: { id: 'admin', email: 'admin@dbug.local' },
        source: 'seed',
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  // ── a domain lead, so lead-scoped access can be tested ─────────────────────
  const leadEmail = 'web.lead@dbuglabs.dev'
  await users.updateOne(
    { email: leadEmail },
    {
      $set: {
        email: leadEmail,
        name: 'Web Domain Lead',
        role: 'domain_lead',
        domains: ['web'],
        passwordHash,
        source: 'seed',
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  )

  // ── a pre-verified OTP, so /apply can be finished without checking mail ────
  await db.collection('otps').updateOne(
    { email: 'demo9999@srmist.edu.in' },
    {
      $set: {
        email: 'demo9999@srmist.edu.in',
        otp: '123456',
        verified: true,
        verifiedAt: now,
        expiresAt: days(1),
        source: 'seed',
        createdAt: now,
      },
    },
    { upsert: true }
  )

  console.log(`\n✅  Seeded ${created} applications, ${TASKS.length} tasks, plus assignments and interviews.\n`)
  console.log('─'.repeat(72))
  console.log('CANDIDATE LOGINS — https://localhost:3000/login'.replace('https', 'http'))
  console.log(`Password for every candidate below: ${DEV_PASSWORD}\n`)
  for (const l of seededLogins) {
    console.log(`  ${l.srmEmail.padEnd(26)} ${l.registrationNumber.padEnd(16)} ${l.status}`)
  }
  console.log('\nADMIN LOGIN — http://localhost:3000/admin/login  (password only, no email)')
  console.log(`  admin:       ADMIN_PASSWORD from .env.local (${process.env.ADMIN_PASSWORD ? 'set' : 'NOT SET'})`)
  console.log(`  domain lead: ${DEV_PASSWORD}  →  ${leadEmail}, sees only the "web" domain`)
  console.log('\nAPPLY FLOW — http://localhost:3000/apply')
  console.log('  demo9999@srmist.edu.in is pre-verified; OTPs are printed to the dev server log')
  console.log('─'.repeat(72) + '\n')

  await client.close()
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err)
  process.exit(1)
})
