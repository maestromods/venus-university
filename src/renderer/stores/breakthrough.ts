import { BREAKTHROUGH_MOD, normalizeBreakthrough, outcomeOf, settleBreakthrough, type BreakthroughPending } from '@shared/breakthrough'
import { fullNameOf, type Character, type SceneLine, type StructuredRequest } from '@shared/types'
import { breakthroughAdvantage } from '../prompts/breakthroughPrompt'
import { useGameStore } from './gameStore'
import { modIsOn } from './modsStore'
import { interjectOfferOf, replyRowOfferOf } from './loop/playback'

type Game = ReturnType<typeof useGameStore.getState>

export function breakthroughCast(game: Game): string[] {
  return game.cast.filter(id => !game.departed.includes(id) && game.characters[id])
}

export function canBreakthrough(game: Game, id: string): boolean {
  const offer = interjectOfferOf(game)
  const canReply = offer === 'open' || offer === 'none' && (replyRowOfferOf(game) === 'open' ||
    game.awaitingInput && !game.busy && game.pendingLines.length === 0)
  return modIsOn(BREAKTHROUGH_MOD) && !!game.playthroughId && canReply && !game.sceneQuiz &&
    !game.turnError && !game.statusShown && !game.statusModal && !game.activeGameOver &&
    !game.exBreakthrough.pending && breakthroughCast(game).includes(id) &&
    (game.currentSceneTranscript.length > 0 || game.sceneSummary !== null) && (game.exBreakthrough.meters[id] ?? 0) >= 100
}

/** The native interject function is injected, keeping this module independent of the loop façade. */
export function activateBreakthrough(id: string, direction: string, dispatch: (text: string) => boolean): void {
  const game = useGameStore.getState()
  if (!canBreakthrough(game,id)) throw Error('A full bar and an open reply window with this character are required.')
  if (!direction.trim() || direction.length > 1000) throw Error('Describe your action and hope in 1–1,000 characters.')
  const state = normalizeBreakthrough(game.exBreakthrough)
  const pending = { id:crypto.randomUUID(), charId:id, direction:direction.trim(),
    date:game.date, time:game.time, playthroughId:game.playthroughId! }
  state.meters[id] = 0
  state.pending = pending
  useGameStore.setState({ exBreakthrough:state })
  try {
    // No await before native interruption: it owns truncation, cancellation and the decision save.
    if (!dispatch(pending.direction)) throw Error('The reply window closed. Your spirit has been returned.')
    useGameStore.setState({ breakthroughFlash:{id:pending.id,playthroughId:pending.playthroughId,
      name:game.charInfo[id]?.nameKnown ? fullNameOf(game.characters[id]) : 'A shared moment'} })
  } catch (error) {
    finishBreakthrough(pending.id,true)
    throw error
  }
}

/** A token can finish or refund only its own activation, once. */
export function finishBreakthrough(token: string | undefined, refund: boolean, lines: readonly SceneLine[] = [], at = 0): void {
  const game = useGameStore.getState(), state = normalizeBreakthrough(game.exBreakthrough), pending = state.pending
  if (!pending || pending.id !== token || pending.playthroughId !== game.playthroughId) return
  const outcome = outcomeOf(lines)
  if (refund || !outcome) state.meters[pending.charId] = 100
  else state.moments[pending.charId] = [...(state.moments[pending.charId] ?? []),{
    id:pending.id, date:pending.date, time:pending.time, outcome,
    transcriptStart:at, transcriptCount:lines.length
  }].slice(-6)
  state.pending = null
  useGameStore.setState({ exBreakthrough:state, ...(refund ? {breakthroughFlash:null} : {}) })
}

/** A manual retry of a refunded turn spends the returned bar again; it never gets a free bonus. */
export function rearmBreakthrough(pending?: BreakthroughPending): void {
  const game = useGameStore.getState()
  if (!pending || pending.playthroughId !== game.playthroughId || pending.date !== game.date || pending.time !== game.time ||
    !canBreakthrough(game,pending.charId)) return
  const state = normalizeBreakthrough(game.exBreakthrough)
  state.meters[pending.charId] = 0
  state.pending = {...pending}
  useGameStore.setState({exBreakthrough:state})
}

export function withBreakthrough(request: StructuredRequest, cast: Character[], solo: boolean): StructuredRequest {
  const game = useGameStore.getState(), pending = game.exBreakthrough.pending
  if (!modIsOn(BREAKTHROUGH_MOD)) {
    if (pending) finishBreakthrough(pending.id,true)
    return request
  }
  const blocks = [request.user]
  if (pending) {
    const target = cast.find(c => c.charId === pending.charId)
    if (!target || solo || pending.playthroughId !== game.playthroughId || pending.date !== game.date || pending.time !== game.time)
      finishBreakthrough(pending.id,true)
    else blocks.push(breakthroughAdvantage(pending,target))
  }
  return { ...request, user:blocks.join('\n\n') }
}

export function settleSpirit(before: Game): void {
  const game = useGameStore.getState()
  if (!modIsOn(BREAKTHROUGH_MOD) || game.playthroughId !== before.playthroughId) return
  useGameStore.setState({exBreakthrough:settleBreakthrough(game.exBreakthrough,before.charInfo,game.charInfo,before.date,before.time)})
}
