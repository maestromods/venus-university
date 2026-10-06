import { FINAL_DATE } from '@shared/classes'
import {
  affectionFor,
  dispositionOf,
  emptyFlags,
  foldRelationshipEvents,
  memoryStatusLine,
  milestoneMarkOf,
  milestoneStatusLines,
  relationshipTagOf
} from '@shared/relationship'
import {
  daysToNextTerm,
  seasonOf,
  seasonWords,
  setActiveTerm,
  termIndexOf,
  type Season
} from '@shared/term'
import {
  activeTrip,
  breakClock,
  breakSlotDate,
  breakWeeks,
  mayInvite,
  openTalk,
  tripStep,
  visitGains,
  withVisit,
  reachesIgnored,
  reachOutDue,
  strongAllowed,
  unansweredReach,
  type BreakCard,
  type BreakDraft,
  type BreakReach,
  type BreakStanding,
  type BreakVisit,
  type TalkJudgement
} from '@shared/termBreak'
import { returningChars, type BreakMemory } from '@shared/termCarry'
import {
  charKeyOf,
  READER_SPEAKER,
  type AppError,
  type Character,
  type GameSave,
  type Result,
  type SceneLine,
  type StructuredRequest
} from '@shared/types'
import { normalizeBreakReply, type BreakGenReply } from '../prompts/breakPrompt'
import {
  buildBreakAlonePrompt,
  buildBreakCardsPrompt,
  buildBreakJudgePrompt,
  buildBreakReachPrompt,
  buildBreakTalkPrompt,
  buildBreakVisitPrompt,
  normalizeBreakAlone,
  normalizeBreakCards,
  normalizeBreakJudgement,
  normalizeBreakReach,
  normalizeBreakVisit,
  type BreakAloneReply,
  type BreakCardsReply,
  type BreakGirl,
  type BreakJudgeReply,
  type BreakReachGirl,
  type BreakReachReply,
  type BreakSetting,
  type BreakTalkReply,
  type BreakTripNotes,
  type BreakVisitReply
} from '../prompts/breakTalkPrompt'
import { formatNumericGameDate } from '../prompts/gameDate'
import { coverSwap } from './crossingStore'
import { enterTrip, leaveToMenu } from './gameLoop'
import { markStatusLine } from './loop/statusSteps'
import type { TripRun } from './loop/state'
import {
  breakAskOf,
  breakReaderOf,
  keptFrom,
  stageContinuation,
  type Continuation
} from './newGame'
import { useUiStore } from './uiStore'
import { useSettingsStore } from './settingsStore'
import { coverSceneOpening } from './slotCrossing'
import { retrySilently } from './silentRetry'

/**
 * The break screen's own calls: who of a finished semester's roster is coming back, the card
 * each of them carries through a played break, her side of a conversation, the judgement of
 * one, and the one call that writes what everybody remembers of a break nobody played.
 */

/** The cancellation group every call of the break screen registers under. */
const BREAK_LLM_GROUP = 'break:llm'

/** The identity of the call in flight, dropped by {@link cancelBreakCall}. */
let run: object | null = null

/** Cancellers for the backoff sleep in flight, so leaving never waits one out. */
let sleepers: (() => void)[] = []

/** Whoever of the finished roster is coming back and is still on disk, in roster order. */
export function returningCast(from: Continuation): Character[] {
  return returningChars(from.record).flatMap((charId) => {
    const character = from.characters[charId]
    return character ? [character] : []
  })
}

/** Those of them who have met the reader, which is everybody the break has anything to say about. */
export function breakCast(from: Continuation): Character[] {
  return returningCast(from).filter((c) => from.save.charInfo[c.charId]?.flags.hasMet)
}

/** Whether the reader can text her: he has her number, knows her name, and she has not blocked him. */
export function canText(from: Continuation, charId: string): boolean {
  const info = from.save.charInfo[charId]
  return (
    info?.nameKnown === true && info.flags.gaveContactInfo === true && info.flags.blocked !== true
  )
}

