# dBug Labs Recruitments — Backend Implementation Plan

Status: **plan only, nothing here is built yet.** The repo today is the Next.js 16 landing
page with a UI-only application form (`app/page.jsx`, `onSubmit` is a no-op).

Three phases, each shippable on its own:

| Phase | What it delivers | Blocking for |
|---|---|---|
| **1 — Intake** | The form actually saves. Applications + resume PDFs in MongoDB. | Everything |
| **2 — Candidate dashboard** | Applicants log in, see assigned tasks, submit a GitHub / Drive link. | Phase 3 review |
| **3 — Admin panel** | Review, assign tasks per domain, shortlist, email, WhatsApp invites. | — |

---

## 1. Stack decisions

| Concern | Choice | Why this over the alternative |
|---|---|---|
| Database | **MongoDB Atlas** (M0 free → M10 if needed) | Already decided. Flexible per-domain task shapes suit a document store. |
| Driver | **`mongodb` native driver + Zod** | Mongoose's model caching fights serverless HMR and adds a schema layer we'd duplicate in Zod anyway (we need Zod regardless, for request validation). |
| Resume storage | **GridFS bucket** (`resumes.files` / `resumes.chunks`) | See §3. |
| Auth | **Auth.js v5 (NextAuth)** — Google OAuth + email OTP fallback | Students have college Google accounts; no password storage, and we get a verified email for free. OTP covers anyone without one. |
| Email | **Resend** | Clean API, React Email templates, good deliverability on a custom domain. Nodemailer + college SMTP is the fallback if a domain isn't available. |
| Validation | **Zod**, one schema per payload, shared client/server | Single source of truth for the form and the API. |
| Hosting | **Vercel** | Already a Next app. See the 4.5 MB caveat in §3. |
| Rate limiting | **Upstash Redis** (`@upstash/ratelimit`) | The public form is an open endpoint. A Mongo-backed counter works if you'd rather not add a service. |
| Spam | **Cloudflare Turnstile** + honeypot field | Invisible to real users, unlike a captcha. |

