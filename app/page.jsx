"use client";

import Image from "next/image";
import { useState } from "react";

const NAV = ["Home", "Domains", "Timeline", "Process", "FAQs", "Contact"];

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

const TIMELINE = [
  { num: "01", icon: "☰", title: "APPLICATIONS OPEN", date: "25 MAY 2026", body: "The first step towards an incredible journey begins here.", color: "#ff2d4f", dot: "#ff2d4f", glow: "rgba(255,45,79,.45)" },
  { num: "02", icon: "☑", title: "APPLICATIONS CLOSE", date: "08 JUNE 2026", body: "Make sure to submit your application before it's too late.", color: "#b06bff", dot: "#ffffff", glow: "rgba(176,107,255,.45)" },
  { num: "03", icon: "☺", title: "SHORTLISTING", date: "10 – 12 JUNE 2026", body: "Our team will review applications and shortlist the brightest minds.", color: "#ff2d4f", dot: "#ff2d4f", glow: "rgba(255,45,79,.45)" },
  { num: "04", icon: "▭", title: "INTERVIEWS", date: "14 – 20 JUNE 2026", body: "Showcase your skills, passion and potential.", color: "#b06bff", dot: "#ffffff", glow: "rgba(176,107,255,.45)" },
  { num: "05", icon: "☆", title: "RESULTS OUT", date: "22 JUNE 2026", body: "The next chapter begins. Welcome to dBug Labs.", color: "#ff2d4f", dot: "#ffffff", glow: "rgba(255,45,79,.45)" },
];

const DOMAINS = [
  { num: "01", icon: "‹›", title: "WEB DEVELOPMENT", body: "Building responsive, scalable and beautiful web experiences.", color: "#ff3a58", border: "rgba(255,45,79,.35)", wash: "rgba(255,45,79,.10)" },
  { num: "02", icon: "◎", title: "AI / ML", body: "Teaching machines to learn, adapt and solve real world problems.", color: "#b06bff", border: "rgba(139,61,255,.32)", wash: "rgba(139,61,255,.10)" },
  { num: "03", icon: "▯", title: "APP DEVELOPMENT", body: "Crafting intuitive and powerful mobile applications.", color: "#ff3a7a", border: "rgba(255,58,122,.32)", wash: "rgba(255,58,122,.09)" },
  { num: "04", icon: "✒", title: "CREATIVE DESIGN", body: "Designing visuals that communicate, engage and leave a mark.", color: "#b06bff", border: "rgba(139,61,255,.3)", wash: "rgba(139,61,255,.09)" },
  { num: "05", icon: "◠", title: "PUBLIC RELATIONS", body: "Amplifying our voice and building meaningful connections.", color: "#ff3a58", border: "rgba(255,45,79,.4)", wash: "rgba(255,45,79,.14)" },
  { num: "06", icon: "≋", title: "CORPORATE & EVENTS", body: "Planning, organizing and managing events that create memories.", color: "#c07adf", border: "rgba(139,61,255,.3)", wash: "rgba(139,61,255,.08)" },
];

const PREP = [
  { icon: "▤", title: "Resume / CV", sub: "PDF or Link" },
  { icon: "▭", title: "College ID", sub: "Clear Copy" },
  { icon: "▱", title: "Portfolio (Optional)", sub: "Link or File" },
  { icon: "♡", title: "Why dBug Labs?", sub: "Your Answer" },
];

const STEPS = [
  { n: "1", icon: "▤", title: "Apply Online", body: "Fill out the application form." },
  { n: "2", icon: "☺", title: "Screening", body: "Shortlisted applications move forward." },
  { n: "3", icon: "▭", title: "Interviews", body: "Showcase your skills and personality." },
  { n: "4", icon: "⚬", title: "Final Round", body: "Meet the core team and align our vision." },
  { n: "5", icon: "☆", title: "Welcome Aboard", body: "Begin your journey with dBug Labs!" },
];

const HREF = { Home: "#top", Domains: "#domains", Timeline: "#timeline", Process: "#why", FAQs: "#why", Contact: "#apply" };