/** The season of the semester the break follows. */
function endedOf(from: Continuation): Season {
  return seasonOf(termIndexOf(from.record))
}

/**
 * Everybody the break is about as its calls read them — each with her moving half as it is
 * carried over the break — and what every call is told about the break. The semester after the
 * finished one is named the active term first, since every call is worded and dated against it.
 */
function castFor(from: Continuation): { girls: BreakGirl[]; setting: BreakSetting } {
  setActiveTerm(termIndexOf(from.record) + 1)
  const { kept, carried } = keptFrom(returningCast(from), from)
  const girls: BreakGirl[] = kept
    .filter((c) => carried.carry.charInfo[c.charId]?.flags.hasMet)
    .map((character) => ({ character, state: carried.carry.charInfo[character.charId] }))
  return {
    girls,
    setting: {
      ended: endedOf(from),
      reader: breakReaderOf(from, kept, carried),
      stats: from.save.stats
    }
  }
}

/** How each of them stood with the reader when the semester ended, by charId. */
export function breakStandings(from: Continuation): Record<string, BreakStanding> {
  const { girls, setting } = castFor(from)
  const then = FINAL_DATE - daysToNextTerm(setting.ended)
  return Object.fromEntries(
    girls.map(({ character, state }) => [
      character.charId,
      {
        disposition: dispositionOf(affectionFor(state, then, character)),
        lover: state.flags.isLover
      }
    ])
  )
}

/**
 * What the reader calls each of them, as her contact page said it when the semester ended, with
 * whatever the break's visits have reached since folded in.
 */
export function breakTags(
  from: Continuation,
  visits: readonly BreakVisit[] = []
): Record<string, string> {
  const { girls, setting } = castFor(from)
  const then = FINAL_DATE - daysToNextTerm(setting.ended)
  return Object.fromEntries(
    girls.map(({ character, state }) => {
      const events = visits
        .filter((visit) => visit.charId === character.charId)
        .flatMap((visit) => visit.events ?? [])
      const flags = foldRelationshipEvents(state, events, then).flags
      return [character.charId, relationshipTagOf(flags, affectionFor(state, then, character))]
    })
  )
}

/** How a call of the break ended: its answer, why it could not be had, or left. */
export type BreakOutcome<T> =
  | { status: 'done'; data: T }
  | { status: 'failed'; error: AppError }
  | { status: 'cancelled' }

/** What a connection dropped while the reply was still arriving says of itself. */
const DROPPED = /terminated|ECONNRESET|socket hang up|fetch failed/i

/**
 * `error` named as the lost connection it is, where the transport reported a reply cut off
 * part-way under no code of its own: such a call is worth re-sending, and is said to the player
 * as a connection problem rather than by the transport's one word.
 */
function asNetworkError(error: AppError): AppError {
  if (error.code !== 'UNKNOWN' || !DROPPED.test(`${error.message} ${error.detail ?? ''}`)) {
    return error
  }
  return {
    ...error,
    code: 'LLM_NETWORK',
    message: 'The connection dropped before the reply arrived.'
  }
}

/**
 * Sends one structured call, re-sending under the silent backoff until it lands or the budget
 * runs out. One call is in flight at a time: a second one abandons the first.
 */
async function send<T>(call: string, request: StructuredRequest): Promise<BreakOutcome<T>> {
  const mine = {}
  run = mine
  sleepers = []

  let spent = 0
  for (;;) {
    const generated: Result<T> = await window.api.llm.generateBreak<T>(request, BREAK_LLM_GROUP)
    if (run !== mine) return { status: 'cancelled' }
    if (generated.ok) return { status: 'done', data: generated.data }

    const error = asNetworkError(generated.error)
    console.warn(`[break] ${call} failed:`, error)
    const retried = await retrySilently(`break:${call}`, error, spent, {
      onSleep: (cancel) => sleepers.push(cancel)
    })
    if (run !== mine) return { status: 'cancelled' }
    if (!retried) return { status: 'failed', error }
    spent += 1
  }
}

