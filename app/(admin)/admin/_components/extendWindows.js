/**
 * How close to the wire a candidate has to be for a bulk extension to touch
 * them.
 *
 * Extending everyone who has not submitted is usually the wrong move — someone
 * with four days left does not need more time, and moving their deadline just
 * tells them the date is negotiable. What actually needs rescuing is the group
 * about to run out, so the default is "under 24 hours left".
 *
 * `hours` is measured forward from now, which means each window already
 * contains the overdue: someone three days past their deadline has well under
 * 24 hours left, so `24` catches them too. `hours: 0` is the overdue on their
 * own, and `hours: null` drops the filter entirely.
 *
 * Shared by the submissions page (which counts each bucket in one aggregation)
 * and the modal (which reads those counts), so the two cannot drift apart.
 */
export const EXTEND_WINDOWS = [
  { key: 'overdue', hours: 0,    label: 'Already overdue' },
  { key: '24h',     hours: 24,   label: 'Under 24 hours left — includes overdue' },
  { key: '48h',     hours: 48,   label: 'Under 48 hours left' },
  { key: 'all',     hours: null, label: 'Everyone who has not submitted' },
]

/** What the button counts and what the modal opens on. */
export const DEFAULT_WINDOW = '24h'

/** The windows that are an actual cutoff, i.e. everything but "all". */
export const TIMED_WINDOWS = EXTEND_WINDOWS.filter((w) => w.hours !== null)

export function windowByKey(key) {
  return EXTEND_WINDOWS.find((w) => w.key === key) ?? null
}
