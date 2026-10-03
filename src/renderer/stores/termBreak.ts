import { returningChars } from '@shared/termCarry'
import { setActiveTerm, termIndexOf } from '@shared/term'
import type { BreakMemory } from '@shared/termCarry'
import type { AppError, Character, Result } from '@shared/types'
import { normalizeBreakReply, type BreakGenReply } from '../prompts/breakPrompt'
import { breakAskOf, keptFrom, type Continuation } from './newGame'
import { retrySilently } from './silentRetry'

/**
 * The break screen's own calls: who of a finished semester's roster is coming back, and the one
 * call that writes what each of them remembers of a break nobody played out.
 */

/** The cancellation group the break screen's one-shot registers under. */
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

/** How the memory call ended: its memories by charId, why it could not be written, or left. */
export type BreakMemoriesOutcome =
  | { status: 'written'; memories: Record<string, BreakMemory[]> }
  | { status: 'failed'; error: AppError }
  | { status: 'cancelled' }

/**
 * Asks what each returning girl who has met the reader remembers of the break, re-sending under
 * the silent backoff until it lands or the budget runs out. Nobody to ask about is an empty
 * answer and no call. The semester after the finished one is named the active term first, since
 * the call is worded and dated against it.
 */
export async function writeBreakMemories(from: Continuation): Promise<BreakMemoriesOutcome> {
  const mine = {}
  run = mine
  sleepers = []

  setActiveTerm(termIndexOf(from.record) + 1)
  const { kept, carried } = keptFrom(returningCast(from), from)
  const ask = breakAskOf(from, kept, carried)
  if (!ask) return { status: 'written', memories: {} }

  let spent = 0
  for (;;) {
    const generated: Result<BreakGenReply> = await window.api.llm.generateBreak<BreakGenReply>(
      ask.breakRequest,
      BREAK_LLM_GROUP
    )
    if (run !== mine) return { status: 'cancelled' }
    if (generated.ok) {
      return {
        status: 'written',
        memories: normalizeBreakReply(generated.data, ask.breakInput)
      }
    }

    console.warn('[break] the memory call failed:', generated.error)
    const retried = await retrySilently('break:memories', generated.error, spent, {
      onSleep: (cancel) => sleepers.push(cancel)
    })
    if (run !== mine) return { status: 'cancelled' }
    if (!retried) return { status: 'failed', error: generated.error }
    spent += 1
  }
}

/** Abandons the call in flight: the player left the screen, or answered its failure with no. */
export function cancelBreakCall(): void {
  run = null
  const waking = sleepers
  sleepers = []
  for (const wake of waking) wake()
  void window.api.jobs.cancelGroup(BREAK_LLM_GROUP)
}
