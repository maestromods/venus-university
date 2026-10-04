import type { ValidateRecordOptions } from './jsonValidate'
import { rustedStats, type PlayerStats } from './playerStats'
import type { Disposition } from './relationship'
import type { Season } from './term'
import type { BreakMemory } from './termCarry'
import type { TermCarry } from './termTypes'
import type { ChatMessage, GameSave, MemoryType, TimeSlot } from './types'

/**
 * The break between two semesters as something played: a run of slots, two to a week, spent one
 * at a time between a finished semester's last save and the roster of the next. What it is on
 * disk, how its clock reads, what a slot spent texting somebody leaves behind, and what
 * everybody remembers of it once it is over. Pure.
 */

/** The break record's own version, apart from the save's, the record's and the enrollment's. */
export const BREAK_SCHEMA_VERSION = 2

/** How many slots one week of a break holds. */
export const BREAK_SLOTS_PER_WEEK = 2

/** How many weeks the break after a semester of each season runs. */
const BREAK_WEEKS: Record<Season, number> = { spring: 12, fall: 4 }

/** How many texts of his own one conversation runs to. */
export const TALK_TURNS = 6

/** The most one conversation can leave her remembering. */
const TALK_MEMORIES = 2

/** The most one girl comes back remembering of a break. */
const GIRL_MEMORIES = 5

/** One slot of a break as it was spent: let go by, or on a conversation with somebody. */
export type BreakEntry = { kind: 'rest' } | { kind: 'text'; charId: string }

/** One text of a break conversation. */
export interface BreakLine {
  sender: 'player' | 'contact'
  text: string
}

/** How one conversation left her feeling about him. */
export type BreakVerdict = 'warmer' | 'cooler' | 'neutral'

/** How a conversation came to its end: his last text, his own goodbye, or her cutting it short. */
export type TalkEnding = 'cap' | 'player' | 'her'

/**
 * What a returning girl is carrying through the break, written once when it opens and never
 * shown to the player: every conversation with her is written and judged against it.
 */
export interface BreakCard {
  /** Where she is spending the break and what with. */
  where: string
  /** What she wants out of it. */
  wants: string
  /** The one thing from him that would hurt. */
  hurts: string
  /** The one thing from him that would delight her. */
  delights: string
  /** What she expects of him over the break, going by where the two of them stand. */
  expects: string
}

/** One conversation: the slot it took, what was said, and once it is judged what it came to. */
export interface BreakTalk {
  /** The index of the slot it was spent on. */
  slot: number
  charId: string
  lines: BreakLine[]
  /** Present once the conversation is over. */
  ended?: TalkEnding
  /** Present once it has been judged, which is what closes it. */
  verdict?: BreakVerdict
  /** One line saying why, in the player's reading voice. */
  reason?: string
  /** What was said, in a sentence or two, for the conversations with her that follow. */
  summary?: string
  /** What it left her remembering. */
  memories?: BreakMemory[]
}

