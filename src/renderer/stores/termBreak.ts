import { FINAL_DATE } from '@shared/classes'
import { affectionFor, dispositionOf } from '@shared/relationship'
import { daysToNextTerm, seasonOf, setActiveTerm, termIndexOf, type Season } from '@shared/term'
import {
  openTalk,
  strongAllowed,
  type BreakCard,
  type BreakDraft,
  type BreakStanding,
  type TalkJudgement
} from '@shared/termBreak'
import { returningChars, type BreakMemory } from '@shared/termCarry'
import type { AppError, Character, Result, StructuredRequest } from '@shared/types'
import { normalizeBreakReply, type BreakGenReply } from '../prompts/breakPrompt'
import {
  buildBreakCardsPrompt,
  buildBreakJudgePrompt,
  buildBreakTalkPrompt,
  normalizeBreakCards,
  normalizeBreakJudgement,
  type BreakCardsReply,
  type BreakGirl,
  type BreakJudgeReply,
  type BreakSetting,
  type BreakTalkReply
} from '../prompts/breakTalkPrompt'
import { breakAskOf, breakReaderOf, keptFrom, type Continuation } from './newGame'
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

/** Abandons the call in flight: the player left the screen, or answered its failure with no. */
export function cancelBreakCall(): void {
  run = null
  const waking = sleepers
  sleepers = []
  for (const wake of waking) wake()
  void window.api.jobs.cancelGroup(BREAK_LLM_GROUP)
}
