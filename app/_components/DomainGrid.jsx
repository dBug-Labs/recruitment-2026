"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DomainArt from "./DomainArt";
import { TECH_DOMAIN_CARDS, CORP_DOMAIN_CARDS } from "./domains";

function DomainModal({ domain, onClose }) {
  // Escape closes it, and the body must not scroll behind the sheet
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="modalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="domain-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="formCard modalCard domainModal">
        <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>

        <div className="domainModalArt" style={{ background: `linear-gradient(150deg,${domain.wash},transparent 70%)` }}>
          <DomainArt motif={domain.key} accent={domain.color} />
        </div>

        <div style={{ fontSize: 11.5, letterSpacing: 2.5, color: "#8d8091", margin: "18px 0 6px" }}>
          {domain.group === "tech" ? "TECHNICAL DOMAIN" : "CORPORATE DOMAIN"} · {domain.num}
        </div>
        <h2 id="domain-modal-title" className="modalTitle" style={{ color: domain.color, marginBottom: 14 }}>
          {domain.label}
        </h2>

        <p style={{ color: "#cfc3d2", fontSize: 15.5, lineHeight: 1.7, margin: "0 0 22px" }}>
          {domain.what}
        </p>

        <div className="domainModalSection">
          <h3>WHAT YOU&apos;D ACTUALLY DO</h3>
          <ul>
            {domain.work.map((w) => (
              <li key={w}><span style={{ color: domain.color }}>▸</span> {w}</li>
            ))}
          </ul>
        </div>

        <div className="domainModalSection">
          <h3>WHAT WE LOOK FOR</h3>
          <p className="domainModalNote">
            Skill is welcome, but it is not the bar. We mostly look for people who are
            genuinely eager to learn — everything below can be picked up here.
          </p>
          <ul>
            {domain.looking.map((l) => (
              <li key={l}><span style={{ color: domain.color }}>▸</span> {l}</li>
            ))}
          </ul>
        </div>

        <div className="domainModalSection">
          <h3>TOOLS YOU&apos;LL MEET</h3>
          <div className="tagRow">
            {domain.tools.map((t) => (
              <span key={t} className="tag" style={{ borderColor: domain.border, color: domain.color }}>{t}</span>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 26 }}>
          <Link href="/apply" className="btn grad sm" style={{ flex: "1 1 180px", justifyContent: "center" }}>
            Apply for this <span>→</span>
          </Link>
          <Link href="/fit" className="btn ghost sm" style={{ flex: "1 1 150px", justifyContent: "center" }}>
            Still unsure? Find your fit
          </Link>
        </div>
      </div>
    </div>
  );
}

function Card({ domain, onOpen }) {
  return (
    <article
      className="domain domainClickable"
      style={{ borderColor: domain.border, background: `linear-gradient(150deg,${domain.wash},rgba(11,6,14,.85) 60%)` }}
    >
      <div className="domainArtWrap" style={{ background: `linear-gradient(150deg,${domain.wash},transparent 70%)` }}>
        <DomainArt motif={domain.key} accent={domain.color} />
        <span className="n" style={{ color: domain.color }}>{domain.num}</span>
      </div>
      <div className="domainBody">
        <h4 style={{ color: domain.color }}>{domain.label.toUpperCase()}</h4>
        <p>{domain.teaser}</p>
        {/* the whole card is the button — the ::after below stretches over it */}
        <button type="button" className="domainMore" onClick={() => onOpen(domain)} style={{ color: domain.color }}>
          What we do here <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  );
}

export default function DomainGrid() {
  const [open, setOpen] = useState(null);

  return (
    <>
      <div className="domainGroup">TECHNICAL — build the thing</div>
      <div className="cards3">
        {TECH_DOMAIN_CARDS.map((d) => <Card key={d.key} domain={d} onOpen={setOpen} />)}
      </div>

      <div className="domainGroup">CORPORATE — make it land</div>
      <div className="cards3">
        {CORP_DOMAIN_CARDS.map((d) => <Card key={d.key} domain={d} onOpen={setOpen} />)}
      </div>

      {open && <DomainModal domain={open} onClose={() => setOpen(null)} />}
    </>
  );
}