export default function Page() {
  const [why, setWhy] = useState("");

  return (
    <main id="top">
      {/* NAV */}
      <nav className="nav">
        <div className="wrap inner">
          <div className="brand">
            <Image src="/logo.png" alt="dBug Labs" width={36} height={36} />
            <span>dBug Labs</span>
          </div>
          <div className="navLinks">
            {NAV.map((n, i) => (
              <a key={n} href={HREF[n]} className={i === 0 ? "active" : ""}>{n}</a>
            ))}
          </div>
          <a href="#apply" className="btn grad sm">Apply Now <span>→</span></a>
        </div>
      </nav>

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
              <a href="#apply" className="btn grad">Apply Now <span>→</span></a>
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
            <a href="#apply" className="btn grad">Apply Now <span>→</span></a>
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
            <a href="#apply" className="btn grad">Apply Now <span>→</span></a>
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
              <p>From coding the future to designing experiences, from learning machines to managing moments — every domain plays a vital role in building impact.</p>
              <p>Find your path. Build your legacy.</p>
            </div>
          </div>

          <div className="cards3">
            {DOMAINS.map((d) => (
              <div className="domain" key={d.num} style={{ borderColor: d.border, background: `linear-gradient(150deg,${d.wash},rgba(11,6,14,.85) 60%)` }}>
                <div className="n" style={{ color: d.color }}>{d.num}</div>
                <div className="ico" style={{ color: d.color }}>{d.icon}</div>
                <h4 style={{ color: d.color }}>{d.title}</h4>
                <p>{d.body}</p>
                <a href="#apply" style={{ color: d.color }}>Explore <span>→</span></a>
              </div>
            ))}
          </div>

          <div className="banner" style={{ marginTop: 34, background: "rgba(14,8,17,.55)" }}>
            <div style={{ width: 86, height: 86, flex: "none", borderRadius: "50%", border: "1px solid rgba(255,45,79,.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,45,79,.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--red)" }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: 3, color: "#ff3a58", marginBottom: 12 }}>NOT SURE WHERE YOU FIT?</div>
              <p>Take our quick domain selector quiz and we&apos;ll suggest the best domains for you!</p>
            </div>
            <div style={{ width: 1, height: 64, background: "var(--line)" }} />
            <a href="#apply" className="btn ghost">Take the Quiz <span>→</span></a>
          </div>
        </div>
      </section>

      {/* APPLY */}
      <section id="apply">
        <div className="wrap applyGrid">
          <div>
            <div className="eyebrow">RECRUITMENTS &apos;26</div>
            <h2 className="display grit grit-ink g3" style={{ fontSize: 56, lineHeight: 1.05, "--ink": "#dcd6de", marginTop: 12 }}>Your brand new day</h2>
            <h2 className="display grad grit" style={{ fontSize: 104, lineHeight: 1, marginTop: 6 }}>Starts here.</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "26px 0 32px" }}>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,#ff2d4f,rgba(255,45,79,.1))" }} />
              <span style={{ color: "var(--red)", fontSize: 20 }}>🕷</span>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(270deg,#8b3dff,rgba(139,61,255,.1))" }} />
            </div>
            <p style={{ margin: 0, fontSize: 19, lineHeight: 1.7, color: "var(--muted2)" }}>
              Take the first step toward an unforgettable journey.<br />Fill out the application form and let&apos;s build the future together.
            </p>

            <div style={{ marginTop: 34, padding: "26px 28px", borderRadius: 10, border: "1px solid rgba(255,45,79,.3)", background: "linear-gradient(150deg,rgba(255,45,79,.07),rgba(12,7,15,.6))" }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 22 }}>
                <div style={{ width: 34, height: 34, flex: "none", borderRadius: "50%", border: "1px solid rgba(255,45,79,.6)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--red-soft)", fontWeight: 600 }}>i</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: 2.5, color: "#ff3a58", marginBottom: 8 }}>BEFORE YOU APPLY</div>
                  <p style={{ margin: 0, fontSize: 16, color: "#b3a6b7" }}>Keep the following ready for a smooth application experience.</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 18 }}>
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

            <div style={{ marginTop: 44 }}>
              <div className="eyebrow" style={{ letterSpacing: 6, marginBottom: 28 }}>THE JOURNEY AHEAD</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 14 }}>
                {STEPS.map((s) => (
                  <div key={s.n}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 58, height: 58, flex: "none", borderRadius: "50%", border: "1px solid rgba(255,45,79,.45)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--red-soft)", fontSize: 22 }}>{s.icon}</div>
                      <span style={{ color: "rgba(255,45,79,.6)", fontSize: 15 }}>»</span>
                    </div>
                    <div style={{ fontSize: 14, color: "#8d8091", margin: "10px 0 8px" }}>{s.n}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#f2ebf4", marginBottom: 8 }}>{s.title}</div>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#9a8d9e" }}>{s.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FORM */}
          <form className="formCard" onSubmit={(e) => e.preventDefault()}>
            <h3>APPLICATION FORM</h3>
            <p style={{ margin: "12px 0 26px", fontSize: 16, color: "#b3a6b7" }}>
              Fill in your details. All fields marked <span className="req">*</span> are mandatory.
            </p>

            <div className="groupTitle" style={{ marginTop: 0, color: "var(--pink)" }}>PERSONAL INFORMATION</div>
            <div className="two">
              <div>
                <label>Full Name <span className="req">*</span></label>
                <input className="input" placeholder="Enter your full name" required />
              </div>
              <div>
                <label>Email Address <span className="req">*</span></label>
                <input className="input" type="email" placeholder="Enter your email address" required />
              </div>
              <div>
                <label>Phone Number <span className="req">*</span></label>
                <div style={{ display: "flex", gap: 12 }}>
                  <select className="input" style={{ width: 92, color: "var(--text)" }}>
                    <option>+91</option><option>+1</option><option>+44</option>
                  </select>
                  <input className="input" placeholder="Enter your phone number" required />
                </div>
              </div>
              <div>
                <label>College / University <span className="req">*</span></label>
                <input className="input" placeholder="Enter your college name" required />
              </div>
              <div>
                <label>Year of Study <span className="req">*</span></label>
                <select className="input" defaultValue="">
                  <option value="" disabled>Select your year</option>
                  <option>1st Year</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option>
                </select>
              </div>
              <div>
                <label>Branch / Department <span className="req">*</span></label>
                <select className="input" defaultValue="">
                  <option value="" disabled>Select your branch</option>
                  <option>CSE</option><option>IT</option><option>ECE</option><option>Other</option>
                </select>
              </div>
            </div>

            <div className="groupTitle" style={{ color: "var(--lilac)" }}>APPLICATION DETAILS</div>
            <div className="two">
              <div>
                <label>Domain Preference (Select up to 2) <span className="req">*</span></label>
                <select className="input" defaultValue="">
                  <option value="" disabled>Select your preference</option>
                  {DOMAINS.map((d) => <option key={d.num}>{d.title.replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase())}</option>)}
                </select>
              </div>
              <div>
                <label>Why do you want to join dBug Labs? <span className="req">*</span></label>
                <div style={{ position: "relative" }}>
                  <textarea className="input" placeholder="Tell us what drives you..." maxLength={500}
                    value={why} onChange={(e) => setWhy(e.target.value)} />
                  <span className="counter">{why.length}/500</span>
                </div>
              </div>
            </div>

            <label style={{ marginTop: 24 }}>Resume / CV <span className="req">*</span></label>
            <div className="drop">
              <span style={{ fontSize: 26, color: "var(--purple-soft)" }}>⇧</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, color: "#f2ebf4" }}>Upload your resume</div>
                <div style={{ fontSize: 14, color: "#9a8d9e", marginTop: 3 }}>PDF (Max. 10MB)</div>
              </div>
              <label className="chooseFile" style={{ margin: 0 }}>
                Choose File
                <input type="file" accept="application/pdf" hidden />
              </label>
            </div>

            <label style={{ marginTop: 24 }}>Portfolio / Work (Optional)</label>
            <div style={{ position: "relative" }}>
              <input className="input" style={{ paddingRight: 46 }} placeholder="Paste your portfolio link (Behance, GitHub, Drive, etc.)" />
              <span style={{ position: "absolute", right: 14, top: 13, color: "var(--purple-soft)", fontSize: 18 }}>🔗</span>
            </div>

            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", margin: "24px 0 26px" }}>
              <input type="checkbox" className="check" id="declare" required />
              <label htmlFor="declare" style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#cec2d1" }}>
                I hereby declare that the information provided is true and correct to the best of my knowledge. <span className="req">*</span>
              </label>
            </div>

            <button type="submit" className="btn grad submit">Submit Application <span>→</span></button>
            <div style={{ marginTop: 18, textAlign: "center", fontSize: 15, color: "#9a8d9e" }}>🔒 Your information is safe with us and will not be shared.</div>
          </form>
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
