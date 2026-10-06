import type { ValidateRecordOptions } from './jsonValidate'
import {
  applyStatDeltas,
  resolveStatDeltas,
  rustedStats,
  type LedgerStats,
  type PlayerStats
} from './playerStats'
import { foldRelationshipEvents, type Disposition } from './relationship'
import type { Season } from './term'
import type { BreakMemory } from './termCarry'
import type { TermCarry } from './termTypes'
import type {
  ChatMessage,
  GameSave,
  MemoryType,
  RelationshipEvent,
  TimeSlot
} from './types'

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

/** One slot of a break as it was spent: let go by, on a conversation with somebody, or on himself. */
export type BreakEntry =
  | { kind: 'rest' }
  | { kind: 'text'; charId: string }
  | { kind: 'alone' }
  | { kind: 'travel'; charId: string }
  | { kind: 'visit'; charId: string }

/** One slot he spent on himself: what he set out to do, how it went, and what it exercised. */
export interface BreakAlone {
  /** The index of the slot it was spent on. */
  slot: number
  /** What he said he would do, in his own words. */
  action: string
  /** How it went, a narrated line at a time. */
  lines: string[]
  /** Which of his stats it exercised, as the call that wrote it reported them. */
  exercised: LedgerStats
}

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

/** Why she wrote when she did: the middle of the summer, or the last week before going back. */
export type ReachBeat = 'mid' | 'last'

/** Texts she sent on her own at the top of a week, which cost nothing to read. */
export interface BreakReach {
  /** The week of the break they arrived in, counted from 1. */
  week: number
  charId: string
  lines: string[]
  beat?: ReachBeat
  /** He has opened them. */
  read?: boolean
  /** He wrote back, which opened a conversation on them. */
  answered?: boolean
}

/** How many slots a trip to see somebody takes: the way out, two with her, the way back. */
export const TRIP_SLOTS = 4

/**
 * Her asking him to come and stay: open until he answers, which costs nothing; accepted, it
 * takes {@link TRIP_SLOTS} slots from the one it leaves on; done once he is home again.
 */
export interface BreakInvite {
  charId: string
  /** The week of the break she asked in, counted from 1. */
  week: number
  state: 'open' | 'accepted' | 'declined' | 'done'
  /** The index of the slot he leaves on, once he has said yes. */
  departs?: number
}

/** One of the two slots of a trip spent with her, as it was judged. */
export interface BreakVisit {
  /** The index of the slot it was spent on. */
  slot: number
  charId: string
  verdict: BreakVerdict
  /** What happened, in a sentence or two, for whatever with her follows. */
  summary: string
  /** What it left her remembering. */
  memories: BreakMemory[]
  /** Which of his stats the scene exercised. */
  exercised: LedgerStats
  /** What the two of them reached in it, as a scene's own ledger names such things; absent with none. */
  events?: RelationshipEvent[]
}

/** The milestones a slot spent with her may reach: the ones that need the two of them in a room. */
export const VISIT_EVENTS: readonly RelationshipEvent[] = [
  'kissed',
  'sex',
  'became_lovers',
  'agreed_to_harem',
  'friendzoned_by_reader',
  'friendzoned_reader',
  'broke_up'
]

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
  /** Every slot he spent on himself, in order; absent until the first one. */
  alone?: BreakAlone[]
  /** Every time one of them asked him to come and stay, in order; absent until the first. */
  invites?: BreakInvite[]
  /** Every slot spent with somebody he travelled to see, in order; absent until the first. */
  visits?: BreakVisit[]
  /** Everything the girls sent on their own, in order; absent until the first of it. */
  reaches?: BreakReach[]
  /** The last week whose own texts have been asked for; absent before the first. */
  reachedWeek?: number
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

/** Whether a slot can be spent at all: the break is not over, has one left, and no conversation is open. */
function slotOpen(draft: BreakDraft, ended: Season): boolean {
  return !breakOver(draft) && !breakSpent(draft, ended) && openTalk(draft) === null
}

/** Whether the slot is his to spend as he likes: open, and not one a trip under way has claimed. */
function slotFree(draft: BreakDraft, ended: Season): boolean {
  return slotOpen(draft, ended) && tripStep(draft) === null
}

/** The break with one more slot let go by; where none can be spent it is left as it is. */
export function withSlotSpent(draft: BreakDraft, ended: Season): BreakDraft {
  if (!slotFree(draft, ended)) return draft
  return { ...draft, spent: [...draft.spent, { kind: 'rest' }] }
}

