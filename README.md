# dBug Labs — Brand New Day (Next.js)

```bash
npm install
npm run init-db          # collections + indexes (idempotent)
npm run seed-dev:fresh   # demo drive: candidates, tasks, assignments, interviews
npm run dev              # http://localhost:3000
```

`npm run seed-dev:fresh` prints every login it creates. All seeded candidates share
the password `dbug1234`; the admin panel takes `ADMIN_PASSWORD` from `.env.local`.

Removing the sample data again:

```bash
npm run clear-dev                # delete seeded sample data only
npm run clear-dev -- --dry-run   # count what would go, delete nothing
npm run clear-dev -- --all --yes # ALSO delete real applications for this drive
```

Everything the seeder writes carries `source: 'seed'`, so the default run leaves genuine
applications untouched. Both scripts refuse to run with `NODE_ENV=production`.

## Routes

| Route | Who | What |
|---|---|---|
| `/` | public | Landing page |
| `/fit` | public | Domain-fit quiz plus AI advisor |
| `/apply` | public | Application form — OTP-verified SRM email, optional resume |
| `/login` | candidates | Candidate portal sign-in |
| `/dashboard`, `/dashboard/tasks` | candidates | Status, assigned tasks, submissions |
| `/admin/login` | staff | Separate admin sign-in — candidate credentials cannot reach it |
| `/admin` | staff | Overview: pipeline counts, latest applications, domain split |
| `/admin/applications` | staff | Search / filter / paginate, then review a candidate |
| `/admin/tasks` | staff | Create, edit, activate and delete task briefs |
| `/admin/submissions` | staff | Score and give feedback on task work |
| `/admin/interviews` | staff | Upcoming and past interview slots |

Two roles reach the panel. `admin` sees the whole drive; `domain_lead` only ever sees
records touching a domain they own — enforced in the API *and* in every panel query
(`app/admin/_components/scope.js`). Create staff accounts with:

```bash
node scripts/seed-admins.mjs --password "…"                          # admins
node scripts/seed-admins.mjs --password "…" --role domain_lead --domains web,aiml
```

## Data model

`applications` · `tasks` · `assignments` · `interviews` · `users` · `otps` · `auditLog`,
plus two GridFS buckets (`resumes`, `taskDocs`). Applications store domains as both
human labels (`"Web Development"`) and short keys (`domainKeys: ["web"]`); everything
else — tasks, assignments, lead scoping — speaks keys. Convert with `domainKey()` /
`domainLabel()` from `lib/schemas.js` rather than comparing the two forms.

Bot protection is skipped outside production, because a configured Turnstile key would
otherwise reject every submission from `localhost`. Emails go to stdout while
`EMAIL_DRY_RUN=true`.

## Recruitment flow

The same five stages are described on the landing page, in the emails and on the
dashboard — keep them in sync if you change one:

**fill the application → build and submit the task → get shortlisted → interview → done**

Candidates see exactly where they are at `/dashboard`; the task brief PDF is embedded
inline on the task page, with the submit form directly beneath it.

Set `WHATSAPP_GROUP_URL` and a **Join the applicants' WhatsApp group** card appears on the
dashboard. It is read server-side, not `NEXT_PUBLIC_`, so the invite link never ships to
anyone who is not signed in — an invite URL is a join token. Leave it unset and the card
does not render.

### Dates and the five-day rule

`lib/recruitment.js` owns the calendar and nothing else should re-derive it:

| What | Value | Where it comes from |
|---|---|---|
| Applications open | 12 Aug 2026, 00:00 IST | `APPLICATIONS_OPEN_AT` |
| Applications close | 28 Aug 2026, 23:59 IST | `APPLICATIONS_CLOSE_AT` |
| Task window | 5 days **from each candidate's own registration** | `TASK_WINDOW_DAYS` |

The task window is per-person, not a shared cut-off: apply on the 28th and your task is
due on 2 September. Because of that, tasks are **auto-assigned the moment an application
is submitted** — waiting on a human would eat into the five days. A candidate gets the
live task for **every** domain they picked, not just their first choice: someone who
chose two domains is judged on two briefs, so both appear on their dashboard from the
start. Domains with no active task are skipped with a warning and can be assigned by hand
later. `POST /api/admin/assignments` defaults to the same five-day rule; an explicit
`dueAt` still wins.

The intake window is enforced in `POST /api/applications`. Outside production it logs a
warning and lets the request through, so the form stays testable off-season.

## Domain fit finder (`/fit`)

Eight MCQs in two stages, scored locally in `lib/quiz.js`:

1. **Four track questions** that mention no domain at all — they only measure pull towards
   building systems (technical) versus running and selling the work (corporate).
