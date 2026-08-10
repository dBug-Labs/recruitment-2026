// No interactivity left on this page since the form moved to /apply, so it
// stays a Server Component and ships no JavaScript of its own.
import Image from "next/image";
import Link from "next/link";
import SiteNav from "@/app/_components/SiteNav";
import DomainGrid from "@/app/_components/DomainGrid";

// Only anchors that actually exist on the page. SiteNav highlights whichever of
// these is on screen, so the active link is no longer pinned to "Home".
const SECTIONS = [
  { id: "top",      label: "Home"     },
  { id: "why",      label: "Why Us"   },
  { id: "domains",  label: "Domains"  },
  { id: "timeline", label: "Timeline" },
  { id: "apply",    label: "Apply"    },
];

const CHIPS = [
  { label: "< >", icon: "", left: "27%", top: "16%" },
  { label: "AI/ML", icon: "◎", left: "68%", top: "19%" },
  { label: "Git Push", icon: ">_", left: "10%", top: "36%" },
  { label: "Flutter", icon: "◆", left: "74%", top: "39%" },
  { label: "Backend", icon: "▤", left: "70%", top: "58%" },
  { label: "Web", icon: "⊕", left: "6%", top: "62%" },
  { label: "Creative", icon: "✒", left: "76%", top: "76%" },
];

const WHY = [
  { icon: "⚬", title: "GROW TOGETHER", body: "Collaborate with passionate peers and grow in an environment that pushes you to be better." },
  { icon: "‹›", title: "BUILD IMPACT", body: "Work on real-world projects that solve meaningful problems and create real impact." },
  { icon: "▴", title: "LEARN FEARLESSLY", body: "Workshops, resources and mentorship that help you explore, learn and master new skills." },
  { icon: "⚙", title: "EXPAND NETWORK", body: "Connect with like-minded people, industry experts and build lifelong friendships." },
  { icon: "♛", title: "EARN RECOGNITION", body: "Your work gets noticed. Stand out, get appreciated and unlock new opportunities." },
  { icon: "⚡", title: "UNLEASH POTENTIAL", body: "Step out of your comfort zone and discover a version of you that can achieve extraordinary things." },
];

/* The five stages of recruitment, with the dates attached. The wording here,
   in STEPS below and on the dashboard all describe the same pipeline:
   application → task → shortlist → interview → result. */
const TIMELINE = [
  { num: "01", icon: "☰", title: "APPLICATIONS OPEN", date: "12 AUG 2026", body: "Fill the form, verify your SRM email and pick up to two domains.", color: "#ff2d4f", dot: "#ff2d4f", glow: "rgba(255,45,79,.45)" },
  { num: "02", icon: "☑", title: "APPLICATIONS CLOSE", date: "28 AUG 2026", body: "Last call, 11:59 PM. Nothing is accepted after this — and applying earlier gives you more runway.", color: "#b06bff", dot: "#ffffff", glow: "rgba(176,107,255,.45)" },
  { num: "03", icon: "⚒", title: "TASK ROUND", date: "5 DAYS FROM YOUR APPLY DATE", body: "Your brief appears the moment you apply, and the clock is yours alone. Apply on the 28th? Submit by 2 Sept.", color: "#ff2d4f", dot: "#ff2d4f", glow: "rgba(255,45,79,.45)" },
  { num: "04", icon: "▭", title: "SHORTLIST & INTERVIEWS", date: "03 – 10 SEPT 2026", body: "We read every submission. Shortlisted candidates get an interview slot by email.", color: "#b06bff", dot: "#ffffff", glow: "rgba(176,107,255,.45)" },
  { num: "05", icon: "☆", title: "RESULTS OUT", date: "12 SEPT 2026", body: "Final calls go out. The next chapter begins — welcome to dBug Labs.", color: "#ff2d4f", dot: "#ffffff", glow: "rgba(255,45,79,.45)" },
];

/* Domain copy lives in app/_components/domains.js — DomainGrid renders it. */

/* Matches what the form on /apply actually asks for. */
const PREP = [
  { icon: "✉", title: "Your SRM email", sub: "We send an OTP to verify it" },
  { icon: "▤", title: "Registration number", sub: "The full RA2… number" },
  { icon: "▱", title: "Resume (PDF)", sub: "Required for 2nd-year tech" },
  { icon: "♡", title: "Two short answers", sub: "200 words each, no essays" },
];

