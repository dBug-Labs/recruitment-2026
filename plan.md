# dBug Labs Recruitment Portal — Implementation Plan

The repository currently contains a Next.js landing page with a UI-only application form in [app/page.jsx](app/page.jsx), and the submission handler is still a placeholder.

This document formalizes the requirements and delivery plan for the recruitment portal while preserving the existing product scope.

---

## 1. Project Overview

### 1.1 Purpose
The dBug Labs Recruitment Portal 2026 is a web-based system for managing the full recruitment lifecycle, from public application intake to candidate evaluation, task submission, interview scheduling, and final outcome communication.

### 1.2 Goals
The platform must provide a secure and structured way to:
- collect applicant information and resume uploads,
- track candidate progress through the recruitment pipeline,
- assign domain-specific tasks to shortlisted candidates,
- support review workflows for administrators and domain leads, and
- send automated emails related to recruitment events.

### 1.3 Delivery Phases

| Phase | Primary Outcome | Dependency Level |
|---|---|---|
| Phase 1 — Intake | Applications are accepted and stored with resume PDFs | Foundation for all later work |
| Phase 2 — Candidate Dashboard | Candidates can authenticate and submit task links | Depends on Phase 1 |
| Phase 3 — Admin and Lead Panel | Reviewers can manage candidates, assign tasks, and schedule interviews | Depends on Phase 2 |

---

## 2. Scope and Functional Areas

### 2.1 Public Intake Portal
The public portal must present recruitment information and allow applicants to submit a complete application.

### 2.2 Candidate Dashboard
Authenticated candidates must be able to view their application status, review assigned tasks, and submit their deliverables.

### 2.3 Administrator and Domain Lead Panel
Authorized reviewers must be able to manage applications, assign tasks, manage statuses, schedule interviews, and dispatch communications.

---

## 3. User Roles and Permissions

| Role | Access Level | Responsibilities |
|---|---|---|
| Public Applicant | Unauthenticated | Views recruitment information and submits an application |
| Candidate | Authenticated | Views dashboard, monitors application status, and submits task links |
| Domain Lead | Authenticated with role `domain_lead` | Reviews candidates within assigned domains and assigns tasks |
| Administrator | Authenticated with role `admin` | Full access to all recruitment management workflows |

### 3.1 Access Rules
- Candidates may view only their own application and task-related data.
- Domain leads may access only the domains assigned to them.
- Administrators may access the full system.
- Protected admin routes must enforce role validation on the server side.

---

## 4. Functional Requirements

### 4.1 Module 1 — Public Intake and Landing Experience

#### 4.1.1 Landing Page
The landing page must present:
- club and recruitment information,
- domain highlights,
- timeline details,
- process steps,
- FAQs,
- contact information, and
- an application entry point.

The system must detect whether applications are still open using the `APPLICATIONS_CLOSE_AT` configuration and disable the intake form when the deadline has passed.

#### 4.1.2 Public Application Form
Location: [app/page.jsx](app/page.jsx) and `POST /api/applications`

##### Form Fields

| Field | Type | Required | Validation Rules |
|---|---|---|---|
| Name | Text input | Yes | Minimum 2 characters, maximum 100 |
| Registration Number | Text input | Yes | Minimum 3 characters, maximum 30; alphanumeric |
| Section | Text input | Yes | Minimum 1 character, maximum 50 |
| Department | Select | Yes | Allowed values: `CSE`, `IT`, `ECE`, `Other` |
| Email Address | Email input | Yes | Must be a valid email; stored in lowercase; unique per drive |
| Country Code | Select | Yes | Allowed values: `+91`, `+1`, `+44` |
| Phone Number | Text input | Yes | Numeric string; must match the selected country code format |
| College / University | Text input | Yes | Minimum 2 characters, maximum 150 |
| Year of Study | Select | Yes | Allowed values: `1st Year`, `2nd Year`, `3rd Year`, `4th Year` |
| Domain Preferences | Multi-select | Yes | 1 to 2 selections from the approved domain list: `Web Development`, `AI / ML`, `App Development`, `Creative Design`, `Public Relations`, `Corporate & Events` |
| Why dBug Labs? | Textarea | Yes | Minimum 20 characters, maximum 500 |
| Resume / CV | File upload | Yes | PDF only; maximum 4 MB; must include a valid PDF header. Required for students in `2nd Year` and above. |
| Portfolio / Work Link | URL input | No | Must be a valid HTTP or HTTPS URL |
| Terms Declaration | Checkbox | Yes | Must be checked |
| Honeypot Field | Hidden field | System guard | Must remain empty |
| Turnstile Token | Hidden token | Yes | Must be verified by the server |