2. **Four domain questions drawn from whichever side won.** Only these carry weights, so a
   corporate-leaning candidate is never scored into a technical domain, or vice versa.

Then a chat with an AI advisor that reads the same answers and argues the trade-offs
before the candidate commits to two domains.

The advisor is Groq's OpenAI-compatible endpoint, proxied through `POST /api/fit/chat` so
the key stays server-side. Set `GROQ_API_KEY` (free from console.groq.com) and optionally
`GROQ_MODEL` (default `llama-3.3-70b-versatile`). **Without a key the page still works** —
it shows the ranking and explains that chat is switched off. The route caps turns and
message length, pins the system prompt on the server, and allows **five advisor calls per
IP** (the opening question counts as one) — it is a decision aid, not a chatbot.

## Applicant IDs and passwords

Each application gets a human-quotable `applicantId` in the form `BND-###`, unique per
drive via a **partial** index (`partialFilterExpression`, not `sparse` — a compound sparse
index only skips a document when every indexed field is missing, so older rows would all
collide on `null`). Three digits is only 1000 codes per drive; the intake route retries on
collision and widens to four digits if that space saturates. Past ~1000 applicants, raise
the digit count in `generateApplicantId`.

The dashboard password is a 5-digit numeric code, stored bcrypt-hashed and sent once by
email. That is a 100,000-key space — fine for a short-lived recruitment portal, not for
anything holding data worth stealing.

**The plaintext exists only in that email.** There is no recovery path: if the send is
lost, the candidate cannot log in and the only fix is to rotate the password and mail a
new one — which is exactly what `npm run resend-confirmations` does.

## Email: one account, one budget

Everything goes out through a single Gmail account, and Gmail caps a free account at
roughly 500 messages a day. Two rules in `lib/email/outbox.js` keep that shared budget
from being spent on the wrong thing:

**A reserve.** Every send declares a `kind`. OTPs and bulk announcements may only spend
down to `SMTP_DAILY_LIMIT − SMTP_OTP_RESERVE`; the last slice belongs to confirmations,
task notices and results. A candidate can therefore never be locked out of their
dashboard because verification traffic ate the day's allowance. When an OTP is refused
the form says so plainly — a 503, not a cheerful "code sent" for a mail that never left.

**A durable queue.** Every real message is written to `emailOutbox` *before* delivery is
attempted, so a failure is a row to retry rather than a lost password. Retryable failures
(4xx, network, "daily sending limit") back off and are picked up by the next send or by
`npm run flush-outbox`; permanent ones (bad address) are marked `failed` and left alone.
`emailQuota` holds one small document per IST day so the count survives restarts.

| Variable | Default | What it does |
|---|---|---|
| `SMTP_DAILY_LIMIT` | 450 | Total sends per IST day |
| `SMTP_OTP_RESERVE` | 120 | Held back for mail a candidate needs |
| `SMTP_MIN_INTERVAL_MS` | 900 | Gap between sends, to dodge burst throttling |
| `EMAIL_MAX_ATTEMPTS` | 6 | Tries before a row is marked `failed` |
| `EMAIL_DRY_RUN` | — | `true` logs everything, sends and stores nothing |
| `EMAIL_OUTBOX` | — | `off` bypasses the queue entirely (test script) |
| `EMAIL_SEND_MODE` | — | `sync` sends inline and surfaces errors (scripts) |

```bash
npm run outbox-status                        # budget + what is still owed
npm run flush-outbox                         # deliver everything due
npm run resend-confirmations -- --dry-run    # see the plan
npm run resend-confirmations                 # rotate passwords, re-mail, reset deadlines
```

`resend-confirmations` is the recovery tool: it assigns any missing per-domain tasks,
resets every deadline to one shared `now + TASK_WINDOW_DAYS`, mints a fresh password and
re-sends the confirmation. It is safe to re-run — rows carry `confirmationResentAt` and
are skipped — so a run stopped by the daily budget continues tomorrow where it left off.

### Where verification sits on the form

The OTP gate is at the **end** of `/apply`, not the top. It used to block the first
field, so people asked for a code, filled the rest of the form, let the ten minutes
lapse, and asked again — several codes each, most never used. Now the whole form is
filled first; pressing Submit sends one code into a dialog that verifies and submits in a
single step. The client also runs the server's own validation rules before asking for a
code, so a malformed registration number costs nothing.