**Deliberately not doing:** a custom password/session system, S3/Cloudinary for resumes
(explicitly Mongo), or automated WhatsApp group adds (§8 — the API doesn't allow it).

---

## 2. Directory structure

Layered on top of what exists. Nothing in `app/page.jsx` needs to move for Phase 1.

```
app/
  page.jsx                     # landing page (exists)
  layout.jsx  globals.css      # (exist)
  dashboard/                   # phase 2 — candidate, auth required
    layout.jsx  page.jsx
    tasks/[taskId]/page.jsx
  admin/                       # phase 3 — role: admin | domain_lead
    layout.jsx  page.jsx
    applications/[id]/page.jsx
    tasks/  interviews/
  api/
    applications/route.js            # POST public intake
    resumes/[applicationId]/route.js # GET admin-only, streams the PDF
    submissions/route.js             # POST candidate link submission
    admin/
      applications/route.js          # GET list/filter, PATCH status
      tasks/route.js                 # POST assign, GET list
      interviews/route.js            # POST schedule
      emails/route.js                # POST send (templated, batched)
    auth/[...nextauth]/route.js
lib/
  db.js            # cached MongoClient (§9)
  schemas.js       # Zod: application, submission, task, interview
  storage.js       # putResume / getResume — GridFS behind an interface
  auth.js          # Auth.js config + session helpers
  rbac.js          # requireRole('admin') guards
  email/           # Resend client + React Email templates
  audit.js         # append-only action log
components/        # extracted UI, shared between landing / dashboard / admin
scripts/
  gen-textures.mjs # (exists)
  seed-admins.mjs  # bootstrap the admin allowlist
```

---

## 3. Resume storage — the decision and its cost

**Recommendation: GridFS**, not a `BinData` field on the application document.

- A single BSON document caps at 16 MB. GridFS chunks around it, so a large PDF can never
  fail the write in a way that also loses the application.
- Downloads **stream** — the admin panel can serve a 4 MB PDF without pulling it into
  function memory.
- Deleting an application and its file stays a two-step but explicit operation.

**Be honest about the tradeoff:** Mongo is not a blob store. 600 applicants × ~1.5 MB is
~1 GB, which blows past the Atlas M0 512 MB tier and inflates every backup. Mitigations:

1. **Hard cap uploads at 4 MB.** Not arbitrary — Vercel serverless functions reject
   request bodies over **4.5 MB**, so anything larger can't reach the API anyway. Enforce
   client-side (instant feedback) *and* server-side (the real check).
2. Keep all reads/writes behind `lib/storage.js` (`putResume`, `getResume`, `deleteResume`).
   If storage cost bites, that file becomes an S3/R2 adapter and no call site changes.
3. Purge resumes for rejected candidates after the drive closes.

**Validate uploads properly** — extension and MIME type are both client-supplied:

- Read the first bytes and require the `%PDF-` magic number.
- Cap at 4 MB, reject 0-byte files.
- Store `contentType: "application/pdf"` yourself; never echo back the client's value.
- Serve downloads with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`
  so a malicious PDF can never render in our origin.

---

## 4. Data model

Six collections. Timestamps (`createdAt` / `updatedAt`) on all of them.

### `applications`
The Phase 1 payload. One per person per drive.

```js
{
  _id, driveId: "2026",
  name, email,            // email lowercased — the join key for login
  phone, rollNumber, branch, year,
  domains: ["web", "aiml"],     // preferences, ordered
  portfolio: { github, linkedin, website },
  why: String,                  // the 500-char answer
  resume: { fileId: ObjectId, filename, size, uploadedAt },
  status: "submitted" | "under_review" | "shortlisted" | "task_assigned"
        | "task_submitted" | "interview_scheduled" | "selected" | "rejected",
  assignedDomain: "web" | null, // set by admin, may differ from preference
  source, userAgent, ip,        // spam forensics
}
```

Indexes: `{ driveId, email }` **unique** (one application per drive — the constraint that
stops duplicate submissions), `{ status }`, `{ assignedDomain, status }`, `{ createdAt: -1 }`.

### `users`
Created on first login. Linked to an application by matching lowercased email.

```js
{ _id, email, name, image, applicationId, role: "candidate" | "domain_lead" | "admin",
  domains: ["web"],   // which domains a lead can see; ignored for candidates
  lastLoginAt }
```

Index: `{ email }` unique.

### `tasks`
A task **template** per domain, authored by admins.

```js
{ _id, driveId, domain: "web", title, brief: String /* markdown */,
  resources: [{ label, url }], dueAt, submissionType: "github" | "drive" | "either",
  active: Boolean, createdBy }
```

### `assignments`
Which candidate got which task. Separate from `tasks` so one template serves many people
and the due date can be overridden per person.

```js
{ _id, applicationId, taskId, assignedAt, assignedBy, dueAt,
  status: "assigned" | "submitted" | "late" | "reviewed",
  submission: { url, type: "github"|"drive", notes, submittedAt },
  review: { score: 1-10, notes, reviewedBy, reviewedAt } }
```

Index: `{ applicationId, taskId }` unique, `{ status, dueAt }`.

### `interviews`
```js
{ _id, applicationId, domain, slotAt, mode: "online"|"offline", location, meetLink,
  panel: [userId], status: "scheduled"|"done"|"no_show"|"cancelled",
  outcome: { verdict: "select"|"reject"|"hold", notes, by } }
```

### `auditLog`
Append-only. Non-negotiable once multiple people can reject candidates and send mail.

```js
{ _id, actorId, actorEmail, action: "application.status_changed",
  target: { collection, id }, before, after, at, ip }
```

---

## 5. Phase 1 — Intake

**Endpoint:** `POST /api/applications`, `multipart/form-data`.

A Route Handler rather than a Server Action, because we want an explicit status code per
failure mode, per-IP rate limiting at the edge, and an upload progress bar (XHR).

Order of operations — validate cheap things before touching the file:

1. Rate limit by IP (5 submissions / hour) and by email (1 / drive).
2. Verify Turnstile token; check the honeypot field is empty.
3. Zod-parse the text fields → `422` with per-field errors on failure.
4. Validate the PDF: size, magic bytes → `413` / `415`.
5. Check `{ driveId, email }` doesn't already exist → `409` with a "you already applied" message.
6. Stream the PDF into GridFS → get `fileId`.
7. Insert the application. **If this insert fails, delete the orphaned GridFS file.**
8. Queue the confirmation email (don't block the response on Resend).
9. `201` with `{ applicationId }`.

**Client work:** wire the existing form's `onSubmit`, add per-field error rendering, a
disabled/pending state, an upload progress bar, and a success screen with the application
ID. The form markup already exists — this is wiring, not redesign.

**Also needed:** an application-closed guard driven by config, so the form self-disables
after the deadline instead of needing a deploy.

---

## 6. Phase 2 — Candidate dashboard

**Login:** Auth.js with Google OAuth + email OTP. On first sign-in, look up an application
by lowercased email:

- Match → create the `users` doc, link `applicationId`, role `candidate`.
- No match → land them on "we can't find an application for this address", with a way to
  correct the email. **Don't auto-create an empty application.**

**Routes:**

| Route | Shows |
|---|---|
| `/dashboard` | Status timeline (submitted → shortlisted → task → interview → result), assigned domain, profile summary. |
| `/dashboard/tasks` | Assigned tasks, due dates, submission state. |
| `/dashboard/tasks/[id]` | Task brief, resources, submission form. |

**Submission** (`POST /api/submissions`): a URL plus optional notes. Validate by type —

- GitHub: `https://github.com/<owner>/<repo>` (reject gists and non-GitHub hosts if the
  task says `github`). Optionally HEAD the URL to confirm it's public — a private repo the
  reviewer can't open is the single most common failure in a drive like this.