##### Form Actions
- Primary action: `Submit Application`
- The button must show a loading state and upload progress during submission.
- On success, the form must be replaced with a confirmation view showing an application reference ID.

##### Validation and Error Handling
- Maximum 5 submissions per IP address per hour.
- Duplicate applications for the same email in the same recruitment drive must return a conflict response.
- Invalid files or oversized files must produce clear user-facing error messages.
- Successful submissions must trigger a confirmation email.

### 4.2 Module 2 — Authentication and Candidate Access

#### 4.2.1 Candidate Login
The system must support authentication using Google OAuth and an email-based OTP fallback.

##### OTP Form Fields

| Field | Type | Required | Validation Rules |
|---|---|---|---|
| Email Address | Email input | Yes | Must match a known application record |
| One-Time Password | Numeric input | Yes | Exactly 6 digits; valid for 5 minutes |

##### Authentication Behavior
- The system must verify the candidate’s email against an existing application.
- If an application exists, it must create or update the corresponding user record and redirect the user to the dashboard.
- If no matching application exists, the system must show a clear notice and must not create an empty application automatically.

### 4.3 Module 3 — Candidate Dashboard

#### 4.3.1 Dashboard Routes
The dashboard must provide:
- `/dashboard` for status tracking and profile summary,
- `/dashboard/tasks` for task lists and due dates, and
- `/dashboard/tasks/[taskId]` for task details and submission entry.

#### 4.3.2 Candidate Status Lifecycle
Candidates must be able to view the recruitment lifecycle through the following stages:
1. submitted
2. under_review
3. shortlisted
4. task_assigned
5. task_submitted
6. interview_scheduled
7. selected or rejected

#### 4.3.3 Task Submission Form

| Field | Type | Required | Validation Rules |
|---|---|---|---|
| Submission Type | Radio / select | Yes | Allowed values: `github` or `drive` |
| Deliverable URL | URL input | Yes | Must match the specified host rules for GitHub or Google Drive |
| Submission Notes | Textarea | No | Maximum 300 characters |

##### Submission Rules
- Candidates may resubmit before the deadline.
- Previous submissions must be preserved in history instead of being overwritten.
- Submissions made after the due date must be accepted but flagged as late.
- The system must validate link visibility where possible.

### 4.4 Module 4 — Admin and Domain Lead Panel

#### 4.4.1 Application Review View
The review interface must support:
- filtering by domain, status, year, and branch,
- text search,
- pagination,
- full candidate detail review,
- resume PDF streaming,
- CSV export.

#### 4.4.2 Task Authoring Form

| Field | Type | Required | Validation Rules |
|---|---|---|---|
| Recruitment Drive | Text input | Yes | Defaults to the current recruitment drive |
| Domain | Select | Yes | Allowed values: `web`, `aiml`, `app`, `creative`, `pr`, `corp` |
| Task Title | Text input | Yes | Minimum 5 characters, maximum 150 |
| Task Brief | Markdown editor | Yes | Detailed instructions required |
| Resource Links | Dynamic array | No | Each item requires a label and a valid URL |
| Submission Type | Select | Yes | Allowed values: `github`, `drive`, `either` |
| Submission Deadline | Date/time picker | Yes | Must be in the future |
| Active Status | Toggle | Yes | Boolean value |

#### 4.4.3 Bulk Assignment Flow
- Administrators must be able to assign a task to multiple shortlisted candidates in a single action.
- A confirmation step must show the exact recipient count before execution.
- Assignment should create the required records and queue the relevant notifications.

#### 4.4.4 Interview Scheduling Form

