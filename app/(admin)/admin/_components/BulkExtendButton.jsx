"use client";

import { useState } from "react";
import BulkExtendModal from "./BulkExtendModal";
import { DEFAULT_WINDOW, windowByKey } from "./extendWindows";

/**
 * The header action on the submissions page.
 *
 * The number on the button is the default window — candidates who have not
 * submitted and are inside the last 24 hours — not everyone still outstanding,
 * because that is the number an admin is deciding about. The button stays
 * enabled at zero so the wider windows are still reachable from inside.
 */
export default function BulkExtendButton({ pending }) {
  const [open, setOpen] = useState(false);

  const soon = pending.windows?.[DEFAULT_WINDOW] ?? 0;
  const hours = windowByKey(DEFAULT_WINDOW)?.hours ?? 24;

  return (
    <>
      <button type="button" className="btn grad sm" onClick={() => setOpen(true)}
        disabled={pending.total === 0}
        title={pending.total === 0
          ? "Everyone in view has submitted"
          : `${soon} of ${pending.total} unsubmitted candidates have under ${hours} hours left`}>
        Extend deadlines ({soon} due soon)
      </button>
      {open && <BulkExtendModal pending={pending} onClose={() => setOpen(false)} />}
    </>
  );
}