- Drive: `https://drive.google.com/...` or `docs.google.com/...`. Warn loudly that link
  sharing must be "anyone with the link", because we cannot check it server-side.

Allow resubmission until `dueAt`; keep prior submissions in a `history` array rather than
overwriting. After the due date, accept but mark `status: "late"` — the admin decides.

**Access control:** every dashboard query filters by the session's `applicationId`. Never
trust an ID from the URL or body.

---

## 7. Phase 3 — Admin panel

Gate on `role in ("admin", "domain_lead")`. Domain leads see only their `domains`.

**Applications view** — table with filters (domain, status, year, branch), text search,
sort, pagination (`skip`/`limit` is fine at this scale). Row → detail drawer with the full
answer, resume preview (streams from `/api/resumes/[id]`), and status actions. Bulk select
for shortlisting and mail. CSV export.

**Task assignment** — author a task per domain, then assign to a filtered set of candidates
in one action ("all shortlisted in Web Dev"). Writes N `assignments` + queues N emails.
Show a confirmation with the exact recipient count before sending.

**Shortlisting** — a status transition plus an audit entry. Guard the transitions
(`submitted → shortlisted` yes; `rejected → interview_scheduled` no) in one place,
`lib/statusMachine.js`, so the rule isn't reimplemented per route.

**Interviews** — define slots, assign candidates, send an email with time, mode and meet
link. A per-panel day view is enough; don't build a calendar.

**Email** — templated and always previewed:

| Template | Trigger |
|---|---|
| Application received | Phase 1 submit |
| Shortlisted + task assigned | Assignment created |
| Task reminder | Cron, 24h before `dueAt` |
| Interview scheduled | Interview created |
| Result: selected / rejected | Outcome recorded |
| Welcome + WhatsApp invite | On selection |

Rules that save you from a bad afternoon: render a preview with real data before sending,
require typing the recipient count to confirm a bulk send, send through a queue with
retries (Resend batch API, ≤100 per call), record every send in `auditLog`, and keep a
`DRY_RUN=true` env that logs instead of sending. Set up SPF/DKIM on the sending domain
before the first bulk send or you'll land in spam.

---

## 8. WhatsApp — read this before promising it

**You cannot programmatically add someone to a WhatsApp group.** The Cloud API has no
"add participant" for arbitrary numbers; it's blocked deliberately as an anti-spam measure.
Anyone claiming otherwise is describing an unofficial library that will get the number banned.

What actually works:

1. **Invite links (recommended).** Create one group per domain, get its
   `chat.whatsapp.com/<code>` link, store it in a `config` collection per domain, and
   include it in the selection email + the dashboard. Zero API, zero cost, works today.
