import type { CharJob, TimeSlot } from '@shared/types'
import { shiftSlotOf } from '@shared/jobs'
import { activeSeason, type Season } from '@shared/term'

/**
 * In-game calendar helpers; a fixed non-leap anchor per season keeps dates deterministic. 2015
 * is chosen so both day 0s — January 19 and August 17 — are Mondays, which the class schedule
 * depends on.
 */
const ANCHOR_YEAR = 2015

/** Day 0 of each season's semester, as a month index and a day of that month. */
const ANCHORS: Record<Season, { month: number; day: number }> = {
  spring: { month: 0, day: 19 },
  fall: { month: 7, day: 17 }
}

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
]

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

/**
 * The calendar date a game day falls on, in UTC so the machine's timezone cannot shift it a
 * day; every reader below goes through here. A screen outside any game names the season of the
 * playthrough it is dating; everything else reads the active term's.
 */
function dateFromDay(date: number, season: Season = activeSeason()): Date {
  const anchor = ANCHORS[season]
  return new Date(Date.UTC(ANCHOR_YEAR, anchor.month, anchor.day + date))
}

/**
 * "January 19" for date 0 of a spring. Month and day only — the year is an implementation
 * detail.
 */
export function formatGameDate(date: number, season?: Season): string {
  const at = dateFromDay(date, season)
  return `${MONTHS[at.getUTCMonth()]} ${at.getUTCDate()}`
}

/** Compact date for memory entries in prompt cast blocks. */
export function formatShortGameDate(date: number, season?: Season): string {
  const at = dateFromDay(date, season)
  return `${MONTHS[at.getUTCMonth()].slice(0, 3)} ${at.getUTCDate()}`
}

/** `"1/28"` — the date as a figure, for the day-change splash's mono row. */
export function formatNumericGameDate(date: number, season?: Season): string {
  const at = dateFromDay(date, season)
  return `${at.getUTCMonth() + 1}/${at.getUTCDate()}`
}

/**
 * "1st", "2nd", "6th" — English ordinals, for the semester line and the continuation
 * prompt's turn count.
 */
export function ordinal(n: number): string {
  // 11th/12th/13th are the exception the last-digit rule gets wrong.
  const teen = n % 100
  if (teen >= 11 && teen <= 13) return `${n}th`
  const suffix = ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${suffix}`
}

/** Where `date` falls in the semester, for the `NOW` block. Day 0 is the first day. */
export function formatSemesterProgress(date: number): string {
  const week = Math.floor(date / 7) + 1
  return week === 1
    ? `It's day ${date + 1} of the semester.`
    : `It's the ${ordinal(week)} week of the semester.`
}

/** Word ordinals for the slot-opening line; past this it falls back to `21st`. */
const ORDINAL_WORDS = [
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth',
  'Eleventh',
  'Twelfth',
  'Thirteenth',
  'Fourteenth',
  'Fifteenth',
  'Sixteenth',
  'Seventeenth',
  'Eighteenth',
  'Nineteenth',
  'Twentieth'
]

/** The semester phrase for the slot-opening line, e.g. `"Third week of the semester."`. */
function formatSemesterPhrase(date: number): string {
  const week = Math.floor(date / 7) + 1
  if (week === 1) return `Day ${date + 1} of the semester.`
  return `${ORDINAL_WORDS[week - 1] ?? ordinal(week)} week of the semester.`
}

/** 0 = Sunday through 6 = Saturday. Day 0 is a Monday, so this returns 1. */
export function weekdayOf(date: number): number {
  return dateFromDay(date).getUTCDay()
}

/** `"Monday"`. */
export function formatWeekday(date: number): string {
  return WEEKDAYS[weekdayOf(date)]
}

/** The class-schedule weekday index (0 = Monday … 4 = Friday), or null on a weekend. */
export function classWeekdayOf(date: number): number | null {
  const day = weekdayOf(date)
  return day >= 1 && day <= 5 ? day - 1 : null
}

/** The shift-week weekday index (0 = Monday … 6 = Sunday), never null: a job rosters weekends. */
export function shiftWeekdayOf(date: number): number {
  return (weekdayOf(date) + 6) % 7
}

/** The Saturday of the weekend `date` falls in, or null on a weekday. */
export function weekendSaturdayOf(date: number): number | null {
  const day = weekdayOf(date)
  if (day === 6) return date
  if (day === 0) return date - 1
  return null
}

/**
 * The employer a character is working for in one slot, or null when she is not on shift then
 * — the roster's sibling of the player's own `shiftNow()`.
 */
export function charJobAt(
  job: CharJob | undefined,
  date: number,
  time: TimeSlot
): string | null {
  if (!job || job.shifts.length === 0) return null
  if (job.startsOn !== undefined && date < job.startsOn) return null
  const slot = shiftSlotOf(shiftWeekdayOf(date), time)
  return job.shifts.includes(slot) ? job.jobId : null
}

/** "Day" or "Night" (slot 0 = day, 1 = night). */
export function formatTimeSlot(time: TimeSlot): string {
  return time === 0 ? 'Day' : 'Night'
}

/** The date half of the banner, e.g. `"Monday, January 19"`. */
export function formatDatePart(date: number, season?: Season): string {
  return `${formatWeekday(date)}, ${formatGameDate(date, season)}`
}

/** The slot-opening banner, e.g. `"Monday, January 19. Day."`. */
export function formatDateBanner(date: number, time: TimeSlot, season?: Season): string {
  return `${formatDatePart(date, season)}. ${formatTimeSlot(time)}.`
}

/** The first line of every slot opening: date, weekday and half, semester phrase. */
export function formatSlotOpening(date: number, time: TimeSlot): string {
  return `${formatGameDate(date)}, ${formatWeekday(date)} ${slotHalf(time)}. ${formatSemesterPhrase(date)}`
}

/** The slot after this one — night wraps to the next date's day. */
export function nextSlot(date: number, time: TimeSlot): { date: number; time: TimeSlot } {
  return { date: time === 1 ? date + 1 : date, time: time === 0 ? 1 : 0 }
}

/** {@link nextSlot} run backwards — the slot that finished before this one began. */
export function prevSlot(date: number, time: TimeSlot): { date: number; time: TimeSlot } {
  return time === 0 ? { date: date - 1, time: 1 } : { date, time: 0 }
}

/** `'day'` or `'night'`: the half a slot is, as the bg suffix, the theme and the prompts say it. */
export function slotHalf(time: TimeSlot): 'day' | 'night' {
  return time === 0 ? 'day' : 'night'
}

/** The chat divider label, e.g. `"Jan 19, night"`, shared by the Bunnyboard thread and the texting stubs. */
export function formatChatDivider(date: number, time: TimeSlot): string {
  return `${formatShortGameDate(date)}, ${slotHalf(time)}`
}

/** How long ago a slot was, from another slot: `"earlier today"`, `"last night"`, `"3 days ago"`. */
export function formatRelativeSlot(
  date: number,
  time: TimeSlot,
  nowDate: number,
  nowTime: TimeSlot
): string {
  const days = nowDate - date
  if (days === 0) {
    if (time === nowTime) return time === 1 ? 'earlier tonight' : 'earlier today'
    // The other half of today: the night is ahead of a day slot, the day behind a night one.
    return time === 1 ? 'tonight' : 'this morning'
  }
  if (days === 1) return time === 1 ? 'last night' : 'yesterday'
  if (days > 1) return `${days} days ago`
  if (days === -1) return time === 1 ? 'tomorrow night' : 'tomorrow'
  return `in ${-days} days`
}