## Files
- `app/page.jsx` — the landing page (nav, hero, why, timeline, domains, apply, footer). Server Component.
- `app/_components/domains.js` — all marketing copy for the ten domains, in one place.
- `app/_components/DomainArt.jsx` — inline SVG artwork for the domain cards.
- `app/_components/DomainGrid.jsx` — the cards plus their explainer popups.
- `app/globals.css` — all colors, type scale and component styles, including the portal shell.
- `app/layout.jsx` — fonts wired via `next/font/google`, plus the `viewport` export.
- `lib/` — `db` (Mongo singleton), `auth` (Auth.js v5), `rbac`, `schemas` (zod), `storage` (GridFS), `audit`, `ratelimit`.
- `lib/email/` — `index` (one function per message), `outbox` (the queue, the budget and the reserve), `transport` (nodemailer, and which failures are worth retrying).
- `public/logo.png` — dBug Labs mark. `public/hero.png` — replace with your rooftop render.

## Fonts (exactly what the mockups use)
| Role | Font |
|---|---|
| Big display — BRAND NEW DAY / STARTS HERE / MORE THAN A CLUB | **Anton** (400) — free on Google Fonts. Closest free match to the poster-condensed grotesque. Paid alternatives with identical feel: Druk Wide Bold, Monument Extended, Termina Heavy. |
| Condensed sub-heads — APPLICATION FORM, GROW TOGETHER, card titles | **Oswald** 500/600 |
| Body, nav, labels, buttons | **Barlow** 300–700 |

## Grit (the raw, dirty texture)
The gritty look on BRAND NEW DAY is not the font — it is texture, and it ships as three
seamlessly tiling PNGs generated by `scripts/gen-textures.mjs`:

| File | Role |
|---|---|
| `public/dirt.png` | Alpha mask over headings — pinholes, dust flecks and scratch drags take bites out of the letters. |
| `public/grain.png` | Dark mottle painted *inside* the letters and across every panel — surfaces read as screen-printed, not flat. |
| `public/film.png` | Light specks and dark motes over the whole page. |

**Everything sits behind the content.** The page-wide passes are `body::before` / `body::after`
at `z-index:-1`, and each panel's grain is a `z-index:-1` pseudo-element inside an
`isolation:isolate` stacking context — so it lands above the panel's background and below
its text. Nothing ever paints over the copy. (`body` is deliberately transparent and the
canvas colour lives on `html`, otherwise the body background would hide the fixed layers.)

Three knobs in `:root` — set any to `0` to switch that layer off:

```css
--film:.7;         /* page-wide dirt   */
--vignette:.35;    /* print falloff    */
--panel-grain:.42; /* texture on cards */
```

Add `grit` to any display heading. Pair it with `grad` (gradient fill) or `grit-ink`
(solid fill, colour set via `--ink`). `g2` / `g3` shift the tile so no two headings wear
the same dirt.

```jsx
<h1 className="display grad grit">Brand<br />New Day</h1>
<h2 className="display grit grit-ink g2" style={{ "--ink": "#dcd6de" }}>Your brand new day</h2>
```

The condensed sub-heads (card titles, timeline numbers, `APPLICATION FORM`) and the
buttons get the same mask automatically, but only a hint of it: `--grit-floor` lifts the holes back up, `0`
being fully chewed and `.72` being the barely-there setting they use. Per heading you can
also change `--grit-dirt` / `--grit-grain` — the tile size, so a bigger tile means coarser
damage. To change the texture itself, edit the `DIRT` / `GRAIN` / `FILM` knobs at the top
of the generator and re-run:

```bash
npm run textures          # rewrites public/dirt.png + public/grain.png
PREVIEW=./tmp npm run textures   # also dumps flattened copies you can actually look at
```

Every seed produces a different sheet of dirt, so the page's texture is one of a kind —
change `seed` for a fresh one. The headings stay real, selectable text throughout.

## Palette
```
bg          #08050a
red         #ff2d4f   red soft  #ff5a72
pink        #e0479a
purple      #8b3dff   lilac     #b06bff / #c07adf
text        #f4eef6   muted     #a99bad / #cfc3d2
button/text gradient  linear-gradient(95deg,#f2334f,#8b3dff)
heading gradient      linear-gradient(100deg,#f4304c,#e02a63 30%,#a92fb4 62%,#7c3aed 90%)
```

## Cursor
The footer's 🕷 (U+1F577) is the page cursor — an SVG data-URI in `--spider`, with a
bigger, brighter `--spider-lg` on anything clickable so hover still reads without the hand
cursor. Text fields keep a normal caret. Browsers that refuse SVG cursors (Safari) fall
back to `auto` / `pointer`. Both live in `:root` in `globals.css`.

## Notes
- Icons are unicode glyphs so the page has zero dependencies. Swap in `lucide-react` for pixel-exact icons: `npm i lucide-react`.
- Before going live: set `EMAIL_DRY_RUN=false`, set `NEXT_PUBLIC_BASE_URL`, and register your
  production domain against the Turnstile key (verification is enforced in production only).
- The rate limiter is an in-process `Map` — fine for one server, useless behind more than one.
  Move it to Redis before scaling out.
