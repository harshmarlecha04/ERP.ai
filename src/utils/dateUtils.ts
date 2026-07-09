/**
 * Centralized date/time helpers.
 *
 * The entire application renders dates and times in Eastern Time
 * (America/New_York) so users across the country see identical values.
 *
 * Two categories of inputs flow through the UI:
 *   1. Date-only strings shaped `YYYY-MM-DD` (e.g. `schedule_date`).
 *      `new Date("YYYY-MM-DD")` treats the string as UTC midnight which
 *      rolls back a day for viewers east of Greenwich or in ET/PT.
 *      We anchor these to noon UTC so the resulting Date always lands
 *      on the correct calendar day in ET (DST safe).
 *   2. Full ISO timestamps (`created_at`, `updated_at`, etc.) which are
 *      always displayed in ET via `formatInTimeZone`.
 */
import { formatInTimeZone } from "date-fns-tz";
import { formatDistanceToNow } from "date-fns";

export const TIMEZONE = "America/New_York";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a YYYY-MM-DD date string as local midnight.
 * Prevents the off-by-one day shift caused by `new Date("YYYY-MM-DD")`
 * being interpreted as UTC midnight (which rolls back in EST/EDT).
 * Kept for legacy callers; new code should prefer `toDateET` + `formatET`.
 */
export const parseDateString = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed, local time
};

/**
 * Normalize any value into a Date suitable for ET formatting.
 * - `YYYY-MM-DD` strings are anchored to 12:00 UTC so the ET calendar
 *   day matches the string (safe across every DST offset).
 * - Anything else is passed through `new Date(...)`.
 */
export const toDateET = (value: Date | string | number | null | undefined): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    if (DATE_ONLY_RE.test(value)) {
      const d = new Date(`${value}T12:00:00Z`);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/**
 * Format any date-like value in America/New_York.
 * Returns an empty string for null/invalid input so it can be dropped
 * directly into JSX without guards.
 */
export const formatET = (
  value: Date | string | number | null | undefined,
  pattern: string = "MMM d, yyyy",
): string => {
  const d = toDateET(value);
  if (!d) return "";
  return formatInTimeZone(d, TIMEZONE, pattern);
};

/**
 * Format a full date + time in ET. Convenience wrapper.
 */
export const formatDateTimeET = (
  value: Date | string | number | null | undefined,
  pattern: string = "MMM d, yyyy h:mm a",
): string => formatET(value, pattern);

/**
 * `formatDistanceToNow` variant that first coerces the input through
 * `toDateET` so `YYYY-MM-DD` strings do not shift a day.
 */
export const formatDistanceET = (
  value: Date | string | number | null | undefined,
  options?: Parameters<typeof formatDistanceToNow>[1],
): string => {
  const d = toDateET(value);
  if (!d) return "";
  return formatDistanceToNow(d, options);
};

/** Today's date in ET as `YYYY-MM-DD`. Use for filter comparisons. */
export const todayET = (): string => formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");

/** Current wall-clock time in ET, returned as a Date. */
export const nowET = (): Date => {
  // A Date object always represents an instant, but callers frequently
  // pull `.getHours()` etc. expecting ET. Shift by the ET offset so the
  // local getters read as ET wall-clock time.
  const now = new Date();
  const etString = formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
  return new Date(etString);
};