/** Something he told her he would do, each completing "the reader promised to ___". */
export interface BreakPromise {
  text: string
  state: 'open' | 'kept' | 'broken'
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
  /** Every conversation, in order; the last one is still open while it has no verdict. */
  talks: BreakTalk[]
  /** What he has promised each girl, by charId, in the order he promised it. */
  promises: Record<string, BreakPromise[]>
  /** Each returning girl's card, by charId; absent until the first conversation asks for them. */
  cards?: Record<string, BreakCard>
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
  return { stats: rustedStats(save.stats), spent: [], talks: [], promises: {} }
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

/** The conversation still under way, which nothing else may be done over; `null` with none. */
export function openTalk(draft: Pick<BreakDraft, 'talks'>): BreakTalk | null {
  const last = draft.talks[draft.talks.length - 1]
  return last && last.verdict === undefined ? last : null
}

/** Whether a slot can be spent: the break is not over, has one left, and no conversation is open. */
function slotFree(draft: BreakDraft, ended: Season): boolean {
  return !breakOver(draft) && !breakSpent(draft, ended) && openTalk(draft) === null
}

/** The break with one more slot let go by; where none can be spent it is left as it is. */
export function withSlotSpent(draft: BreakDraft, ended: Season): BreakDraft {
  if (!slotFree(draft, ended)) return draft
  return { ...draft, spent: [...draft.spent, { kind: 'rest' }] }
}

/**
 * The break with a slot spent on a conversation with `charId`, opened on his first text; where
 * no slot can be spent, or the text is blank, it is left as it is.
 */
export function withTalkStarted(
  draft: BreakDraft,
  charId: string,
  text: string,
  ended: Season
): BreakDraft {
  const said = text.trim()
  if (!slotFree(draft, ended) || said === '') return draft
  return {
    ...draft,
    spent: [...draft.spent, { kind: 'text', charId }],
    talks: [
      ...draft.talks,
      { slot: draft.spent.length, charId, lines: [{ sender: 'player', text: said }] }
    ]
  }
}

/** How many texts of his own a conversation holds. */
export function talkTurns(talk: Pick<BreakTalk, 'lines'>): number {
  return talk.lines.filter((line) => line.sender === 'player').length
}

/** Whether the last word of a conversation is his, so hers is still owed. */
export function replyOwed(talk: BreakTalk): boolean {
  return talk.ended === undefined && talk.lines[talk.lines.length - 1]?.sender === 'player'
}

/** The break with the open conversation replaced by `change` of it; with none open, as it is. */
function withOpenTalk(draft: BreakDraft, change: (talk: BreakTalk) => BreakTalk): BreakDraft {
  const talk = openTalk(draft)
  if (!talk) return draft
  const changed = change(talk)
  // A change that was refused hands back the same break, which is how a caller tells.
  return changed === talk ? draft : { ...draft, talks: [...draft.talks.slice(0, -1), changed] }
}

/**
 * The open conversation with one more text of his. Refused — the break is left as it is — when
 * the conversation is over, when her reply is still owed, or when he has had every turn.
 */
export function withPlayerLine(draft: BreakDraft, text: string): BreakDraft {
  const said = text.trim()
  return withOpenTalk(draft, (talk) => {
    if (said === '' || talk.ended || replyOwed(talk) || talkTurns(talk) >= TALK_TURNS) return talk
    return { ...talk, lines: [...talk.lines, { sender: 'player', text: said }] }
  })
}

/**
 * The open conversation with her reply to his last text. It ends there when she cut it short,
 * or when that text was his last turn.
 */
export function withReply(
  draft: BreakDraft,
  texts: readonly string[],
  leaving: boolean
): BreakDraft {
  return withOpenTalk(draft, (talk) => {
    if (!replyOwed(talk)) return talk
    const said = texts.map((text) => text.trim()).filter((text) => text !== '')
    const lines = [...talk.lines, ...said.map((text) => ({ sender: 'contact' as const, text }))]
    const capped = talkTurns(talk) >= TALK_TURNS
    const ended: TalkEnding | undefined = capped ? 'cap' : leaving ? 'her' : undefined
    return { ...talk, lines, ...(ended ? { ended } : {}) }
  })
}

/** The open conversation ended by him, which he may do once she has answered something. */
export function withTalkLeft(draft: BreakDraft): BreakDraft {
  return withOpenTalk(draft, (talk) =>
    talk.ended || replyOwed(talk) ? talk : { ...talk, ended: 'player' }
  )
}

/** What the judge made of one conversation, as its reply is read. */
export interface TalkJudgement {
  verdict: BreakVerdict
  reason: string
  summary: string
  memories: readonly BreakMemory[]
  /** New promises of his, each completing "the reader promised to ___". */
  promisesMade: readonly string[]
  /** Indices into her promises still open that this conversation kept. */
  promisesKept: readonly number[]
  /** Indices into her promises still open that this conversation went back on. */
  promisesBroken: readonly number[]
}

/** Which way a memory leans. */
function leans(type: MemoryType): BreakVerdict {
  return type === 'liked' || type === 'loved' ? 'warmer' : 'cooler'
}

/** The mild type on the side a strong one is on. */
function mild(type: MemoryType): MemoryType {
  return leans(type) === 'warmer' ? 'liked' : 'disliked'
}

/**
 * Whether a conversation with `charId` judged now may leave her a strong memory, loved or
 * hated, on the `verdict` side: only when the conversation with her before it went the same
 * way, so it takes a pattern and never one reading to move her that far.
 */
export function strongAllowed(
  draft: Pick<BreakDraft, 'talks'>,
  charId: string,
  verdict: BreakVerdict
): boolean {
  if (verdict === 'neutral') return false
  const earlier = draft.talks.filter((talk) => talk.charId === charId && talk.verdict !== undefined)
  return earlier[earlier.length - 1]?.verdict === verdict
}

/**
 * The break with its open conversation judged and so closed: the verdict and what it left her
 * remembering — at most {@link TALK_MEMORIES}, none against the verdict's own side, a strong one
 * turned mild where {@link strongAllowed} says no — and her promises brought up to date. A
 * conversation that has not ended is left open.
 */
export function withTalkJudged(draft: BreakDraft, judged: TalkJudgement): BreakDraft {
  const talk = openTalk(draft)
  if (!talk || talk.ended === undefined) return draft

  const strong = strongAllowed(draft, talk.charId, judged.verdict)
  const memories: BreakMemory[] = judged.memories
    .map((memory) => ({ type: memory.type, desc: memory.desc.trim() }))
    .filter((memory) => memory.desc !== '')
    .filter((memory) => judged.verdict === 'neutral' || leans(memory.type) === judged.verdict)
    .map((memory) => (strong ? memory : { ...memory, type: mild(memory.type) }))
    .slice(0, TALK_MEMORIES)

  const before = draft.promises[talk.charId] ?? []
  const open = before.flatMap((promise, index) => (promise.state === 'open' ? [index] : []))
  const kept = new Set(judged.promisesKept.map((at) => open[at]))
  const broken = new Set(judged.promisesBroken.map((at) => open[at]))
  const promises: BreakPromise[] = [
    ...before.map((promise, index): BreakPromise =>
      broken.has(index)
        ? { ...promise, state: 'broken' }
        : kept.has(index)
          ? { ...promise, state: 'kept' }
          : promise
    ),
    // A promise she is already owed is not owed twice for being said again.
    ...[...new Set(judged.promisesMade.map((text) => text.trim()))]
      .filter(
        (text) =>
          text !== '' &&
          !before.some(
            (promise) =>
              promise.state === 'open' && promise.text.toLowerCase() === text.toLowerCase()
          )
      )
      .map((text): BreakPromise => ({ text, state: 'open' }))
  ]

  const closed: BreakTalk = {
    ...talk,
    verdict: judged.verdict,
    reason: judged.reason.trim(),
    summary: judged.summary.trim(),
    memories
  }
  return {
    ...draft,
    talks: [...draft.talks.slice(0, -1), closed],
    promises: { ...draft.promises, [talk.charId]: promises }
  }
}

/** How somebody stood with the reader when the semester ended, as far as the break reads it. */
export interface BreakStanding {
  disposition: Disposition
  lover: boolean
}

/** Whether hearing nothing from him all break is something she minds. */
function mindsSilence(standing: BreakStanding, ended: Season): boolean {
  if (standing.lover) return true
  if (ended === 'fall') return false
  return (
    standing.disposition === 'friendly' ||
    standing.disposition === 'trusted' ||
    standing.disposition === 'devoted'
  )
}

/** The break as a sentence says it, off the season of the semester it follows. */
function breakSpan(ended: Season): string {
  return ended === 'spring' ? 'all summer' : 'over the winter break'
}

/**
 * What each girl in `standings` remembers of a break that was played, off what happened in it
 * and nothing else: what her conversations left her with, a promise he never kept, and — for
 * somebody who would mind — never having heard from him at all. The newest
 * {@link GIRL_MEMORIES} are kept. A conversation left open counts for nothing.
 */
export function playedMemories(
  draft: Pick<BreakDraft, 'talks' | 'promises'>,
  standings: Readonly<Record<string, BreakStanding>>,
  ended: Season
): Record<string, BreakMemory[]> {
  return Object.fromEntries(
    Object.entries(standings).map(([charId, standing]) => {
      const talks = draft.talks.filter((talk) => talk.charId === charId)
      const memories: BreakMemory[] = talks.flatMap((talk) => talk.memories ?? [])
      // A promise still open when the break ends is one he never kept. One is remembered,
      // the first: the conversation a promise was gone back on in has already said the rest.
      const unkept = (draft.promises[charId] ?? []).find((promise) => promise.state !== 'kept')
      if (unkept) {
        memories.push({
          type: 'disliked',
          desc: `the reader promised to ${unkept.text} and never did`
        })
      }
      if (talks.length === 0 && mindsSilence(standing, ended)) {
        memories.push({
          type: 'disliked',
          desc: `the reader did not write to her once ${breakSpan(ended)}`
        })
      }
      return [charId, memories.slice(-GIRL_MEMORIES)]
    })
  )
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

/**
 * The day a break slot falls on, counted back from day 0 of the semester after it: always
 * before that day, and after the last day of the semester the break follows.
 */
export function breakSlotDate(slot: number, ended: Season): { date: number; time: TimeSlot } {
  const week = Math.floor(slot / BREAK_SLOTS_PER_WEEK)
  const second = slot % BREAK_SLOTS_PER_WEEK === 1
  return { date: -((breakWeeks(ended) - week) * 7) + (second ? 4 : 1), time: second ? 1 : 0 }
}

/**
 * `carry` with the break's conversations filed on the phone: each one's texts appended to her
 * thread on the day its slot fell on, read already. Somebody who is not coming back, and a
 * conversation with nothing said in it, are left out.
 */
export function withBreakThreads(
  carry: TermCarry,
  talks: readonly BreakTalk[],
  ended: Season
): TermCarry {
  const conversations = { ...carry.bunnyboard.conversations }
  for (const talk of talks) {
    if (!carry.charInfo[talk.charId] || talk.lines.length === 0) continue
    const { date, time } = breakSlotDate(talk.slot, ended)
    const messages: ChatMessage[] = talk.lines.map((line, index) => ({
      id: `break-${talk.slot}-${index}`,
      sender: line.sender,
      text: line.text,
      date,
      time
    }))
    const thread = conversations[talk.charId] ?? {
      charId: talk.charId,
      messages: [],
      unread: 0,
      summary: null
    }
    conversations[talk.charId] = { ...thread, messages: [...thread.messages, ...messages] }
  }
  return { ...carry, bunnyboard: { ...carry.bunnyboard, conversations } }
}

/** One break with its version and the moment it was written stamped on it. */
export function stampBreak(draft: BreakDraft, savedAt: number): TermBreak {
  return { ...draft, schemaVersion: BREAK_SCHEMA_VERSION, savedAt }
}

const BREAK_REQUIRED: Record<keyof Omit<TermBreak, 'memories' | 'cards'>, true> = {
  schemaVersion: true,
  savedAt: true,
  stats: true,
  spent: true,
  talks: true,
  promises: true
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
