"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { APPLICATION_STATUSES } from "@/lib/schemas";

/**
 * Filter bar for the applications list.
 *
 * Everything lives in the URL so a filtered view can be bookmarked and shared,
 * and the server component stays the single place that reads from Mongo.
 */
export default function ApplicationFilters({ domains }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  function apply(patch) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page"); // a new filter always starts from page one
    startTransition(() => router.push(`/admin/applications?${next.toString()}`));
  }

  const status = params.get("status") ?? "";
  const domain = params.get("domain") ?? "";
  const hasFilters = Boolean(status || domain || params.get("q"));

  return (
    <form
      className="filterBar"
      onSubmit={(e) => {
        e.preventDefault();
        apply({ q });
      }}
    >
      <input
        className="input grow"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, email, applicant ID or registration number…"
        aria-label="Search applications"
      />

      <select className="input" value={status} onChange={(e) => apply({ status: e.target.value })} aria-label="Filter by status">
        <option value="">All statuses</option>
        {APPLICATION_STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>

      <select className="input" value={domain} onChange={(e) => apply({ domain: e.target.value })} aria-label="Filter by domain">
        <option value="">All domains</option>
        {domains.map((d) => (
          <option key={d.key} value={d.key}>{d.label}</option>
        ))}
      </select>

      <button type="submit" className="btn ghost sm" disabled={pending}>
        {pending ? "Filtering…" : "Search"}
      </button>

      {hasFilters && (
        <button
          type="button"
          className="btnQuiet"
          onClick={() => {
            setQ("");
            startTransition(() => router.push("/admin/applications"));
          }}
        >
          Clear
        </button>
      )}
    </form>
  );
}
