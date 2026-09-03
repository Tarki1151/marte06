/**
 * When a member's chance to cancel without losing the lesson runs out.
 *
 * Policy (user, 3 Sep 2026): a member who has not cancelled by the deadline
 * counts as having attended and the lesson is spent. The naive form of that —
 * "cancel at least N hours before" — breaks at the start of the day: with a
 * two-hour rule a 07:00 session would have to be cancelled at 05:00, which
 * is not a policy, it is a trap.
 *
 * So there is one extra rule, not a second knob: **the deadline may never
 * fall before the gym opened on the day of the session.** If it would, it
 * moves back to the previous day's closing time. A 07:00 session at a gym
 * that opens at 07:00 therefore has to be cancelled the evening before,
 * which is what the gym means by "sabah dersleri bir gün önceden" — and it
 * keeps working if the gym later changes its notice period or its hours,
 * which a hardcoded "first two hours" rule would not.
 *
 * `openingHours` is optional because most gyms have never set it. Without it
 * the day is assumed to start at `DEFAULT_DAY_START_HOUR`; the shape of the
 * rule is the same.
 */

export const DEFAULT_CANCELLATION_HOURS = 24;
/** Assumed opening time when the gym has not set its hours. */
export const DEFAULT_DAY_START_HOUR = 8;
/** Assumed closing time, used as the previous evening's deadline. */
export const DEFAULT_DAY_END_HOUR = 22;

export interface DayWindow {
  /** `"HH:MM"` */
  open: string;
  /** `"HH:MM"` */
  close: string;
}

/** Keyed by `Date.getDay()` as a string, matching `tenants.openingHours`. */
export type OpeningHours = Record<string, DayWindow | null | undefined>;

function parseHour(value: string | undefined, fallback: number): { h: number; m: number } {
  if (!value) return { h: fallback, m: 0 };
  const [h, m] = value.split(':').map((n) => Number.parseInt(n, 10));
  if (!Number.isFinite(h)) return { h: fallback, m: 0 };
  return { h, m: Number.isFinite(m) ? m : 0 };
}

function atTime(day: Date, time: { h: number; m: number }): Date {
  const d = new Date(day);
  d.setHours(time.h, time.m, 0, 0);
  return d;
}

export function computeCancellationDeadline(params: {
  sessionStart: Date;
  /** `tenants.cancellationHours`. */
  cancellationHours?: number;
  /** `tenants.openingHours`. */
  openingHours?: OpeningHours;
}): Date {
  const hours = params.cancellationHours ?? DEFAULT_CANCELLATION_HOURS;
  const naive = new Date(params.sessionStart.getTime() - hours * 3600000);

  const sameDayWindow = params.openingHours?.[String(params.sessionStart.getDay())];
  const opensAt = atTime(params.sessionStart, parseHour(sameDayWindow?.open, DEFAULT_DAY_START_HOUR));

  // Deadline already lands before the session's day even began, or on an
  // earlier day — nothing to push back; it is reachable at a sane hour.
  if (naive < opensAt) {
    const previousDay = new Date(params.sessionStart.getTime() - 86400000);
    const prevWindow = params.openingHours?.[String(previousDay.getDay())];
    // A day the gym is shut has no closing time to aim at; fall back to the
    // usual evening so the deadline stays a real moment rather than sliding
    // to whenever the gym next happens to open.
    const closesAt = atTime(previousDay, parseHour(prevWindow?.close, DEFAULT_DAY_END_HOUR));
    // Only pull it back — a gym open until midnight must not push the
    // deadline LATER than the plain notice period would have allowed.
    return closesAt < naive ? closesAt : naive;
  }
  return naive;
}

/** Whether cancelling at `now` is still in time. */
export function isBeforeDeadline(deadline: Date, now: Date): boolean {
  return now.getTime() <= deadline.getTime();
}