/**
 * The break with a slot spent on a conversation with `charId`, opened on his first text and on
 * whatever she had sent that he had not answered; where
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
  // Texts of hers he has not answered are what the conversation opens on.
  const reach = unansweredReach(draft, charId)
  const opening: BreakLine[] = (reach?.lines ?? []).map((line) => ({
    sender: 'contact',
    text: line
  }))
  return {
    ...draft,
    spent: [...draft.spent, { kind: 'text', charId }],
    talks: [
      ...draft.talks,
      {
        slot: draft.spent.length,
        charId,
        lines: [...opening, { sender: 'player', text: said }]
      }
    ],
    ...(reach
      ? {
          reaches: draft.reaches?.map((other) =>
            other === reach ? { ...other, read: true, answered: true } : other
          )
        }
      : {})
  }
}

/** The week of a summer in which more of them write than usual. */
const MID_SUMMER_WEEK = 6

/** A number off a charId that is the same every time, so who writes when never reshuffles. */
function seedOf(charId: string): number {
  let seed = 0
  for (const character of charId) seed = (seed * 31 + character.charCodeAt(0)) >>> 0
  return seed
}

/**
 * Whether she writes to him on her own in `week`, and on which occasion. A lover writes most
 * weeks of a summer and once in a winter; somebody friendly every third week of a summer;
 * somebody who only knows him once a summer. Everybody close writes in the last week of either
 * break and in the middle of a summer, and nobody who has soured on him writes at all.
 */
export function reachOutDue(
  charId: string,
  standing: BreakStanding,
  week: number,
  ended: Season
): ReachBeat | 'plain' | null {
  const { disposition, lover } = standing
  if (disposition === 'annoyed' || disposition === 'hostile') return null
  const close = lover || disposition !== 'neutral'
  // The first days home are everybody's own.
  if (week <= 1) return null
  if (week === breakWeeks(ended)) return close ? 'last' : null
  const seed = seedOf(charId)
  if (ended === 'fall') return lover && week === 2 ? 'plain' : null
  if (week === MID_SUMMER_WEEK) return close || seed % 2 === 0 ? 'mid' : null
  if (lover) return (week + seed) % 3 !== 0 ? 'plain' : null
  if (close) return (week + seed) % 3 === 0 ? 'plain' : null
  return week === 2 + (seed % 9) ? 'plain' : null
}

/** The week whose own texts have not been asked for yet; `null` where there is none to ask for. */
export function pendingReachWeek(draft: BreakDraft, ended: Season): number | null {
  if (breakOver(draft) || breakSpent(draft, ended) || openTalk(draft) !== null) return null
  const { week } = breakClock(draft.spent.length, ended)
  return week > (draft.reachedWeek ?? 0) ? week : null
}

/** The break with `week` asked for and whatever arrived in it filed; nothing said is nothing filed. */
export function withReaches(
  draft: BreakDraft,
  week: number,
  arrived: ReadonlyArray<Pick<BreakReach, 'charId' | 'lines' | 'beat'>>
): BreakDraft {
  const filed: BreakReach[] = arrived.flatMap(({ charId, lines, beat }) => {
    const said = lines.map((line) => line.trim()).filter((line) => line !== '')
    return said.length > 0 ? [{ week, charId, lines: said, ...(beat ? { beat } : {}) }] : []
  })
  return {
    ...draft,
    reachedWeek: week,
    ...(filed.length > 0 ? { reaches: [...(draft.reaches ?? []), ...filed] } : {})
  }
}

/** The newest thing she sent that he has not written back to; `null` with none. */
export function unansweredReach(
  draft: Pick<BreakDraft, 'reaches'>,
  charId: string
): BreakReach | null {
  const hers = (draft.reaches ?? []).filter((reach) => reach.charId === charId)
  const last = hers[hers.length - 1]
  return last && !last.answered ? last : null
}

/** How many times she has written this break and had nothing back. */
export function reachesIgnored(draft: Pick<BreakDraft, 'reaches'>, charId: string): number {
  return (draft.reaches ?? []).filter((reach) => reach.charId === charId && !reach.answered).length
}

/** The break with what she last sent opened; with nothing unread from her, as it is. */
export function withReachRead(draft: BreakDraft, charId: string): BreakDraft {
  const reach = unansweredReach(draft, charId)
  if (!reach || reach.read) return draft
  return {
    ...draft,
    reaches: draft.reaches?.map((other) => (other === reach ? { ...other, read: true } : other))
  }
}

/** Her invitation still waiting on his answer; `null` with none. */
export function openInvite(draft: Pick<BreakDraft, 'invites'>, charId: string): BreakInvite | null {
  return (
    (draft.invites ?? []).find((invite) => invite.charId === charId && invite.state === 'open') ??
    null
  )
}