2. **WhatsApp Cloud API for notifications only** — template messages to candidates who
   opted in, with the invite link in the body. Needs a Meta Business account, a verified
   number, and pre-approved templates (24-48h review). Worth it only if you want delivery
   receipts; email plus a link is otherwise equivalent.

Plan for option 1. Treat option 2 as a later enhancement.

---

## 9. Cross-cutting concerns

**Mongo connection in Next.** Serverless functions and dev HMR both re-evaluate modules,
so a naive `new MongoClient()` leaks connections until Atlas refuses them. Cache the
promise on `globalThis` in development, module scope in production — the standard
`lib/db.js` pattern. Get this right on day one.

**Environment variables** (`.env.local`, and set in Vercel):

```
MONGODB_URI=            MONGODB_DB=dbug_recruitment
AUTH_SECRET=            AUTH_GOOGLE_ID=          AUTH_GOOGLE_SECRET=
RESEND_API_KEY=         EMAIL_FROM=              EMAIL_DRY_RUN=true
TURNSTILE_SECRET_KEY=   NEXT_PUBLIC_TURNSTILE_SITE_KEY=
UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN=
APPLICATIONS_CLOSE_AT=  ADMIN_BOOTSTRAP_EMAILS=
```

`.gitignore` already excludes `.env*.local`.

**Security checklist:** role check server-side on every admin route (never rely on the UI
hiding a button); resumes only via an authenticated streaming route, never a public URL;
rate limit the public form and OTP requests; audit every state change and send; PII stays
out of logs. Confirm with the club whether personal data needs a retention window —
if so, add a purge script.

**Testing worth writing:** the Zod schemas, the status machine's legal transitions, the
PDF validator (a `.pdf` that isn't a PDF must be rejected), and the duplicate-application
constraint. Skip UI tests; hand-test the flows.

---

## 10. Sequencing

Estimates assume one developer working evenings.

| # | Milestone | Output | Est. |
|---|---|---|---|
| 1 | Atlas cluster, `lib/db.js`, Zod schemas, indexes | Connection proven from a route | 0.5 d |
| 2 | `POST /api/applications` + GridFS + validation | Applications land in Mongo | 1.5 d |
| 3 | Wire the existing form, errors, progress, success state | **Phase 1 shippable** | 1 d |
| 4 | Resend + "application received" template | Confirmation mail | 0.5 d |
| 5 | Auth.js, Google + OTP, `users`, application linking | Login works | 1.5 d |
| 6 | Dashboard shell, status timeline | Candidates see status | 1 d |
| 7 | Tasks + assignments + submission with URL validation | **Phase 2 shippable** | 2 d |
| 8 | Admin shell, RBAC, applications table + filters + resume stream | Review works | 2 d |
| 9 | Task authoring + bulk assign + bulk email | Assignment works | 1.5 d |
| 10 | Shortlisting, status machine, audit log | Safe transitions | 1 d |
| 11 | Interviews + scheduling mail | Interviews work | 1 d |
| 12 | Selection mail + WhatsApp invite links + CSV export | **Phase 3 shippable** | 1 d |

Roughly **15 working days**. Milestones 1-4 are the only ones that must land before the
drive opens; the rest can ship while applications are open.

---

## 11. Open questions

These change the design, so answer them before milestone 1:

1. **One drive or many?** The schema assumes `driveId: "2026"` so next year's drive doesn't
   need a migration. Confirm that's wanted.
2. **Can someone apply to multiple domains?** Currently modelled as ordered preferences
   with a single `assignedDomain`. If a person can be selected into two domains
   simultaneously, `assignments` and the status field both change shape.
3. **Custom email domain?** `recruitments@dbuglabs.<college>.edu` vs a Gmail address.
   Bulk mail from a free Gmail account will hit spam folders.
4. **Who counts as admin?** Bootstrap list of emails, and whether domain leads should be
   restricted to their own domain's candidates (assumed yes).
5. **Resume retention** — delete rejected candidates' PDFs after the drive, or keep them?
6. **Expected applicant count?** Under ~1000, everything above runs comfortably on Atlas
   M0 + Vercel Hobby. Beyond that, revisit the storage tier.