| Field | Type | Required | Validation Rules |
|---|---|---|---|
| Candidate | Searchable select | Yes | Must reference a shortlisted candidate |
| Domain | Read-only / select | Yes | Must reflect the assigned domain |
| Interview Slot | Date/time picker | Yes | Must be a future timestamp |
| Interview Mode | Select | Yes | Allowed values: `online` or `offline` |
| Location / Link | Text input | Yes | Online mode requires a valid link; offline mode requires a physical location |
| Panel Members | Multi-select | Yes | Must reference valid reviewer accounts |

#### 4.4.5 Email Communication Module
The system must send recruitment-related emails for important lifecycle events.

| Event | Template | Dynamic Content |
|---|---|---|
| Application submitted | Application Received | Candidate name, application ID, domain preferences |
| Task assigned | Task Notification | Candidate name, task title, deadline |
| Deadline reminder | Task Reminder | Candidate name, remaining time, submission link |
| Interview scheduled | Interview Invitation | Candidate name, time, mode, location/link |
| Final outcome recorded | Result Notification | Candidate name and selection decision |
| Selection outcome | Welcome / WhatsApp Invite | Candidate name and onboarding details |

#### 4.4.6 Audit Logging
Every significant action must be appended to an audit log, including status changes, task assignments, interview scheduling, and bulk email sends.

---

## 5. Interface and API Requirements

| Endpoint | Purpose |
|---|---|
| `POST /api/applications` | Public application submission |
| `GET /api/resumes/[applicationId]` | Secure resume PDF streaming |
| `POST /api/submissions` | Candidate task link submission |
| `GET /api/admin/applications` | Admin candidate search, filter, and pagination |
| `PATCH /api/admin/applications` | Admin candidate status update |
| `POST /api/admin/tasks` | Task creation and assignment |
| `POST /api/admin/interviews` | Interview scheduling |
| `POST /api/admin/emails` | Bulk email dispatch |
| `POST /api/auth/[...nextauth]` | Authentication handler |

---

## 6. Backend File Structure

The backend and application structure should be organized as follows to keep the implementation modular and maintainable:

```text
app/
  page.jsx                     # landing page and public intake form
  layout.jsx                   # app layout and global shell
  globals.css                  # global styles
  dashboard/                   # candidate dashboard routes
    layout.jsx
    page.jsx
    tasks/[taskId]/page.jsx
  admin/                       # admin and domain lead routes
    layout.jsx
    page.jsx
    applications/[id]/page.jsx
    tasks/
    interviews/
  api/
    applications/route.js
    resumes/[applicationId]/route.js
    submissions/route.js
    admin/
      applications/route.js
      tasks/route.js
      interviews/route.js
      emails/route.js
    auth/[...nextauth]/route.js
lib/
  db.js                        # MongoDB connection and caching
  schemas.js                   # Zod validation schemas
  storage.js                   # file upload and resume storage helpers
  auth.js                      # authentication configuration and helpers
  rbac.js                      # role-based access control helpers
  email/
  audit.js
components/
  # shared UI components for landing, dashboard, and admin views
scripts/
  gen-textures.mjs
  seed-admins.mjs
```

This structure preserves the current project layout while separating public pages, authenticated routes, API handlers, shared libraries, and reusable UI components.

---

## 7. Data Model and Storage Approach

### 7.1 Core Collections

#### `applications`
Stores the intake form submission for each candidate.

```js
{
  _id,
  driveId,
  name,
  email,
  phone,
  college,
  rollNumber,
  branch,
  year,
  domains,
  portfolio,
  why,
  resume,
  status,
  assignedDomain,
  source,
  userAgent,
  ip,
  createdAt,
  updatedAt
}
```

#### `users`
Stores authenticated users and role information.

```js
{
  _id,
  email,
  name,
  image,
  applicationId,
  role,
  domains,
  lastLoginAt,
  createdAt,
  updatedAt
}
```

#### `tasks`
Stores domain task templates created by admins.

```js
{
  _id,
  driveId,
  domain,
  title,
  brief,
  resources,
  dueAt,
  submissionType,
  active,
  createdBy,
  createdAt,
  updatedAt
}
```

#### `assignments`
Links candidates to assigned tasks and tracks deliverables.