/** `outcome` with its answer turned into what the caller keeps. */
function mapped<T, U>(outcome: BreakOutcome<T>, read: (data: T) => U): BreakOutcome<U> {
  return outcome.status === 'done' ? { status: 'done', data: read(outcome.data) } : outcome
}

/**
 * Asks what each returning girl who has met the reader remembers of a break nobody played.
 * Nobody to ask about is an empty answer and no call.
 */
export async function writeBreakMemories(
  from: Continuation
): Promise<BreakOutcome<Record<string, BreakMemory[]>>> {
  setActiveTerm(termIndexOf(from.record) + 1)
  const { kept, carried } = keptFrom(returningCast(from), from)
  const ask = breakAskOf(from, kept, carried)
  if (!ask) return { status: 'done', data: {} }
  return mapped(await send<BreakGenReply>('memories', ask.breakRequest), (reply) =>
    normalizeBreakReply(reply, ask.breakInput)
  )
}

/** Asks for the card each returning girl carries through the break, by charId. */
export async function writeBreakCards(
  from: Continuation
): Promise<BreakOutcome<Record<string, BreakCard>>> {
  const { girls, setting } = castFor(from)
  if (girls.length === 0) return { status: 'done', data: {} }
  return mapped(
    await send<BreakCardsReply>('cards', buildBreakCardsPrompt(girls, setting)),
    (reply) => normalizeBreakCards(reply, girls)
  )
}

/** What a week's own texts came to: whoever wrote, and the cards where they had to be written first. */
export interface ReachOuts {
  arrived: Array<Pick<BreakReach, 'charId' | 'lines' | 'beat'> & { invites: boolean }>
  cards?: Record<string, BreakCard>
}

/**
 * Asks for what the girls send on their own at the top of `week`: whoever is due to write by
 * how she stands with him, among those who have his number. A week nobody writes in is an empty
 * answer and no call; the first week somebody does asks for everybody's cards first.
 */
export async function writeReachOuts(
  from: Continuation,
  draft: BreakDraft,
  week: number
): Promise<BreakOutcome<ReachOuts>> {
  const { girls, setting } = castFor(from)
  const standings = breakStandings(from)
  const due = girls.flatMap((girl) => {
    const charId = girl.character.charId
    const standing = standings[charId]
    const beat =
      standing && canText(from, charId) ? reachOutDue(charId, standing, week, setting.ended) : null
    // Somebody still waiting on an answer does not write again, but for the last week's goodbye.
    if (beat !== 'last' && unansweredReach(draft, charId)) return []
    // Nor does somebody he is about to see, or is staying with: she has him there to tell.
    if (activeTrip(draft)?.charId === charId) return []
    return beat ? [{ girl, beat }] : []
  })
  if (due.length === 0) return { status: 'done', data: { arrived: [] } }

  let cards = draft.cards
  let written: Record<string, BreakCard> | undefined
  if (due.some(({ girl }) => !cards?.[girl.character.charId])) {
    const outcome = await writeBreakCards(from)
    if (outcome.status !== 'done') return outcome
    written = outcome.data
    cards = { ...cards, ...written }
  }

  const writing: BreakReachGirl[] = due.flatMap(({ girl, beat }) => {
    const charId = girl.character.charId
    const card = cards?.[charId]
    if (!card) return []
    return [
      {
        girl,
        card,
        beat,
        earlier: draft.talks.filter(
          (talk) => talk.charId === charId && talk.verdict !== undefined
        ),
        promises: draft.promises[charId] ?? [],
        ignored: reachesIgnored(draft, charId),
        trip: tripNotesOf(draft, charId),
        mayInvite: mayInviteNow(from, draft, charId)
      }
    ]
  })
  if (writing.length === 0) return { status: 'done', data: { arrived: [], cards: written } }

  return mapped(
    await send<BreakReachReply>('reach', buildBreakReachPrompt(writing, week, setting)),
    (reply) => {
      const texts = normalizeBreakReach(reply, writing)
      return {
        arrived: writing.flatMap(({ girl, beat }) => {
          const sent = texts[girl.character.charId]
          return sent
            ? [
                {
                  charId: girl.character.charId,
                  lines: sent.lines,
                  invites: sent.invites,
                  ...(beat === 'plain' ? {} : { beat })
                }
              ]
            : []
        }),
        ...(written ? { cards: written } : {})
      }
    }
  )
}

