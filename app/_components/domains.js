/**
 * Everything the marketing site says about a domain, in one place.
 *
 * `key` and `label` mirror DOMAIN_META in lib/schemas.js — that stays the
 * source of truth for validation, this is the source of truth for copy. The
 * landing cards, the explainer popups and the fit finder all read from here.
 */

const RED    = { color: "#ff3a58", border: "rgba(255,45,79,.35)",  wash: "rgba(255,45,79,.10)"  };
const PURPLE = { color: "#b06bff", border: "rgba(139,61,255,.32)", wash: "rgba(139,61,255,.10)" };
const PINK   = { color: "#ff3a7a", border: "rgba(255,58,122,.32)", wash: "rgba(255,58,122,.09)" };
const LILAC  = { color: "#c07adf", border: "rgba(192,122,223,.3)", wash: "rgba(139,61,255,.08)" };

export const DOMAIN_CARDS = [
  {
    key: "web", num: "01", label: "Web Development", group: "tech", ...RED,
    teaser: "Ship the interfaces everything else lands on — club sites, dashboards, event portals.",
    what: "We build and run everything dBug Labs puts on the internet: the recruitment portal you are using right now, event microsites, the sponsor-facing decks that live at a URL, and internal dashboards the other domains depend on. If it has a URL, it came from here.",
    work: [
      "Ship a real feature to a site people outside the club actually use",
      "Turn a Figma file from Creatives into a responsive, accessible page",
      "Wire a frontend to a real database and API, auth and all",
      "Own performance and mobile behaviour, not just the happy path",
    ],
    looking: [
      "You want to build things, whether or not you have built much yet",
      "You care that it works on a 360px phone, not only your laptop",
      "You read the error before pasting it somewhere — or you are willing to start",
    ],
    tools: ["React / Next.js", "JavaScript", "CSS", "Node", "MongoDB", "Git"],
  },
  {
    key: "aiml", num: "02", label: "AI / ML", group: "tech", ...PURPLE,
    teaser: "Turn messy data into something useful — models, notebooks and honest evaluation.",
    what: "We prototype the intelligent bits: recommendation and matching tools, computer-vision experiments for events, and the ML workshops that pull half the campus in. Most of the work is data wrangling and evaluation, not model architecture — and that is the part we teach hardest.",
    work: [
      "Take a messy public dataset and get it to the point where a model can learn from it",
      "Train, evaluate, then argue honestly about why the metric looks the way it does",
      "Ship a small model behind an API the web domain can call",
      "Run a hands-on session so first-years can follow what you did",
    ],
    looking: [
      "You are curious about why a result is what it is, not just what it is",
      "You will read the docs or the paper rather than give up on page two",
      "You would rather understand one model properly than name ten",
    ],
    tools: ["Python", "PyTorch / TensorFlow", "scikit-learn", "pandas", "Jupyter", "Hugging Face"],
  },
  {
    key: "app", num: "03", label: "App Development", group: "tech", ...PINK,
    teaser: "Build for the device in everyone's pocket — offline-first, and it survives real use.",
    what: "We build the mobile side of what the club runs: event companion apps, attendance and check-in tools, and internal utilities the core team uses on the ground. Phones are where our audience actually is, so this domain ships to real users fast.",
    work: [
      "Build a screen from scratch, from state management to the empty state",
      "Handle the unglamorous parts — offline, permissions, slow networks, low battery",
      "Publish a build and watch actual humans use it at an event",
      "Share a codebase with the web domain where it makes sense",
    ],
    looking: [
      "You want to build for phones and are willing to learn the messy parts",
      "You think about what happens when the network drops",
      "You finish things, even the boring 20% at the end",
    ],
    tools: ["Flutter / Dart", "React Native", "Kotlin or Swift", "Firebase", "REST APIs"],
  },
  {
    key: "qa", num: "04", label: "QA Testing", group: "tech", ...LILAC,
    teaser: "Break things on purpose. Automated suites and the edge cases nobody thought of.",
    what: "We are the reason a launch does not fall over. We write the automated suites that guard the portal and the apps, hunt the paths nobody planned for, and file bugs that a developer can actually reproduce. It is the fastest way in the club to learn how a whole system really fits together.",
    work: [
      "Write end-to-end tests that run before every release",
      "Build a test plan for a feature and find what the spec forgot",
      "File reproducible bug reports — steps, expected, actual, evidence",
      "Sit with developers on release day and call the go/no-go",
    ],
    looking: [
      "You are the person who types an emoji into the phone-number field",
      "You write things down precisely",
      "You are stubborn in a useful way",
    ],
    tools: ["Playwright / Cypress", "Jest", "Postman", "Chrome DevTools", "GitHub Actions"],
  },
  {
    key: "cyber", num: "05", label: "Cybersecurity", group: "tech", ...RED,
    teaser: "Find the holes before anyone else does — CTFs, audits and responsible disclosure.",
    what: "We audit what the club builds before it goes live, run the CTF teams and the security sessions, and keep the portal's handling of candidate data honest. Everything here is on systems we own or are invited into — the point is defence and disclosure, not stunts.",
    work: [
      "Audit a club project and write up findings a developer can act on",
      "Compete in CTFs as a team, then teach the solutions afterwards",
      "Threat-model a new feature before a line of it is written",
      "Run awareness sessions that are actually worth attending",
    ],
    looking: [
      "You are curious about how things fail, not about causing damage",
      "You understand why disclosure has rules and you will follow them",
      "You are willing to spend a weekend stuck on something before it clicks",
    ],
    tools: ["Burp Suite", "Wireshark", "Linux", "Python", "Nmap", "OWASP Top 10"],
  },
  {
    key: "creatives", num: "06", label: "Creatives", group: "corp", ...PURPLE,
    teaser: "Posters, brand systems, motion — the visual language every other domain borrows.",
    what: "We own how dBug Labs looks. Campaign artwork, event branding, the poster that decides whether someone stops scrolling, motion for reels, and the design system every other domain pulls from. The work is visible on campus within days of making it.",
    work: [
      "Design a full campaign — posters, stories, banners — from one brief",
      "Build and defend a visual system, not just a nice one-off",
      "Hand clean, buildable files to the web and video domains",
      "Take critique in the open and iterate quickly",
    ],
    looking: [
      "You make things, even if the portfolio is three rough posters",
      "You can say why you chose something, not just that you liked it",
      "You take critique without taking it personally",
    ],
    tools: ["Figma", "Illustrator", "Photoshop", "After Effects", "Blender (a plus)"],
  },
  {
    key: "sponsi", num: "07", label: "Sponsorship", group: "corp", ...PINK,
    teaser: "Fund the ambition — build the deck, work the pipeline, keep partners coming back.",
    what: "Nothing the club runs is free. We build the sponsorship deck, research and reach out to companies, negotiate deliverables, and make sure every partner gets exactly what was promised so they say yes again next year. It is the closest thing on campus to real business development.",
    work: [
      "Build a pitch deck that survives contact with a real company",
      "Own a pipeline end to end — research, outreach, follow-up, close",
      "Negotiate deliverables you can actually deliver",
      "Keep the post-event report honest so the relationship lasts",
    ],
    looking: [
      "You will send the email even though a stranger might ignore it",
      "Silence does not discourage you — follow-up is the job",
      "You are organised enough to never drop a commitment",
    ],
    tools: ["Google Slides / Canva", "Sheets & CRM basics", "Email", "Negotiation"],
  },
  {
    key: "pr", num: "08", label: "Public Relations", group: "corp", ...RED,
    teaser: "Own the voice — campaigns, socials and copy that makes people show up.",
    what: "We decide what the club says and how it sounds. Social calendars, launch campaigns, captions and copy, press and collaborations with other societies, and the community management that turns followers into people who actually turn up.",
    work: [
      "Plan and run a multi-week campaign across platforms",
      "Write copy that sounds like us and not like a press release",
      "Work with Creatives on what a post needs to be, before it is designed",
      "Read the analytics afterwards and change the next one",
    ],
    looking: [
      "You write clearly, and you are willing to cut your own words",
      "You understand a feed is a conversation, not a noticeboard",
      "You would be comfortable being the club’s public voice — eventually",
    ],
    tools: ["Instagram / LinkedIn", "Canva", "Notion", "Analytics", "Good writing"],
  },
  {
    key: "events", num: "09", label: "Events", group: "corp", ...LILAC,
    teaser: "Make the day happen — run sheets, logistics, volunteers, and calm when it slips.",
    what: "We turn an idea into a day that runs on time. Venue and permissions, run sheets to the minute, volunteer rosters, vendors, budgets, and the on-ground calls when something inevitably goes sideways. Every other domain's work meets its audience through us.",
    work: [
      "Own a run sheet and hold a hundred-person event to it",
      "Handle permissions, venues and vendors with real deadlines",
      "Brief and lead a volunteer team on the day",
      "Run the debrief and make the next one measurably better",
    ],
    looking: [
      "You stay calm when the schedule slips, because it will",
      "You follow up without being asked twice",
      "You would rather over-prepare than improvise",
    ],
    tools: ["Sheets & Notion", "Budgeting", "Vendor coordination", "People skills"],
  },
  {
    key: "video", num: "10", label: "Videography", group: "corp", ...PURPLE,
    teaser: "Shoot it, cut it, ship it — aftermovies and reels that outlive the event.",
    what: "We are the club's memory. Event coverage, aftermovies that make people regret missing it, reels and shorts for the social calendar, and interview or recap footage for sponsors. Fast turnarounds — a reel that lands three weeks late lands nowhere.",
    work: [
      "Shoot a full event and cut an aftermovie people rewatch",
      "Turn one shoot into a week of short-form content",
      "Colour, sound and pace a cut so it feels intentional",
      "Deliver on a tight turnaround without dropping quality",
    ],
    looking: [
      "You have shot or cut something, even on a phone",
      "You are willing to learn pacing and sound, not just filters",
      "You can work a long event day and still deliver",
    ],
    tools: ["Premiere Pro / DaVinci", "After Effects", "CapCut", "DSLR or mirrorless", "Lightroom"],
  },
];

export const TECH_DOMAIN_CARDS = DOMAIN_CARDS.filter((d) => d.group === "tech");
export const CORP_DOMAIN_CARDS = DOMAIN_CARDS.filter((d) => d.group === "corp");

export function domainCard(key) {
  return DOMAIN_CARDS.find((d) => d.key === key) ?? null;
}
