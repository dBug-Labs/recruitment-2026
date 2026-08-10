"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useCallback } from "react";
import { DEPARTMENTS, BRANCHES, YEARS, TECH_DOMAINS, CORP_DOMAINS } from "@/lib/schemas";

export default function ApplyPage() {
  const [formState, setFormState] = useState("idle"); // idle | submitting | success | error
  const [progress, setProgress] = useState(0);
  const [serverErrors, setServerErrors] = useState({});
  const [successData, setSuccessData] = useState(null);
  
  const [selectedDomains, setDomains] = useState([]);
  const [resumeFile, setResumeFile] = useState(null);
  const [year, setYear] = useState("");
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");

  const [srmEmail, setSrmEmail] = useState("");
  const [otpState, setOtpState] = useState("idle"); // idle | sending | sent | verifying | verified
  const [otpError, setOtpError] = useState("");
  const [otpValue, setOtpValue] = useState("");

  const formRef = useRef(null);

  const toggleDomain = useCallback((label) => {
    setDomains((prev) => {
      if (prev.includes(label)) return prev.filter((d) => d !== label);
      if (prev.length >= 2) return prev; // max 2
      return [...prev, label];
    });
  }, []);

  const sendOtp = async () => {
    setOtpError("");
    if (!/^[a-zA-Z]{2}\d{4}@srmist\.edu\.in$/i.test(srmEmail)) {
      setOtpError("Please enter a valid SRM email (xx1234@srmist.edu.in)");
      return;
    }
    setOtpState("sending");
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ srmEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      setOtpState("sent");
    } catch (err) {
      setOtpError(err.message);
      setOtpState("idle");
    }
  };

  const verifyOtp = async () => {
    setOtpError("");
    if (otpValue.length !== 6) {
      setOtpError("OTP must be 6 digits");
      return;
    }
    setOtpState("verifying");
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ srmEmail, otp: otpValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify OTP");
      setOtpState("verified");
    } catch (err) {
      setOtpError(err.message);
      setOtpState("sent");
    }
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setServerErrors({});
    
    if (otpState !== "verified") {
      setServerErrors({ srmEmail: "Please verify your SRM email first" });
      return;
    }
    if (selectedDomains.length === 0) {
      setServerErrors({ domains: "Please select at least one domain preference" });
      return;
    }

    setFormState("submitting");
    setProgress(0);

    const fd = new FormData(formRef.current);
    fd.delete("domains");
    selectedDomains.forEach((d) => fd.append("domains", d));
    
    // Resume is required for 2nd Year + Tech domain
    const isTech = selectedDomains.some(d => TECH_DOMAINS.includes(d));
    if (year === "2nd Year" && isTech && !resumeFile) {
      setServerErrors({ resume: "Resume is required for 2nd Year technical applicants" });
      setFormState("error");
      return;
    }

    if (resumeFile) fd.set("resume", resumeFile);
    // Explicitly set srmEmail since the input might be disabled after verification
    fd.set("srmEmail", srmEmail);

    try {
      const data = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/applications");
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          try {
            const json = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) resolve(json);
            else reject(json);
          } catch {
            reject({ error: "Unexpected server response" });
          }
        };
        xhr.onerror = () => reject({ error: "Network error — please check your connection" });
        xhr.send(fd);
      });
      setSuccessData(data);
      setFormState("success");
    } catch (err) {
      if (err?.fields) setServerErrors(err.fields);
      setServerErrors((prev) => ({ ...prev, _general: err?.error ?? "Submission failed. Please try again." }));
      setFormState("error");
    }
  }, [selectedDomains, resumeFile, otpState, srmEmail, year]);

  if (formState === "success") {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="formCard" style={{ textAlign: "center", padding: "56px 32px", maxWidth: 600 }}>
          <div style={{ fontSize: 52, marginBottom: 20 }}>🎉</div>
          <h3 style={{ color: "var(--pink)", marginBottom: 14 }}>Application Accepted!</h3>
          <p style={{ color: "#cec2d1", fontSize: 16, marginBottom: 28, lineHeight: 1.7 }}>
            Welcome to the first step of your journey with dBug Labs.<br />
            We've sent a confirmation email to <strong>{srmEmail}</strong> with your unique dashboard password.
          </p>
          <div style={{ background: "rgba(176,107,255,.1)", border: "1px solid rgba(176,107,255,.3)",
            borderRadius: 10, padding: "14px 24px", display: "inline-block", marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: "#9a8d9e", marginBottom: 4, letterSpacing: 1 }}>APPLICATION ID</div>
            <div style={{ fontFamily: "monospace", fontSize: 15, color: "#b06bff", letterSpacing: 2 }}>
              {successData?.applicationId}
            </div>
          </div>
          <div>
            <Link href="/login" className="btn grad sm">Go to Login <span>→</span></Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <nav className="nav">
        <div className="wrap inner">
          <Link href="/" className="brand" style={{ color: "var(--text)" }}>
            <Image src="/logo.png" alt="dBug Labs" width={36} height={36} />
            <span>dBug Labs</span>
          </Link>
          <div className="navLinks">
            <Link href="/login">Login</Link>
          </div>
        </div>
      </nav>

      <section style={{ paddingTop: 120, paddingBottom: 80 }}>
        <div className="wrap" style={{ maxWidth: 860 }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="eyebrow">RECRUITMENTS '26</div>
            <h1 className="display grit grit-ink" style={{ fontSize: 48, marginTop: 12 }}>Application Form</h1>
            <p style={{ color: "#a99bad", fontSize: 16, marginTop: 12 }}>Join a community of dreamers, builders, and problem solvers.</p>
          </div>

          <form className="formCard" ref={formRef} onSubmit={handleSubmit} style={{ padding: "40px 48px" }}>
            <input name="_hp" type="text" style={{ display: "none" }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
            
            {serverErrors._general && (
              <div style={{ background: "rgba(255,45,79,.12)", border: "1px solid rgba(255,45,79,.4)",
                borderRadius: 8, padding: "12px 16px", marginBottom: 24, color: "#ff6b85", fontSize: 14 }}>
                ⚠ {serverErrors._general}
              </div>
            )}

            <div className="groupTitle" style={{ marginTop: 0, color: "var(--pink)" }}>PERSONAL DETAILS</div>
            <div className="two" style={{ marginBottom: 24 }}>
              <div>
                <label>Full Name <span className="req">*</span></label>
                <input className="input" name="name" placeholder="John Doe" required style={serverErrors.name ? { borderColor: "var(--pink)" } : {}} />
                {serverErrors.name && <span style={{ fontSize: 12, color: "var(--pink)", marginTop: 4, display: "block" }}>{serverErrors.name}</span>}
              </div>
              <div>
                <label>Personal Email <span className="req">*</span></label>
                <input className="input" name="personalEmail" type="email" placeholder="john@gmail.com" required style={serverErrors.personalEmail ? { borderColor: "var(--pink)" } : {}} />
                {serverErrors.personalEmail && <span style={{ fontSize: 12, color: "var(--pink)", marginTop: 4, display: "block" }}>{serverErrors.personalEmail}</span>}
              </div>
            </div>

            <div style={{ marginBottom: 32, padding: 24, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}>
              <label>SRM Email <span className="req">*</span></label>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <input 
                    className="input" 
                    type="email" 
                    placeholder="xx1234@srmist.edu.in" 
                    value={srmEmail}
                    onChange={e => setSrmEmail(e.target.value)}
                    disabled={otpState === "verified" || otpState === "sending" || otpState === "verifying"}
                    style={serverErrors.srmEmail ? { borderColor: "var(--pink)" } : {}} 
                  />
                  {serverErrors.srmEmail && <span style={{ fontSize: 12, color: "var(--pink)", marginTop: 4, display: "block" }}>{serverErrors.srmEmail}</span>}
                </div>
                {otpState === "idle" && (
                  <button type="button" className="btn ghost" onClick={sendOtp}>Send OTP</button>
                )}
                {otpState === "sending" && (
                  <button type="button" className="btn ghost" disabled>Sending...</button>
                )}
                {otpState === "verified" && (
                  <div style={{ padding: "10px 16px", color: "#00e676", background: "rgba(0,230,118,0.1)", borderRadius: 6, border: "1px solid rgba(0,230,118,0.3)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span>✓</span> Verified
                  </div>
                )}
              </div>
              
              {otpError && <div style={{ color: "var(--pink)", fontSize: 13, marginTop: 8 }}>{otpError}</div>}
              
              {(otpState === "sent" || otpState === "verifying") && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px dashed rgba(255,255,255,0.1)" }}>
                  <label>Enter 6-digit OTP</label>
                  <div style={{ display: "flex", gap: 12 }}>
                    <input 
                      className="input" 
                      placeholder="• • • • • •" 
                      maxLength={6}
                      value={otpValue}
                      onChange={e => setOtpValue(e.target.value.replace(/\D/g, ''))}
                      disabled={otpState === "verifying"}
                      style={{ letterSpacing: 8, fontSize: 18, fontFamily: "monospace", maxWidth: 160 }}
                    />
                    <button type="button" className="btn grad sm" onClick={verifyOtp} disabled={otpState === "verifying"}>
                      {otpState === "verifying" ? "Verifying..." : "Verify OTP"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="groupTitle" style={{ color: "var(--lilac)" }}>ACADEMIC DETAILS</div>
            <div className="two">
              <div>
                <label>Registration Number <span className="req">*</span></label>
                <input className="input" name="registrationNumber" placeholder="RA2xxxxxxxxxxxx" required style={serverErrors.registrationNumber ? { borderColor: "var(--pink)" } : {}} />
                {serverErrors.registrationNumber && <span style={{ fontSize: 12, color: "var(--pink)", marginTop: 4, display: "block" }}>{serverErrors.registrationNumber}</span>}
              </div>
              <div>
                <label>Year of Study <span className="req">*</span></label>
                <select className="input" name="year" value={year} onChange={e => setYear(e.target.value)} required style={serverErrors.year ? { borderColor: "var(--pink)" } : {}}>
                  <option value="" disabled>Select Year</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                {serverErrors.year && <span style={{ fontSize: 12, color: "var(--pink)", marginTop: 4, display: "block" }}>{serverErrors.year}</span>}
              </div>
              <div>
                <label>Branch <span className="req">*</span></label>
                <select className="input" name="branch" defaultValue="" required style={serverErrors.branch ? { borderColor: "var(--pink)" } : {}}>
                  <option value="" disabled>Select Branch</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                {serverErrors.branch && <span style={{ fontSize: 12, color: "var(--pink)", marginTop: 4, display: "block" }}>{serverErrors.branch}</span>}
              </div>
              <div>
                <label>Department <span className="req">*</span></label>
                <select className="input" name="department" defaultValue="" required style={serverErrors.department ? { borderColor: "var(--pink)" } : {}}>
                  <option value="" disabled>Select Department</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {serverErrors.department && <span style={{ fontSize: 12, color: "var(--pink)", marginTop: 4, display: "block" }}>{serverErrors.department}</span>}
              </div>
            </div>

            <div className="groupTitle" style={{ color: "var(--purple-soft)" }}>DOMAIN PREFERENCES</div>
            <div style={{ marginBottom: 32 }}>
              <label>Select Domains (Max 2) <span className="req">*</span></label>
              
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "#8d8091", letterSpacing: 1, marginBottom: 8 }}>TECHNICAL DOMAINS</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {TECH_DOMAINS.map(label => {
                    const selected = selectedDomains.includes(label);
                    const disabled = !selected && selectedDomains.length >= 2;
                    return (
                      <button type="button" key={label} onClick={() => !disabled && toggleDomain(label)}
                        style={{
                          padding: "6px 14px", borderRadius: 20, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer",
                          border: selected ? "1px solid var(--pink)" : "1px solid rgba(255,255,255,.15)",
                          background: selected ? "rgba(255,45,79,.18)" : "rgba(255,255,255,.04)",
                          color: selected ? "var(--pink)" : disabled ? "#555" : "#cec2d1",
                          transition: "all .2s",
                        }}>
                        {selected ? "✓ " : ""}{label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: "#8d8091", letterSpacing: 1, marginBottom: 8 }}>CORPORATE DOMAINS</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {CORP_DOMAINS.map(label => {
                    const selected = selectedDomains.includes(label);
                    const disabled = !selected && selectedDomains.length >= 2;
                    return (
                      <button type="button" key={label} onClick={() => !disabled && toggleDomain(label)}
                        style={{
                          padding: "6px 14px", borderRadius: 20, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer",
                          border: selected ? "1px solid var(--purple-soft)" : "1px solid rgba(255,255,255,.15)",
                          background: selected ? "rgba(176,107,255,.18)" : "rgba(255,255,255,.04)",
                          color: selected ? "var(--purple-soft)" : disabled ? "#555" : "#cec2d1",
                          transition: "all .2s",
                        }}>
                        {selected ? "✓ " : ""}{label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {serverErrors.domains && <span style={{ fontSize: 12, color: "var(--pink)", marginTop: 8, display: "block" }}>{serverErrors.domains}</span>}
            </div>

            <div className="groupTitle" style={{ color: "var(--red)" }}>QUESTIONS</div>
            <div className="two" style={{ marginBottom: 32 }}>
              <div>
                <label>Why do you want to join dBug Labs? <span className="req">*</span></label>
                <div style={{ position: "relative" }}>
                  <textarea className="input" name="question1" placeholder="Tell us your motivation..." rows={4}
                    value={q1} onChange={e => setQ1(e.target.value)} style={serverErrors.question1 ? { borderColor: "var(--pink)" } : {}} />
                  <span className="counter" style={{ bottom: 12, right: 12 }}>{q1.trim().split(/\s+/).filter(Boolean).length}/200 words</span>
                </div>
                {serverErrors.question1 && <span style={{ fontSize: 12, color: "var(--pink)", marginTop: 4, display: "block" }}>{serverErrors.question1}</span>}
              </div>
              <div>
                <label>What skills or experiences make you a good fit? <span className="req">*</span></label>
                <div style={{ position: "relative" }}>
                  <textarea className="input" name="question2" placeholder="Tell us about your background..." rows={4}
                    value={q2} onChange={e => setQ2(e.target.value)} style={serverErrors.question2 ? { borderColor: "var(--pink)" } : {}} />
                  <span className="counter" style={{ bottom: 12, right: 12 }}>{q2.trim().split(/\s+/).filter(Boolean).length}/200 words</span>
                </div>
                {serverErrors.question2 && <span style={{ fontSize: 12, color: "var(--pink)", marginTop: 4, display: "block" }}>{serverErrors.question2}</span>}
              </div>
            </div>

            <label>Resume / CV {(year === "2nd Year" && selectedDomains.some(d => TECH_DOMAINS.includes(d))) && <span className="req">*</span>}</label>
            <div className="drop" style={serverErrors.resume ? { borderColor: "var(--pink)" } : {}}>
              <span style={{ fontSize: 26, color: "var(--purple-soft)" }}>⇧</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, color: "#f2ebf4" }}>
                  {resumeFile ? resumeFile.name : "Upload your resume"}
                </div>
                <div style={{ fontSize: 14, color: "#9a8d9e", marginTop: 3 }}>
                  {resumeFile ? `${(resumeFile.size / 1024 / 1024).toFixed(2)} MB — PDF` : "PDF only · Max 4 MB"}
                </div>
              </div>
              <label className="chooseFile" style={{ margin: 0 }}>
                {resumeFile ? "Change" : "Choose File"}
                <input type="file" accept="application/pdf" hidden
                  onChange={(e) => { setResumeFile(e.target.files?.[0] ?? null); setServerErrors((p) => ({ ...p, resume: undefined })); }} />
              </label>
            </div>
            {serverErrors.resume && <span style={{ fontSize: 12, color: "var(--pink)", marginTop: 6, display: "block" }}>{serverErrors.resume}</span>}
            <div style={{ fontSize: 13, color: "#8d8091", marginTop: 8, marginBottom: 32 }}>
              Resume is mandatory for 2nd Year technical applicants. Optional for others.
            </div>

            {formState === "submitting" && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#9a8d9e", marginBottom: 6 }}>
                  <span>Uploading & Submitting…</span><span>{progress}%</span>
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,.08)", borderRadius: 4 }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,var(--pink),var(--purple-soft))",
                    borderRadius: 4, transition: "width .2s" }} />
                </div>
              </div>
            )}

            <button type="submit" className="btn grad submit" disabled={formState === "submitting" || otpState !== "verified"}
              style={(formState === "submitting" || otpState !== "verified") ? { opacity: .7, cursor: "not-allowed" } : {}}>
              {formState === "submitting" ? "Submitting…" : "Submit Application"} <span>{formState === "submitting" ? "" : "→"}</span>
            </button>
            <div style={{ marginTop: 18, textAlign: "center", fontSize: 14, color: "#9a8d9e" }}>
              Upon submission, we will send an email with your dashboard access password.
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
