import type { ValidateRecordOptions } from './jsonValidate'
import { rustedStats, type PlayerStats } from './playerStats'
import type { Season } from './term'
import type { BreakMemory } from './termCarry'
import type { GameSave } from './types'

/**
 * The break between two semesters as something played: a run of slots, two to a week, spent one
 * at a time between a finished semester's last save and the roster of the next. What it is on
 * disk, how its clock reads, and how it is checked once read. Pure.
 */

/** The break record's own version, apart from the save's, the record's and the enrollment's. */
export const BREAK_SCHEMA_VERSION = 1

/** How many slots one week of a break holds. */
export const BREAK_SLOTS_PER_WEEK = 2

/** How many weeks the break after a semester of each season runs. */
const BREAK_WEEKS: Record<Season, number> = { spring: 12, fall: 4 }

/** One slot of a break as it was spent. */
export interface BreakEntry {
  /** `rest` lets the slot go by with nothing done in it. */
  kind: 'rest'
}

/**
 * On-disk break — `/data/saves/{playthroughId}/break.json`, in the folder of the semester it
 * follows and belonging to that semester, whichever of its finished saves is continued: removed
 * once the next semester has been generated from it.
 */
export interface TermBreak {
  schemaVersion: number
  savedAt: number
  /** The reader's stats as the break has left them so far: a tier down each when it opened. */
  stats: PlayerStats
  /** Every slot spent so far, in order. */
  spent: BreakEntry[]
  /**
   * What each returning girl remembers of the break, by charId. Present once the break is over,
   * played out or skipped, and the player's to reword until the next semester is generated.
   */
  memories?: Record<string, BreakMemory[]>
}

/** A break as the screen holds it, before the store stamps it. */
export type BreakDraft = Omit<TermBreak, 'schemaVersion' | 'savedAt'>

/** How many weeks the break after a `ended` semester runs. */
export function breakWeeks(ended: Season): number {
  return BREAK_WEEKS[ended]
}

/** How many slots the break after a `ended` semester holds. */
export function breakSlots(ended: Season): number {
  return BREAK_WEEKS[ended] * BREAK_SLOTS_PER_WEEK
}

/** The break a finished semester opens into: nothing spent, and the reader a tier rustier. */
export function openBreak(save: Pick<GameSave, 'stats'>): BreakDraft {
  return { stats: rustedStats(save.stats), spent: [] }
}

/** Where a break stands: the week and the slot of it the next action is spent on, both from 1. */
export interface BreakClock {
  week: number
  slot: number
}

/** The clock after `spent` slots; past the last slot it stays on the last one. */
export function breakClock(spent: number, ended: Season): BreakClock {
  const at = Math.min(Math.max(spent, 0), breakSlots(ended) - 1)
  return {
    week: Math.floor(at / BREAK_SLOTS_PER_WEEK) + 1,
    slot: (at % BREAK_SLOTS_PER_WEEK) + 1
  }
}

/** Whether every slot of the break has been spent. */
export function breakSpent(draft: Pick<BreakDraft, 'spent'>, ended: Season): boolean {
  return draft.spent.length >= breakSlots(ended)
}

/** Whether the break is over: its memories are written, whether it was played out or skipped. */
export function breakOver(draft: Pick<BreakDraft, 'memories'>): boolean {
  return draft.memories !== undefined
}

/** The break with one more slot spent; a break with none left, or already over, is left as it is. */
export function withSlotSpent(draft: BreakDraft, entry: BreakEntry, ended: Season): BreakDraft {
  if (breakOver(draft) || breakSpent(draft, ended)) return draft
  return { ...draft, spent: [...draft.spent, entry] }
}

/**
 * The break closed on what each girl remembers of it. A memory with nothing written is dropped,
 * and a girl left with none is kept with an empty list, so a line the player blanked stays blank.
 */
export function withBreakClosed(
  draft: BreakDraft,
  memories: Readonly<Record<string, readonly BreakMemory[]>>
): BreakDraft {
  return {
    ...draft,
    memories: Object.fromEntries(
      Object.entries(memories).map(([charId, list]) => [
        charId,
        list
          .map((memory) => ({ type: memory.type, desc: memory.desc.trim() }))
          .filter((memory) => memory.desc !== '')
      ])
    )
  }
}

/** One break with its version and the moment it was written stamped on it. */
export function stampBreak(draft: BreakDraft, savedAt: number): TermBreak {
  return { ...draft, schemaVersion: BREAK_SCHEMA_VERSION, savedAt }
}

const BREAK_REQUIRED: Record<keyof Omit<TermBreak, 'memories'>, true> = {
  schemaVersion: true,
  savedAt: true,
  stats: true,
  spent: true
}

/** How a break is checked once it has been read. */
export const BREAK_READ: ValidateRecordOptions<TermBreak> = {
  label: 'That break',
  malformed: { code: 'BREAK_MALFORMED', message: 'That break is not valid JSON.' },
  schemaVersion: { code: 'BREAK_SCHEMA_VERSION' },
  expects: BREAK_SCHEMA_VERSION,
  required: BREAK_REQUIRED
}

/** Raised when a break is there but cannot be read. */
export const BREAK_UNREADABLE = { code: 'BREAK_UNREADABLE', message: 'Could not read the break.' }
