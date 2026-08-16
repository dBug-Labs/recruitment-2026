"use client";

import Link from "next/link";
import Script from "next/script";
import { useState, useRef, useEffect, useCallback } from "react";
import SiteNav from "@/app/_components/SiteNav";
import { DEPARTMENTS, BRANCHES, YEARS, TECH_DOMAINS, CORP_DOMAINS } from "@/lib/schemas";

// Cloudflare injects a hidden `cf-turnstile-response` input into the form,
// which the FormData below picks up automatically.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const SRM_EMAIL_RE = /^[a-zA-Z]{2}\d{4}@srmist\.edu\.in$/i;

/** Same count the server's 200-word cap uses, so the counter cannot disagree. */
const words = (str) => str.trim().split(/\s+/).filter(Boolean).length;

/** Seconds before "Resend code" comes back. Every resend costs a real send. */
const RESEND_COOLDOWN = 45;

/**
 * The application form.
 *
 * ─── Where the OTP sits, and why ─────────────────────────────────────────────
 *
 * Verification used to gate the top of the form: you could not fill anything in
 * until you had asked for a code and typed it back. People asked for a code,
 * wandered off into the rest of the form, let the ten minutes lapse, and asked
 * again — several codes each, most of them never used, all of them spending the
 * one Gmail account's daily allowance.
 *
 * So the gate moved to the end. You fill the whole form, press Submit, and only
 * then does a code go out — in a dialog that verifies and submits in one go.
 * One code per applicant, requested at the moment it is actually needed.
 */
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
  // The address a code was actually accepted for. Comparing it against the live
  // field is what catches someone verifying, then editing the email.
  const [verifiedEmail, setVerifiedEmail] = useState(null);

  const [otpOpen, setOtpOpen] = useState(false);
  const [otpState, setOtpState] = useState("idle"); // idle | sending | sent | verifying
  const [otpError, setOtpError] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const formRef = useRef(null);
  const otpInputRef = useRef(null);

  const isVerified = verifiedEmail !== null && verifiedEmail === srmEmail.trim().toLowerCase();

  const toggleDomain = useCallback((label) => {
    setDomains((prev) => {
      if (prev.includes(label)) return prev.filter((d) => d !== label);
      if (prev.length >= 2) return prev; // max 2
      return [...prev, label];
    });
  }, []);

  // Resend cooldown tick
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (otpOpen) otpInputRef.current?.focus();
  }, [otpOpen]);

  // ─── Step 1: everything except the code ────────────────────────────────────

  /**
   * Runs the browser's own required/type checks plus every rule the server will
   * apply anyway. Deliberately thorough: a code is emailed the moment this
   * passes, so anything caught here instead of by the API is one send saved.
   */
  function validateForm() {
    const errors = {};

    if (!SRM_EMAIL_RE.test(srmEmail.trim())) {
      errors.srmEmail = "Enter your SRM email in the format xx1234@srmist.edu.in";
    }
    const regNo = formRef.current?.elements?.registrationNumber?.value?.trim() ?? "";
    if (!/^RA2\d{12}$/i.test(regNo)) {
      errors.registrationNumber = "Registration number must look like RA2xxxxxxxxxxxx (15 characters)";
    }
    if (selectedDomains.length === 0) {
      errors.domains = "Please select at least one domain preference";
    }
    if (q1.trim().length < 10) {
      errors.question1 = "Please write at least 10 characters";
    } else if (words(q1) > 200) {
      errors.question1 = "Please keep this to 200 words or fewer";
    }
    if (q2.trim().length < 10) {
      errors.question2 = "Please write at least 10 characters";
    } else if (words(q2) > 200) {
      errors.question2 = "Please keep this to 200 words or fewer";
    }
    // Resume is required for 2nd Year + Tech domain
    const isTech = selectedDomains.some((d) => TECH_DOMAINS.includes(d));
    if (year === "2nd Year" && isTech && !resumeFile) {
      errors.resume = "Resume is required for 2nd Year technical applicants";
    }

    setServerErrors(errors);
    if (Object.keys(errors).length > 0) return false;

    // Native validation last, so our messages are not buried by a browser popup
    return formRef.current?.reportValidity() ?? true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (formState === "submitting") return;
    if (!validateForm()) return;

    if (isVerified) {
      await submitApplication();
      return;
    }

    setOtpValue("");
    setOtpError("");
    setOtpOpen(true);
    await requestOtp();
  }

  // ─── Step 2: the code ──────────────────────────────────────────────────────

  async function requestOtp() {
    setOtpError("");
    setOtpState("sending");
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ srmEmail: srmEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send the code");

      // Already verified in an earlier attempt — no code needed, go straight on.
      if (data.alreadyVerified) {
        setVerifiedEmail(srmEmail.trim().toLowerCase());
        setOtpOpen(false);
        setOtpState("idle");
        await submitApplication();
        return;
      }

      setOtpState("sent");
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setOtpError(err.message);
      setOtpState("idle");
    }
  }

  /** Verifies the code and, the moment it lands, sends the application. */
  async function verifyAndSubmit() {
    setOtpError("");
    if (otpValue.length !== 6) {
      setOtpError("Enter all 6 digits");
      return;
    }
    setOtpState("verifying");
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ srmEmail: srmEmail.trim().toLowerCase(), otp: otpValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not verify that code");

      setVerifiedEmail(srmEmail.trim().toLowerCase());
      setOtpOpen(false);
      setOtpState("idle");
      await submitApplication();
    } catch (err) {
      setOtpError(err.message);
      setOtpState("sent");
    }
  }

  /** Closes the dialog so the email can be corrected, keeping the form intact. */
  function changeEmail() {
    setOtpOpen(false);
    setOtpState("idle");
    setOtpValue("");
    setOtpError("");
  }

  // ─── Step 3: the application itself ────────────────────────────────────────

  async function submitApplication() {
    setServerErrors({});
    setFormState("submitting");
    setProgress(0);

    const fd = new FormData(formRef.current);
    fd.delete("domains");
    selectedDomains.forEach((d) => fd.append("domains", d));
    if (resumeFile) fd.set("resume", resumeFile);
    fd.set("srmEmail", srmEmail.trim().toLowerCase());

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
      // The code is spent along with the application attempt — a retry needs a
      // fresh one, and saying so beats a silent 403 from the server.
      if (err?.fields?.srmEmail) setVerifiedEmail(null);
    }
  }

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
            <div style={{ fontSize: 12, color: "#9a8d9e", marginBottom: 4, letterSpacing: 1 }}>YOUR APPLICANT ID</div>
            <div style={{ fontFamily: "monospace", fontSize: 22, color: "#b06bff", letterSpacing: 3 }}>
              {successData?.applicantId}
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
      <SiteNav />

      <section style={{ paddingTop: 120, paddingBottom: 80 }}>
        <div className="wrap" style={{ maxWidth: 860 }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="eyebrow">RECRUITMENTS '26</div>
            <h1 className="display grit grit-ink" style={{ fontSize: 48, marginTop: 12 }}>Application Form</h1>
            <p style={{ color: "#a99bad", fontSize: 16, marginTop: 12 }}>Join a community of dreamers, builders, and problem solvers.</p>
          </div>

          <form className="formCard applyForm" ref={formRef} onSubmit={handleSubmit}>
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

            <div className="otpBox">
              <label htmlFor="srmEmail">SRM Email <span className="req">*</span></label>
              <div className="otpRow">
                <div className="otpField">
                  <input
                    id="srmEmail"
                    className="input"
                    name="srmEmail"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="xx1234@srmist.edu.in"
                    value={srmEmail}
                    onChange={(e) => {
                      setSrmEmail(e.target.value);
                      setServerErrors((p) => ({ ...p, srmEmail: undefined }));
                    }}
                    style={serverErrors.srmEmail ? { borderColor: "var(--pink)" } : {}}
                  />
                  {serverErrors.srmEmail && <span style={{ fontSize: 12, color: "var(--pink)", marginTop: 4, display: "block" }}>{serverErrors.srmEmail}</span>}
                </div>
                {isVerified && (
                  <div style={{ padding: "10px 16px", color: "#00e676", background: "rgba(0,230,118,0.1)", borderRadius: 6, border: "1px solid rgba(0,230,118,0.3)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span>✓</span> Verified
                  </div>
                )}
              </div>
              <div style={{ fontSize: 13, color: "#8d8091", marginTop: 10, lineHeight: 1.6 }}>
                {isVerified
                  ? "This address is verified — hit Submit whenever you're ready."
                  : "We'll email a 6-digit code to this address when you hit Submit. Fill the rest of the form first."}
              </div>
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
              {/* Free text, not a dropdown — the lists below are only suggestions,
                  so anything the university actually calls a course still fits. */}
              <div>
                <label>Branch <span className="req">*</span></label>
                <input className="input" name="branch" list="branch-options" required
                  placeholder="B.Tech" autoComplete="off"
                  style={serverErrors.branch ? { borderColor: "var(--pink)" } : {}} />
                <datalist id="branch-options">
                  {BRANCHES.map(b => <option key={b} value={b} />)}
                </datalist>
                {serverErrors.branch && <span style={{ fontSize: 12, color: "var(--pink)", marginTop: 4, display: "block" }}>{serverErrors.branch}</span>}
              </div>
              <div>
                <label>Department <span className="req">*</span></label>
                <input className="input" name="department" list="department-options" required
                  placeholder="CSE — Cloud Computing" autoComplete="off"
                  style={serverErrors.department ? { borderColor: "var(--pink)" } : {}} />
                <datalist id="department-options">
                  {DEPARTMENTS.map(d => <option key={d} value={d} />)}
                </datalist>
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
                  <span className="counter" style={{ bottom: 12, right: 12 }}>{words(q1)}/200 words</span>
                </div>
                {serverErrors.question1 && <span style={{ fontSize: 12, color: "var(--pink)", marginTop: 4, display: "block" }}>{serverErrors.question1}</span>}
              </div>
              <div>
                <label>What skills or experiences make you a good fit? <span className="req">*</span></label>
                <div style={{ position: "relative" }}>
                  <textarea className="input" name="question2" placeholder="Tell us about your background..." rows={4}
                    value={q2} onChange={e => setQ2(e.target.value)} style={serverErrors.question2 ? { borderColor: "var(--pink)" } : {}} />
                  <span className="counter" style={{ bottom: 12, right: 12 }}>{words(q2)}/200 words</span>
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

            {TURNSTILE_SITE_KEY && (
              <div style={{ marginBottom: 20 }}>
                <Script
                  src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                  strategy="lazyOnload"
                />
                <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-theme="dark" />
              </div>
            )}

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

            <button type="submit" className="btn grad submit"
              disabled={formState === "submitting" || otpOpen}
              style={(formState === "submitting" || otpOpen) ? { opacity: .7, cursor: "not-allowed" } : {}}>
              {formState === "submitting" ? "Submitting…" : "Submit Application"} <span>{formState === "submitting" ? "" : "→"}</span>
            </button>
            <div style={{ marginTop: 18, textAlign: "center", fontSize: 14, color: "#9a8d9e" }}>
              {isVerified
                ? "Upon submission, we will send an email with your dashboard access password."
                : "One last step after this: a 6-digit code goes to your SRM email to confirm it's yours."}
            </div>
          </form>
        </div>
      </section>

      {otpOpen && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Verify your SRM email"
          onClick={(e) => e.target === e.currentTarget && changeEmail()}>
          <div className="formCard modalCard" style={{ maxWidth: 460 }}>
            <button type="button" className="close" onClick={changeEmail} aria-label="Close">×</button>
            <h2 className="modalTitle">Verify your SRM email</h2>
            <p style={{ color: "#a99bad", fontSize: 14.5, margin: "-10px 0 20px", lineHeight: 1.65 }}>
              {otpState === "sending"
                ? <>Sending a 6-digit code to <strong style={{ color: "#f4eef6" }}>{srmEmail}</strong>…</>
                : <>We sent a 6-digit code to <strong style={{ color: "#f4eef6" }}>{srmEmail}</strong>. Enter it below and your application goes in.</>}
            </p>

            {otpError && <div className="alert err">⚠ {otpError}</div>}

            <label htmlFor="otp">6-digit code</label>
            <input
              id="otp"
              ref={otpInputRef}
              className="input"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="• • • • • •"
              maxLength={6}
              value={otpValue}
              onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); verifyAndSubmit(); } }}
              disabled={otpState === "sending" || otpState === "verifying"}
              style={{ letterSpacing: 8, fontSize: 20, fontFamily: "ui-monospace, monospace", textAlign: "center", marginTop: 6 }}
            />

            <button type="button" className="btn grad"
              onClick={verifyAndSubmit}
              disabled={otpState === "sending" || otpState === "verifying" || otpValue.length !== 6}
              style={{ width: "100%", justifyContent: "center", marginTop: 18 }}>
              {otpState === "verifying" ? "Verifying…" : "Verify & submit application"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 16, fontSize: 13.5 }}>
              <button type="button" className="btnQuiet" onClick={requestOtp}
                disabled={otpState === "sending" || otpState === "verifying" || cooldown > 0}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
              <button type="button" className="btnQuiet" onClick={changeEmail}>
                Use a different email
              </button>
            </div>

            <p style={{ color: "#8d8091", fontSize: 12.5, margin: "16px 0 0", lineHeight: 1.6 }}>
              The code expires in 10 minutes. Check your spam folder if it hasn&apos;t arrived.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
