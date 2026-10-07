import { SENIOR_YEAR } from './classes'
import type { PlaythroughRecord } from './types'

/**
 * The semester a playthrough is set in: which half of the year it is, how far into the reader's
 * four years it falls, and every word that differs between a spring and a fall.
 */

/** Which half of the year a semester is. */
export type Season = 'spring' | 'fall'

/** The last semester there is: the spring the reader himself graduates in. */
export const LAST_TERM_INDEX = 6

/** The half of the year term `index` falls in: the first is a spring, and they alternate. */
export function seasonOf(index: number): Season {
  return index % 2 === 0 ? 'spring' : 'fall'
}

/** Which term a playthrough record is, a record written before terms being the first spring. */
export function termIndexOf(record: Pick<PlaythroughRecord, 'term'>): number {
  return record.term?.index ?? 0
}

/** Whether another semester follows term `index`. */
export function hasNextTerm(index: number): boolean {
  return index < LAST_TERM_INDEX
}

/** The reader's class year in term `index`, 1 to 4: he moves up every fall. */
export function readerYearOf(index: number): number {
  return Math.min(SENIOR_YEAR, 1 + Math.ceil(index / 2))
}

/**
 * A class year carried into the term after a `from` semester: everybody moves up over the
 * summer, and nobody does over the winter.
 */
export function yearAfter(year: number, from: Season): number {
  return from === 'spring' ? Math.min(SENIOR_YEAR, year + 1) : year
}

/** Whether somebody in class `year` leaves the university at the end of a `season` semester. */
export function graduatesAfter(year: number, season: Season): boolean {
  return season === 'spring' && year >= SENIOR_YEAR
}

/**
 * How many days lie between day 0 of a `season` semester and day 0 of the one after it; what a
 * date carried across the break is moved back by.
 */
export function daysToNextTerm(season: Season): number {
  return season === 'spring' ? 210 : 155
}

/** The words one half of the year is spoken of in. */
export interface SeasonWords {
  /** `"Spring"` — the semester's own name, capitalized. */
  name: string
  /** `"January to May"` — the months it runs across. */
  months: string
  /** `"spring break"` — the week off after midterms, as a sentence says it. */
  midBreak: string
  /** `"March"` — the month that week falls in. */
  midBreakMonth: string
  /** `"summer vacation"` — the break the semester ends into. */
  endBreak: string
  /** `"the summer"` — the same break as a stretch of time: "home for the summer". */
  endBreakSpan: string
  /** `"the fall"` — when everybody is back. */
  backIn: string
  /** `"winter break"` — the break the semester opened out of. */
  priorBreak: string
}

const SEASON_WORDS: Record<Season, SeasonWords> = {
  spring: {
    name: 'Spring',
    months: 'January to May',
    midBreak: 'spring break',
    midBreakMonth: 'March',
    endBreak: 'summer vacation',
    endBreakSpan: 'the summer',
    backIn: 'the fall',
    priorBreak: 'winter break'
  },
  fall: {
    name: 'Fall',
    months: 'August to December',
    midBreak: 'fall break',
    midBreakMonth: 'October',
    endBreak: 'winter break',
    endBreakSpan: 'the winter break',
    backIn: 'the spring',
    priorBreak: 'summer break'
  }
}

/**
 * The term the game on screen is set in. Every date the app formats and every fixed occasion it
 * names is read against it, so it is set wherever a semester is entered or enrolled for.
 */
let activeIndex = 0

/** Names the term everything is read against from here on. */
export function setActiveTerm(index: number): void {
  activeIndex = index
}

/** The term everything is being read against. */
export function activeTermIndex(): number {
  return activeIndex
}

/** The half of the year everything is being read against. */
export function activeSeason(): Season {
  return seasonOf(activeIndex)
}

/** Whether somebody in class `year` graduates at the end of the semester being played. */
export function graduatesNow(year: number | undefined): boolean {
  return graduatesAfter(year ?? 0, activeSeason())
}

/** Whether the semester being played is the reader's own last one. */
export function readerGraduatesNow(): boolean {
  return !hasNextTerm(activeIndex)
}

/** A season's words, the active one's unless another is named. */
export function seasonWords(season: Season = activeSeason()): SeasonWords {
  return SEASON_WORDS[season]
}

/** `"Fall semester"` — what a term is called on a button or a card. */
export function termLabel(index: number): string {
  return `${SEASON_WORDS[seasonOf(index)].name} semester`
}