/** The trip he has said yes to and is not home from yet; `null` with none. */
export function activeTrip(draft: Pick<BreakDraft, 'invites'>): BreakInvite | null {
  return (draft.invites ?? []).find((invite) => invite.state === 'accepted') ?? null
}

/**
 * The slot a trip accepted now would leave on — the next second slot of a week — or `null` where
 * the break has not the {@link TRIP_SLOTS} slots left from there to fit it.
 */
export function tripDeparture(draft: Pick<BreakDraft, 'spent'>, ended: Season): number | null {
  const at = draft.spent.length
  const departs = at % BREAK_SLOTS_PER_WEEK === 1 ? at : at + 1
  return departs + TRIP_SLOTS <= breakSlots(ended) ? departs : null
}

/**
 * Whether she may ask him to come and stay: somebody close to him — a lover only, over a winter
 * — with no invitation of hers waiting or under way, and a break with room left for the trip.
 */
export function mayInvite(
  draft: BreakDraft,
  charId: string,
  standing: BreakStanding,
  ended: Season
): boolean {
  const close =
    standing.lover ||
    (ended === 'spring' &&
      (standing.disposition === 'friendly' ||
        standing.disposition === 'trusted' ||
        standing.disposition === 'devoted'))
  if (!close || tripDeparture(draft, ended) === null) return false
  return !(draft.invites ?? []).some(
    (invite) => invite.charId === charId && (invite.state === 'open' || invite.state === 'accepted')
  )
}

/** The break with her invitation filed, waiting on his answer; one already waiting is not doubled. */
export function withInvite(draft: BreakDraft, charId: string, ended: Season): BreakDraft {
  if (breakOver(draft) || openInvite(draft, charId)) return draft
  const { week } = breakClock(draft.spent.length, ended)
  return { ...draft, invites: [...(draft.invites ?? []), { charId, week, state: 'open' }] }
}

/**
 * The break with his answer to her invitation. A yes books the trip from the next second slot of
 * a week, and is refused — the break is left as it is — while another trip is booked or under
 * way, or where the break has not the room left; a no is always taken.
 */
export function withInviteAnswered(
  draft: BreakDraft,
  charId: string,
  accept: boolean,
  ended: Season
): BreakDraft {
  const invite = openInvite(draft, charId)
  if (!invite || breakOver(draft)) return draft
  const departs = tripDeparture(draft, ended)
  if (accept && (activeTrip(draft) !== null || departs === null)) return draft
  const answered: BreakInvite = accept
    ? { ...invite, state: 'accepted', departs: departs ?? undefined }
    : { ...invite, state: 'declined' }
  return {
    ...draft,
    invites: draft.invites?.map((other) => (other === invite ? answered : other))
  }
}

/** What a trip under way asks of the slot being played. */
export interface TripStep {
  charId: string
  /** The way out, the first or second slot with her, or the way back. */
  kind: 'out' | 'visit' | 'back'
  /** Which of the two slots with her, for a visit. */
  day?: 1 | 2
}

/** What the booked trip claims the next slot for; `null` before it leaves and with no trip. */
export function tripStep(draft: Pick<BreakDraft, 'spent' | 'invites'>): TripStep | null {
  const trip = activeTrip(draft)
  if (!trip || trip.departs === undefined) return null
  const into = draft.spent.length - trip.departs
  if (into < 0 || into >= TRIP_SLOTS) return null
  if (into === 0) return { charId: trip.charId, kind: 'out' }
  if (into === TRIP_SLOTS - 1) return { charId: trip.charId, kind: 'back' }
  return { charId: trip.charId, kind: 'visit', day: into === 1 ? 1 : 2 }
}

/** The slots a booked trip has still to take, by index: what the calendar marks ahead. */
export function tripSlotsAhead(draft: Pick<BreakDraft, 'spent' | 'invites'>): number[] {
  const trip = activeTrip(draft)
  if (!trip || trip.departs === undefined) return []
  const slots: number[] = []
  for (let slot = trip.departs; slot < trip.departs + TRIP_SLOTS; slot += 1) {
    if (slot >= draft.spent.length) slots.push(slot)
  }
  return slots
}

/**
 * The break with the slot a trip claims for travelling spent on it; the way back is what ends
 * the trip. Where the trip asks for no travel now, the break is left as it is.
 */
