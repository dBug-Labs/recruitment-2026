"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * The public site's navigation bar.
 *
 * Fully transparent — no background, no backdrop blur. The earlier version used
 * `backdrop-filter`, which blurred the fixed film/vignette layers behind it and
 * produced a permanent milky band that read as solid. Legibility over the hero
 * art comes from the text shadows instead.
 *
 * When `sections` are given, the active link follows whatever is on screen
 * rather than being pinned to the first item.
 */
export default function SiteNav({ sections = [] }) {
  const [active, setActive] = useState(sections[0]?.id ?? null);

  useEffect(() => {
    if (sections.length === 0) return;

    const nodes = sections
      .map((s) => document.getElementById(s.id))
      .filter(Boolean);
    if (nodes.length === 0) return;

    // Whichever tracked section covers the middle of the viewport wins.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] }
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav className="nav">
      <div className="wrap inner">
        <Link href="/" className="brand">
          <Image src="/logo.png" alt="" width={36} height={36} />
          <span className="brandMark grad grit">dBug Labs</span>
        </Link>

        {sections.length > 0 && (
          <div className="navLinks">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={active === s.id ? "active" : ""}
                aria-current={active === s.id ? "true" : undefined}
              >
                {s.label}
              </a>
            ))}
          </div>
        )}

        <div className="navActions">
          <Link href="/login" className="navLogin">Login</Link>
          <Link href="/apply" className="btn grad sm">Apply Now <span>→</span></Link>
        </div>
      </div>
    </nav>
  );
}