/* The five stages already have their own section above (TIMELINE), so the apply
   block deliberately does not repeat them. */

export default function Page() {
  return (
    <main id="top">
      <SiteNav sections={SECTIONS} />

      {/* HERO */}
      <header className="hero">
        <div className="wrap grid">
          <div>
            <div className="kicker">dBug&nbsp; Labs&nbsp; presents</div>
            <div className="rule" style={{ width: 64, margin: "14px 0 26px" }} />
            <div className="cond" style={{ fontWeight: 500, fontSize: 22, letterSpacing: 9, color: "#efe7f2", marginBottom: 6 }}>PROJECT:</div>
            <h1 className="display grad grit">Brand<br />New Day</h1>
            <div style={{ marginTop: 30, fontSize: 26, fontWeight: 500, lineHeight: 1.35, color: "#f2eaf4" }}>
              Every great developer<br />starts with <span style={{ color: "#ff4f75" }}>one decision.</span>
            </div>
            <div style={{ width: 74, height: 2, background: "linear-gradient(90deg,#ff2d4f,#8b3dff)", margin: "26px 0 24px" }} />
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.75, letterSpacing: ".4px", color: "var(--muted)", maxWidth: 400 }}>
              Join a community where curiosity, innovation and collaboration shape the next generation of builders.
            </p>
            <p style={{ margin: "20px 0 0", fontSize: 17, letterSpacing: ".4px", color: "var(--muted)" }}>
              Recruitments <b style={{ color: "#ff3a58" }}>2026</b> are now open.
            </p>
            <div style={{ display: "flex", gap: 22, marginTop: 38, flexWrap: "wrap" }}>
              <Link href="/apply" className="btn grad">Apply Now <span>→</span></Link>
              <a href="#domains" className="btn ghost">Explore Domains <span>→</span></a>
            </div>
          </div>

          <div className="heroArt">
            {/* Drop your hero render at /public/hero.png */}
            <Image src="/hero.png" alt="" fill priority style={{ opacity: 0.95 }} />
            <div style={{ position: "absolute", right: 26, top: 20, display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, letterSpacing: 4, color: "#efe4f2" }}>
              RECRUITMENTS &apos;26 <span className="dot" />
            </div>
            {CHIPS.map((c) => (
              <div key={c.label} className="chip" style={{ left: c.left, top: c.top }}>
                <i>{c.icon}</i>{c.label}<span className="dot" />
              </div>
            ))}
            <div style={{ position: "absolute", left: "50%", bottom: 18, transform: "translateX(-50%)", textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 5, color: "#cdc1d0", marginBottom: 12 }}>DISCOVER YOUR DOMAIN</div>
              <div className="mouse"><span /></div>
              <div style={{ color: "#8f8194", fontSize: 18, marginTop: 6 }}>↓</div>
            </div>
          </div>
        </div>
      </header>

      {/* WHY */}
      <section id="why">
        <div className="wrap">
          <div className="secHead">
            <div>
              <div className="eyebrow">WHY dBUG LABS?</div>
              <div className="rule" style={{ width: 100, margin: "10px 0 18px" }} />
              <h2 className="display grit grit-ink g2">More than a club.<br /><span className="grad">It&apos;s a movement.</span></h2>
            </div>
            <div className="side">
              <p>We are a community of dreamers, builders and problem solvers. At dBug Labs, you don&apos;t just learn — you create impact, build connections and grow beyond limits.</p>
              <p>Here, you don&apos;t just join. You belong.</p>
            </div>
          </div>

          <div className="cards3">
            {WHY.map((c) => (
              <div className="card" key={c.title}>
                <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 16 }}>
                  <div className="iconBox">{c.icon}</div>
                  <div>
                    <div className="cardTitle">{c.title}</div>
                    <div style={{ width: 52, height: 2, marginTop: 8, background: "linear-gradient(90deg,#ff2d4f,rgba(139,61,255,.2))" }} />
                  </div>
                </div>
                <p>{c.body}</p>
              </div>
            ))}
          </div>

          <div className="banner">
            <div className="ring"><div className="inner">☼</div></div>
            <div style={{ flex: 1 }}>
              <div className="title">BE A PART OF SOMETHING <span style={{ color: "#ff3a58" }}>EXTRAORDINARY.</span></div>
              <p>This is your moment. This is your Brand New Day.<br />We can&apos;t wait to see what you&apos;ll build with us.</p>
            </div>
            <Link href="/apply" className="btn grad">Apply Now <span>→</span></Link>
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section id="timeline">
        <div className="wrap">
          <div className="secHead">
            <div>
              <div className="eyebrow">THE JOURNEY AWAITS</div>
              <h2 className="display grit grit-ink g3" style={{ marginTop: 10 }}>Important dates.<br /><span className="grad">Don&apos;t miss out.</span></h2>
            </div>
            <div className="side">
              <p>Every great journey has a timeline. Mark your calendar and be a part of something extraordinary.</p>
              <p>Don&apos;t just watch. Be a part of the story.</p>
            </div>
          </div>

          <div className="tl">
            {TIMELINE.map((t) => (
              <div className="col" key={t.num}>
                <div className="num" style={{ WebkitTextStroke: `1.5px ${t.color}` }}>{t.num}</div>
                <div className="diamondRow">
                  <div className="track" />
                  <div className="diamond" style={{ borderColor: t.color, boxShadow: `0 0 26px ${t.glow}` }}>
                    <span style={{ color: t.color }}>{t.icon}</span>
                  </div>
                </div>
                <div className="stem" style={{ background: `linear-gradient(180deg,${t.color},rgba(255,255,255,.1))` }} />
                <div className="bead" style={{ background: t.dot, boxShadow: `0 0 16px ${t.glow}` }} />
                <div className="box">
                  <h4 style={{ color: t.color }}>{t.title}</h4>
                  <div className="date">{t.date}</div>
                  <div className="hr" style={{ background: t.color }} />
                  <p>{t.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="banner" style={{ marginTop: 36 }}>
            <div style={{ width: 92, height: 92, flex: "none", borderRadius: 8, border: "1px solid rgba(255,45,79,.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ff5a72", fontSize: 34 }}>📅</div>
            <div style={{ flex: 1 }}>
              <div className="title">READY TO BEGIN YOUR JOURNEY?</div>
              <p>Opportunities don&apos;t happen. You create them.<br /><span style={{ color: "#ff4f6b" }}>Take the first step today.</span></p>
            </div>
            <Link href="/apply" className="btn grad">Apply Now <span>→</span></Link>
          </div>
        </div>
      </section>

      {/* DOMAINS */}
      <section id="domains">
        <div className="wrap">
          <div className="secHead">
            <div>
              <div className="eyebrow" style={{ color: "var(--red-soft)" }}>EXPLORE OUR WORLDS</div>
              <h2 className="display grit grit-ink g2" style={{ marginTop: 10 }}>Different domains.<br /><span className="grad">One mission.</span></h2>
            </div>
            <div className="side">
              <p>Ten domains, five technical and five corporate. Every one of them ships something real — code, campaigns, cuts, contracts — and every one of them needs people who care about the details.</p>
              <p>Pick up to two on the form. Find your path, build your legacy.</p>
            </div>
          </div>

          <DomainGrid />

          <div className="banner" style={{ marginTop: 34, background: "rgba(14,8,17,.55)" }}>
            <div style={{ width: 86, height: 86, flex: "none", borderRadius: "50%", border: "1px solid rgba(255,45,79,.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,45,79,.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--red)" }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: 3, color: "#ff3a58", marginBottom: 12 }}>NOT SURE WHERE YOU FIT?</div>
              <p>Answer eight quick questions, then talk it through with our AI advisor. It reads your answers, argues the trade-offs with you, and points you at the two domains worth picking.</p>
            </div>
            <div style={{ width: 1, height: 64, background: "var(--line)" }} />
            <Link href="/fit" className="btn ghost">Find your fit <span>→</span></Link>
          </div>
        </div>
      </section>

      {/* APPLY */}
      <section id="apply">
        <div className="wrap applyGrid">
          <div>
            <div className="eyebrow">RECRUITMENTS &apos;26</div>
            <h2 className="display grit grit-ink g3 applyLede" style={{ "--ink": "#dcd6de" }}>Your brand new day</h2>
            <h2 className="display grad grit applyShout">Starts here.</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "26px 0 32px" }}>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,#ff2d4f,rgba(255,45,79,.1))" }} />
              <span style={{ color: "var(--red)", fontSize: 20 }}>🕷</span>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(270deg,#8b3dff,rgba(139,61,255,.1))" }} />
            </div>
            <p style={{ margin: 0, fontSize: 19, lineHeight: 1.7, color: "var(--muted2)" }}>
              One form to start: <strong style={{ color: "#f2ebf4" }}>apply → build the task → get shortlisted → interview → done</strong>.
              No hidden rounds, and every stage shows up on your own dashboard.
            </p>
            <p style={{ margin: "18px 0 0", fontSize: 16, lineHeight: 1.7, color: "#9a8d9e" }}>
              Your task brief arrives the moment you apply, and you get{" "}
              <strong style={{ color: "#ff8fa3" }}>exactly 5 days</strong> to submit it — counted from your own
              application, not a shared deadline. Applying early buys you nothing but calm.
            </p>

            <div style={{ marginTop: 34, padding: "26px 28px", borderRadius: 10, border: "1px solid rgba(255,45,79,.3)", background: "linear-gradient(150deg,rgba(255,45,79,.07),rgba(12,7,15,.6))" }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 22 }}>
                <div style={{ width: 34, height: 34, flex: "none", borderRadius: "50%", border: "1px solid rgba(255,45,79,.6)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--red-soft)", fontWeight: 600 }}>i</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: 2.5, color: "#ff3a58", marginBottom: 8 }}>BEFORE YOU APPLY</div>
                  <p style={{ margin: 0, fontSize: 16, color: "#b3a6b7" }}>Keep the following ready for a smooth application experience.</p>
                </div>
              </div>
              <div className="prepGrid">
                {PREP.map((p) => (
                  <div key={p.title} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ color: "var(--red-soft)", fontSize: 20, lineHeight: 1.2 }}>{p.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#f2ebf4" }}>{p.title}</div>
                      <div style={{ fontSize: 13, color: "#9a8d9e", marginTop: 3 }}>{p.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* the form itself lives at /apply — this is the entry point to it */}
          <div className="formCard ctaCard">
            <div className="eyebrow" style={{ letterSpacing: 4, fontSize: 12 }}>STEP ONE</div>
            <h3 style={{ fontSize: 26, margin: "14px 0 14px" }}>Ready to apply?</h3>
            <p style={{ color: "#a99bad", margin: "0 0 26px", lineHeight: 1.7, fontSize: 15.5 }}>
              The form takes about ten minutes. You&apos;ll verify your SRM email with an OTP,
              pick up to two domains, and answer two 200-word questions.
            </p>

            <ul className="ctaList">
              <li><span>✓</span> Applications close <strong>28 August 2026</strong>, 11:59 PM</li>
              <li><span>✓</span> Your task is due <strong>5 days after you apply</strong></li>
              <li><span>✓</span> One application per SRM email</li>
            </ul>

            <Link href="/apply" className="btn grad" style={{ width: "100%", justifyContent: "center" }}>
              Go to application form <span>→</span>
            </Link>
            <div style={{ marginTop: 16, fontSize: 14, color: "#8d8091" }}>
              Already applied?{" "}
              <Link href="/login" style={{ color: "var(--purple-soft)" }}>Track your status →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* QUOTE */}
      <footer className="quote">
        <div className="row">
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(255,45,79,0),#ff2d4f)" }} />
          <span className="cond" style={{ color: "var(--red)", fontSize: 32 }}>&ldquo;</span>
          <div className="txt">
            A <span style={{ color: "#ff3a58" }}>NEW</span> DAY. A <span style={{ color: "var(--pink)" }}>NEW</span> TEAM. A <span style={{ color: "var(--purple-soft)" }}>NEW</span> YOU.
          </div>
          <span className="cond" style={{ color: "var(--purple)", fontSize: 32 }}>&rdquo;</span>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(270deg,rgba(139,61,255,0),#8b3dff)" }} />
        </div>
        <div style={{ marginTop: 26, color: "var(--red)", fontSize: 22 }}>🕷</div>
      </footer>
    </main>
  );
}