export function withTravel(draft: BreakDraft, ended: Season): BreakDraft {
  const step = tripStep(draft)
  if (!step || step.kind === 'visit' || !slotOpen(draft, ended)) return draft
  const trip = activeTrip(draft)
  return {
    ...draft,
    spent: [...draft.spent, { kind: 'travel', charId: step.charId }],
    // Whatever she had sent and he had not answered, he is answering in person.
    ...(draft.reaches?.some((reach) => reach.charId === step.charId && !reach.answered)
      ? {
          reaches: draft.reaches.map((reach) =>
            reach.charId === step.charId && !reach.answered
              ? { ...reach, read: true, answered: true }
              : reach
          )
        }
      : {}),
    ...(step.kind === 'back'
      ? {
          invites: draft.invites?.map((invite) =>
            invite === trip ? { ...invite, state: 'done' as const } : invite
          )
        }
      : {})
  }
}

/** What a slot with her is to the stat rules: a scene with company, and no class or shift. */
const VISIT = { solo: false, classScene: false, classOutcome: null, jobOutcome: null } as const

/** What a slot spent with her pays, by the rule a scene with company pays under in a semester. */
export function visitGains(exercised: LedgerStats): ReturnType<typeof resolveStatDeltas> {
  return resolveStatDeltas(exercised, VISIT)
}

/**
 * The break with the slot a trip claims for her spent with her: what it came to filed, and his
 * stats paid as a scene with company pays. Where the trip asks for no visit now, it is left as
 * it is.
 */
export function withVisit(
  draft: BreakDraft,
  judged: Pick<BreakVisit, 'verdict' | 'summary' | 'memories' | 'exercised' | 'events'>,
  ended: Season
): BreakDraft {
  const step = tripStep(draft)
  if (!step || step.kind !== 'visit' || !slotOpen(draft, ended)) return draft
  const memories = judged.memories
    .map((memory) => ({ type: memory.type, desc: memory.desc.trim() }))
    .filter((memory) => memory.desc !== '')
    .slice(0, TALK_MEMORIES)
  const events = (judged.events ?? []).filter((event) => VISIT_EVENTS.includes(event))
  return {
    ...draft,
    stats: applyStatDeltas(draft.stats, visitGains(judged.exercised).deltas),
    spent: [...draft.spent, { kind: 'visit', charId: step.charId }],
    visits: [
      ...(draft.visits ?? []),
      {
        slot: draft.spent.length,
        charId: step.charId,
        verdict: judged.verdict,
        summary: judged.summary.trim(),
        memories,
        exercised: judged.exercised,
        ...(events.length > 0 ? { events } : {})
      }
    ]
  }
}

/** What a slot spent alone is to the stat rules: an hour with nobody else in it, and no class or shift. */
const ALONE = { solo: true, classScene: false, classOutcome: null, jobOutcome: null } as const

/**
 * What a slot spent alone pays, by the rule a scene alone pays under during a semester: every
 * stat it exercised, twice over, and the lines that say so.
 */
export function aloneGains(exercised: LedgerStats): ReturnType<typeof resolveStatDeltas> {
  return resolveStatDeltas(exercised, ALONE)
}

/**
 * The break with a slot spent on himself: what he did filed, and his stats moved by what it
 * exercised. Where no slot can be spent, or he said nothing of what he would do, it is left as
 * it is.
 */
export function withTimeAlone(
  draft: BreakDraft,
  action: string,
  lines: readonly string[],
  exercised: LedgerStats,
  ended: Season
): BreakDraft {
  const did = action.trim()
  if (!slotFree(draft, ended) || did === '') return draft
  const spent: BreakAlone = {
    slot: draft.spent.length,
    action: did,
    lines: lines.map((line) => line.trim()).filter((line) => line !== ''),
    exercised: {
      brain: exercised.brain === true,
      body: exercised.body === true,
      heart: exercised.heart === true
    }
  }
  return {
    ...draft,
    stats: applyStatDeltas(draft.stats, aloneGains(spent.exercised).deltas),
    spent: [...draft.spent, { kind: 'alone' }],
    alone: [...(draft.alone ?? []), spent]
  }
}

/**
 * Whether anything was done in the break but let it go by, which is what makes it one that is
 * closed from what happened in it rather than written for him.
 */