```js
{
  _id,
  applicationId,
  taskId,
  assignedAt,
  assignedBy,
  dueAt,
  status,
  submission,
  history,
  review,
  createdAt,
  updatedAt
}
```

#### `interviews`
Stores interview scheduling and outcome details.

```js
{
  _id,
  applicationId,
  domain,
  slotAt,
  mode,
  location,
  meetLink,
  panel,
  status,
  outcome,
  createdAt,
  updatedAt
}
```

#### `auditLog`
Stores append-only administrative actions.

```js
{
  _id,
  actorId,
  actorEmail,
  action,
  target,
  before,
  after,
  at,
  ip
}
```

### 6.2 Storage Decision
Resume files should be stored through GridFS rather than as inline binary data. This avoids the 16 MB BSON document constraint and supports efficient streaming for review workflows.

---

## 7. Non-Functional Requirements

### 7.1 Security
- File uploads must be limited and validated.
- PDFs must be served through an authenticated streaming route.
- Role-based checks must be enforced on every protected action.
- Sensitive information must not be exposed in logs or error output.

### 7.2 Performance
- Resume streaming should be memory efficient.
- Database connections should be pooled and reused where possible.
- The intake flow should remain responsive even when email dispatch is handled asynchronously.

### 7.3 Reliability and Anti-Spam
- Public intake endpoints must enforce rate limiting.
- Bot protection must be present through Turnstile and a honeypot field.
- Suggestion: use dry-run email behavior during development and staging to avoid accidental sends.

---

## 8. Technical Decisions

| Concern | Choice | Reason |
|---|---|---|
| Framework | Next.js 16 | Supports the existing app structure and server-side routes |
| Database | MongoDB Atlas | Flexible for recruitment-related document structures |
| Resume Storage | GridFS | Better suited for large PDF files than embedded document storage |
| Authentication | Auth.js v5 | Supports both Google OAuth and email OTP |
| Validation | Zod | Shared validation across client and server |
| Email | Resend + React Email | Clear transactional template support |
| Rate Limiting | Upstash Redis | Good fit for public endpoint protection |
| Spam Protection | Cloudflare Turnstile + honeypot | Lightweight and user-friendly |

---

## 9. Implementation Sequencing

| Step | Milestone | Expected Output |
|---|---|---|
| 1 | Database and schema foundation | Mongo connection and core collections ready |
| 2 | Intake API and GridFS upload | Applications can be stored with resumes |
| 3 | Frontend form wiring | Submission works end to end for Phase 1 |
| 4 | Email confirmation | Applicants receive a receipt email |
| 5 | Authentication setup | Candidate login works through Google or OTP |
| 6 | Dashboard shell | Candidates can view status and tasks |
| 7 | Task submission flow | Candidates can submit deliverables |
| 8 | Admin review workflow | Reviewers can view and manage applications |
| 9 | Task assignment and bulk actions | Admins can assign tasks at scale |
| 10 | Status machine and audit trail | Candidate transitions are controlled and logged |
| 11 | Interview scheduling | Interviews can be created and communicated |
| 12 | Candidate outcome flow | Final outcomes and invite links are delivered |

Roughly 15 working days are expected for the full implementation plan.

---

## 10. Cross-Cutting Concerns

### 10.1 Environment Variables
The following environment variables should be configured:

```text
MONGODB_URI=
MONGODB_DB=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
RESEND_API_KEY=
EMAIL_FROM=
EMAIL_DRY_RUN=true
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
APPLICATIONS_CLOSE_AT=
ADMIN_BOOTSTRAP_EMAILS=
```

### 10.2 Testing Priorities
The most valuable tests to implement first are:
- Zod validation rules,
- status transition enforcement,
- PDF validation,
- duplicate submission checks.

### 10.3 Open Questions
1. Should the system support multiple recruitment drives in the same database?
2. Can a candidate be assigned to more than one domain at the same time?
3. Is there a preferred custom email domain for sending recruitment mail?
4. Who should be considered an administrator during the initial rollout?
5. Should resumes be retained after a candidate is rejected?
6. What is the expected applicant volume for the first recruitment cycle?