/** What the open conversation's calls read, or `null` where there is none or she has no card. */
function talkInputOf(from: Continuation, draft: BreakDraft) {
  const talk = openTalk(draft)
  const card = talk ? draft.cards?.[talk.charId] : undefined
  if (!talk || !card) return null
  const { girls, setting } = castFor(from)
  const girl = girls.find(({ character }) => character.charId === talk.charId)
  if (!girl) return null
  return {
    girl,
    card,
    talk,
    earlier: draft.talks.filter(
      (other) => other.charId === talk.charId && other.verdict !== undefined
    ),
    promises: draft.promises[talk.charId] ?? [],
    ignored: reachesIgnored(draft, talk.charId),
    trip: tripNotesOf(draft, talk.charId),
    mayInvite: mayInviteNow(from, draft, talk.charId),
    setting
  }
}

/** Raised when a conversation's call has nothing to be about; never met in play. */
const NO_TALK: BreakOutcome<never> = {
  status: 'failed',
  error: { code: 'BREAK_NO_TALK', message: 'There is no conversation to carry on.' }
}

/** Asks for her reply to his newest text in the open conversation. */
export async function replyToTalk(
  from: Continuation,
  draft: BreakDraft
): Promise<BreakOutcome<BreakTalkReply>> {
  const input = talkInputOf(from, draft)
  if (!input) return NO_TALK
  return mapped(await send<BreakTalkReply>('reply', buildBreakTalkPrompt(input)), (reply) => ({
    messages: Array.isArray(reply?.messages)
      ? reply.messages.filter((text): text is string => typeof text === 'string')
      : [],
    leaving: reply?.leaving === true
  }))
}

/** Asks for the judgement of the open conversation, once it has ended. */
export async function judgeTalk(
  from: Continuation,
  draft: BreakDraft
): Promise<BreakOutcome<TalkJudgement>> {
  const input = talkInputOf(from, draft)
  if (!input) return NO_TALK
  const strong = {
    warmer: strongAllowed(draft, input.talk.charId, 'warmer'),
    cooler: strongAllowed(draft, input.talk.charId, 'cooler')
  }
  return mapped(
    await send<BreakJudgeReply>('judgement', buildBreakJudgePrompt({ ...input, strong })),
    normalizeBreakJudgement
  )
}

/**
 * Asks how a slot he spends on himself goes, and which of his stats it exercised. A reply with
 * nothing narrated in it is a failure: there would be nothing to show for the slot.
 */
export async function spendTimeAlone(
  from: Continuation,
  draft: BreakDraft,
  action: string
): Promise<BreakOutcome<ReturnType<typeof normalizeBreakAlone>>> {
  const { setting } = castFor(from)
  const outcome = mapped(
    await send<BreakAloneReply>(
      'alone',
      buildBreakAlonePrompt({
        action,
        slot: draft.spent.length,
        earlier: draft.alone ?? [],
        lessNsfwText: useSettingsStore.getState().settings?.lessNsfwText === true,
        setting
      })
    ),
    normalizeBreakAlone
  )
  if (outcome.status === 'done' && outcome.data.lines.length === 0) {
    return {
      status: 'failed',
      error: { code: 'LLM_EMPTY', message: 'The reply came back with nothing in it.' }
    }
  }
  return outcome
}