export function breakPlayed(draft: Pick<BreakDraft, 'talks' | 'alone' | 'visits'>): boolean {
  return (
    draft.talks.length > 0 || (draft.alone?.length ?? 0) > 0 || (draft.visits?.length ?? 0) > 0
  )
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
  /** She asked him, in this conversation, to come and stay with her. */
  invited?: boolean
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
  draft: Pick<BreakDraft, 'talks' | 'promises' | 'visits' | 'invites'>,
  standings: Readonly<Record<string, BreakStanding>>,
  ended: Season
): Record<string, BreakMemory[]> {
  return Object.fromEntries(
    Object.entries(standings).map(([charId, standing]) => {
      const talks = draft.talks.filter((talk) => talk.charId === charId)
      const visits = (draft.visits ?? []).filter((visit) => visit.charId === charId)
      // Conversations and days spent with her, in the order they happened.
      const memories: BreakMemory[] = [
        ...talks.map((talk) => ({ slot: talk.slot, left: talk.memories ?? [] })),
        ...visits.map((visit) => ({ slot: visit.slot, left: visit.memories }))
      ]
        .sort((a, b) => a.slot - b.slot)
        .flatMap((entry) => entry.left)
      // A promise still open when the break ends is one he never kept. One is remembered,
      // the first: the conversation a promise was gone back on in has already said the rest.
      const unkept = (draft.promises[charId] ?? []).find((promise) => promise.state !== 'kept')
      if (unkept) {
        memories.push({
          type: 'disliked',
          desc: `the reader promised to ${unkept.text} and never did`
        })
      }
      // Turning her down once is nothing, but for somebody he is with; again and again is not.
      const declined = (draft.invites ?? []).filter(
        (invite) => invite.charId === charId && invite.state === 'declined'
      ).length
      if (visits.length === 0 && declined >= (standing.lover ? 1 : 2)) {
        memories.push({
          type: 'disliked',
          desc: 'the reader turned down her invitation to come and see her over the break'
        })
      }
      if (talks.length === 0 && visits.length === 0 && mindsSilence(standing, ended)) {
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
 * `carry` with the break filed on the phone: each conversation's texts appended to her thread on
 * the day its slot fell on, and whatever she sent that he never answered on the first day of its
 * week, all of it read already. Somebody who is not coming back, and a conversation with nothing
 * said in it, are left out.
 */
export function withBreakThreads(
  carry: TermCarry,
  talks: readonly BreakTalk[],
  ended: Season,
  reaches: readonly BreakReach[] = []
): TermCarry {
  // Each run of texts under the slot it belongs to; hers come before anything spent in her week.
  const runs = [
    ...talks.map((talk) => ({
      at: talk.slot,
      slot: talk.slot,
      id: `break-${talk.slot}`,
      charId: talk.charId,
      lines: talk.lines
    })),
    ...reaches
      .filter((reach) => !reach.answered)
      .map((reach) => {
        const slot = (reach.week - 1) * BREAK_SLOTS_PER_WEEK
        return {
          at: slot - 0.5,
          slot,
          id: `break-reach-${reach.week}`,
          charId: reach.charId,
          lines: reach.lines.map((text): BreakLine => ({ sender: 'contact', text }))
        }
      })
  ].sort((a, b) => a.at - b.at)

  const conversations = { ...carry.bunnyboard.conversations }
  for (const run of runs) {
    if (!carry.charInfo[run.charId] || run.lines.length === 0) continue
    const { date, time } = breakSlotDate(run.slot, ended)
    const messages: ChatMessage[] = run.lines.map((line, index) => ({
      id: `${run.id}-${index}`,
      sender: line.sender,
      text: line.text,
      date,
      time
    }))
    const thread = conversations[run.charId] ?? {
      charId: run.charId,
      messages: [],
      unread: 0,
      summary: null
    }
    conversations[run.charId] = { ...thread, messages: [...thread.messages, ...messages] }
  }
  return { ...carry, bunnyboard: { ...carry.bunnyboard, conversations } }
}

/**
 * `carry` with what the break's visits reached folded in: each milestone on the day its slot
 * fell on, as a scene's own would be, so a couple made over the break is one from that day and a
 * first kiss is remembered on it. Somebody who is not coming back is left out.
 */
export function withBreakEvents(
  carry: TermCarry,
  visits: readonly BreakVisit[],
  ended: Season
): TermCarry {
  const charInfo = { ...carry.charInfo }
  for (const visit of visits) {
    const info = charInfo[visit.charId]
    if (!info || !visit.events || visit.events.length === 0) continue
    charInfo[visit.charId] = foldRelationshipEvents(
      info,
      visit.events,
      breakSlotDate(visit.slot, ended).date
    )
  }
  return { ...carry, charInfo }
}

/** One break with its version and the moment it was written stamped on it. */
export function stampBreak(draft: BreakDraft, savedAt: number): TermBreak {
  return { ...draft, schemaVersion: BREAK_SCHEMA_VERSION, savedAt }
}

const BREAK_REQUIRED: Record<keyof Omit<
    TermBreak,
    'memories' | 'cards' | 'alone' | 'reaches' | 'reachedWeek' | 'invites' | 'visits'
  >, true> = {
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