/** What a call is told of trips with her: the days already spent together, and where her invitation stands. */
function tripNotesOf(draft: BreakDraft, charId: string): BreakTripNotes {
  const invites = (draft.invites ?? []).filter((invite) => invite.charId === charId)
  const last = invites[invites.length - 1]
  return {
    visits: (draft.visits ?? []).filter((visit) => visit.charId === charId),
    ...(last && last.state !== 'done' ? { invite: last.state } : {})
  }
}

/** Whether she may ask him to come and stay, as the break stands. */
function mayInviteNow(from: Continuation, draft: BreakDraft, charId: string): boolean {
  const standing = breakStandings(from)[charId]
  return standing !== undefined && mayInvite(draft, charId, standing, endedOf(from))
}

/** How long a line of the trip's own narration is given before the engine takes the screen back. */
const VISIT_OVER = 'The day is over.'

/**
 * Opens the engine on the stretch of a trip the break is up to: a real scene with her, wherever
 * she is spending the break, written from the break's own premise. Nothing the scene does is
 * written to the finished semester; when its last line has been read the break is told what it
 * came to — judged by one call against her card — and takes the screen back with the slot spent.
 * Returns whether the scene was opened.
 */
export function startVisit(from: Continuation, draft: BreakDraft): boolean {
  const step = tripStep(draft)
  const card = step ? draft.cards?.[step.charId] : undefined
  if (!step || step.kind !== 'visit' || !card) return false
  const { girls, setting } = castFor(from)
  const girl = girls.find(({ character }) => character.charId === step.charId)
  const info = from.save.charInfo[step.charId]
  if (!girl || !info) return false

  const ended = setting.ended
  const name = girl.character.firstName
  const key = charKeyOf(girl.character.firstName, girl.character.lastName)
  const words = seasonWords(ended)
  const slot = draft.spent.length
  const { week } = breakClock(slot, ended)
  const day = step.day ?? 1
  const earlier = draft.talks.filter(
    (talk) => talk.charId === step.charId && talk.verdict !== undefined
  )
  const visits = (draft.visits ?? []).filter((visit) => visit.charId === step.charId)

  // The finished semester's last save as the break has left it: his stats as they stand now, and
  // what the break has already given her to remember of him.
  const left: BreakMemory[] = [
    ...earlier.flatMap((talk) => talk.memories ?? []),
    ...visits.flatMap((visit) => visit.memories)
  ]
  // And what the days already spent with her reached, so a couple made on the first is one on
  // the second.
  const known = foldRelationshipEvents(
    info,
    visits.flatMap((visit) => visit.events ?? []),
    from.save.date
  )
  const save: GameSave = {
    ...from.save,
    scene: null,
    stats: draft.stats,
    charInfo: {
      ...from.save.charInfo,
      [step.charId]: {
        ...known,
        memories: [
          ...known.memories,
          ...left.map((memory) => ({ ...memory, date: from.save.date }))
        ]
      }
    }
  }

  const before = [
    ...earlier.map((talk) => ({ slot: talk.slot, text: `they texted. ${talk.summary ?? ''}` })),
    ...visits.map((visit) => ({ slot: visit.slot, text: `he arrived and they spent time together. ${visit.summary}` }))
  ]
    .sort((a, b) => a.slot - b.slot)
    .map((entry) => `week ${breakClock(entry.slot, ended).week}, ${entry.text.trim()}`)

  const action = [
    `It is ${words.endBreak}, week ${week} of ${breakWeeks(ended)}, and the reader has travelled a long way from Venus University to stay with ${name} for a few days, at her invitation.`,
    `${card.where}`,
    day === 1
      ? `This is his first stretch there: he has just arrived, and the two of them have not seen each other in person since the semester ended.`
      : `This is his second and last stretch there before he travels home.`,
    before.length > 0 ? `So far this break: ${before.join(' ')}` : '',
    `The scene is somewhere in ${name}'s own world over the break, never on campus, and nobody else from the university is there.`
  ]
    .filter((line) => line !== '')
    .join(' ')

  const now = [
    `It is week ${week} of ${breakWeeks(ended)} of ${words.endBreak}, and the reader is far from Venus University, staying with ${name} where she is spending the break.`,
    `Nobody has classes or shifts: whatever is said below about schedules is for ${words.backIn}, not now.`
    ,
    day === 1 ? 'It is the middle of the day.' : 'It is the evening.'
  ]

  let judged: ReturnType<typeof normalizeBreakVisit> | null = null

  const trip: TripRun = {
    charId: step.charId,
    action,
    now,
    half: day === 1 ? 'day' : 'night',
    stamp: {
      week,
      figure: formatNumericGameDate(breakSlotDate(slot, ended).date, ended === 'spring' ? 'fall' : 'spring'),
      weekday: 'AWAY'
    },
    lines: null,
    judge: async (log) => {
      const scene = log.map((line) => ({
        who: line.speaker === key ? name : line.speaker === READER_SPEAKER ? 'Reader' : '',
        text: line.text
      }))
      const outcome = await send<BreakVisitReply>(
        'visit',
        buildBreakVisitPrompt({
          girl,
          card,
          day,
          slot,
          scene,
          earlier,
          promises: draft.promises[step.charId] ?? [],
          trip: tripNotesOf(draft, step.charId),
          setting
        })
      )
      // A judgement that could not be had leaves the slot spent and nothing remembered of it,
      // rather than holding the scene on a call that will not come.
      if (outcome.status !== 'done') return [{ speaker: '', text: VISIT_OVER }]
      judged = normalizeBreakVisit(outcome.data)
      const gains = visitGains(judged.exercised).lines
      const reached = foldRelationshipEvents(known, judged.events ?? [], from.save.date)
      const milestones = milestoneStatusLines(
        name,
        known.flags ?? emptyFlags(),
        reached.flags ?? emptyFlags()
      )
      const lines = [
        ...judged.memories.map((memory) => memoryStatusLine(name, memory)),
        ...milestones.map((text): SceneLine => {
          const mark = milestoneMarkOf(text)
          return mark
            ? {
                speaker: '',
                text,
                status: { marks: [mark], polarity: mark.tone === 'loss' ? 'negative' : 'positive' }
              }
            : { speaker: '', text }
        }),
        ...gains.map((gain) => markStatusLine(gain.text, undefined, gain.polarity))
      ]
      return lines.length > 0 ? lines : [{ speaker: '', text: VISIT_OVER }]
    },
    done: () => {
      const next = withVisit(
        draft,
        judged ?? {
          verdict: 'neutral',
          summary: '',
          memories: [],
          exercised: { brain: false, body: false, heart: false }
        },
        ended
      )
      void (async () => {
        const written = await window.api.saves.writeBreak(from.playthroughId, next)
        if (!written.ok) useUiStore.getState().showError(written.error)
        await leaveToMenu()
        stageContinuation(from)
        useUiStore.getState().setView('break')
      })()
    }
  }

  // The scene's own opening curtain, raised here over the break screen and taken down by the
  // scene's first line, so the game is never seen before the scene is on it.
  coverSceneOpening()
  coverSwap(() => {
    enterTrip(save, from.record, from.characters, trip)
    useUiStore.getState().setView('game')
  })
  return true
}

/** Abandons the call in flight: the player left the screen, or answered its failure with no. */
export function cancelBreakCall(): void {
  run = null
  const waking = sleepers
  sleepers = []
  for (const wake of waking) wake()
  void window.api.jobs.cancelGroup(BREAK_LLM_GROUP)
}
