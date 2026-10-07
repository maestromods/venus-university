import {
  VENUS_WHISPER_MOD, WHISPER_COMMENTS, WHISPER_TEXT, ensureWhisperAuthor, whisperAddressees, whisperCommenters,
  whisperIssueId, whisperMentions, whisperPeople, whisperPlayerHandle, whisperSources, validateWhisperComments,
  validateWhisperDraft, withWhisperIssue, type VenusWhisper, type WhisperComment, type WhisperIssue
} from '@shared/venusWhisper'
import { fullNameOf } from '@shared/types'
import { create } from 'zustand'
import { anonymousVoice, buildWhisperIssue, buildWhisperReplies } from '../prompts/venusWhisperPrompt'
import { useGameStore } from './gameStore'
import { modIsOn } from './modsStore'
import { manualSaveOffer, writeWhisper } from './loop/saves'

/** A reopened viewer observes an older request finishing or cancelling. */
export const useWhisperActivity = create<{ working: boolean }>(() => ({ working: false }))

/** Read-only browsing stays available; publication waits for a stable scene or landing. */
export function whisperReady(): boolean {
  const game = useGameStore.getState()
  return !useWhisperActivity.getState().working && modIsOn(VENUS_WHISPER_MOD) && !game.sceneEnding && manualSaveOffer() === 'open'
}

/** Every request and save remains attached to the exact stay, clock, and open viewer that began it. */
async function operation<T>(active: () => boolean, run: (commit: (next: VenusWhisper) => Promise<void>, current: () => boolean) => Promise<T>): Promise<T> {
  if (!whisperReady()) throw Error('Wait until the current scene or messages have settled.')
  const start = useGameStore.getState()
  const current = (): boolean => {
    const now = useGameStore.getState()
    return active() && modIsOn(VENUS_WHISPER_MOD) && now.playthroughId === start.playthroughId && now.loads === start.loads &&
      now.date === start.date && now.time === start.time && !now.sceneEnding
  }
  const commit = async (next: VenusWhisper): Promise<void> => {
    if (!current()) throw Error('The game changed. Reopen the newsletter.')
    await writeWhisper(next, useGameStore.getState().exVenusWhisper, current)
  }
  useWhisperActivity.setState({ working: true })
  try { return await run(commit, current) } finally { useWhisperActivity.setState({ working: false }) }
}

/** Author selection is saved before the first paid call, so failures and retries never reroll her. */
export async function publishWhisper(group: string, active: () => boolean): Promise<string> {
  return operation(active, async (commit, current) => {
    let game = useGameStore.getState()
    const id = whisperIssueId(game.termIndex, game.date)
    if (game.exVenusWhisper.issues.some(i => i.id === id) || game.exVenusWhisper.dismissed.includes(id)) return id
    await commit(ensureWhisperAuthor(game, Math.random))
    game = useGameStore.getState()
    const sources = whisperSources(game), author = game.exVenusWhisper.author!
    const voice = anonymousVoice(author.voice, [author.name, ...Object.values(game.characters).map(fullNameOf)])
    const response = await window.api.llm.completeWhisper(buildWhisperIssue(sources, voice), group)
    if (!current()) throw Error('The game changed. No issue was published.')
    if (!response.ok) throw Error(response.error.message)
    const draft = validateWhisperDraft(response.data, sources, [])
    const issue: WhisperIssue = { id, term: game.termIndex, day: game.date, title: draft.title, body: draft.body,
      subjects: [...new Set(sources.filter(s => draft.sources.includes(s.id)).flatMap(s => s.subjects))], comments: [], answered: [] }
    await commit(withWhisperIssue(useGameStore.getState().exVenusWhisper, issue))
    return id
  })
}

/** File the reader's words before generating a reply; a failed writer leaves them retryable. */
export async function commentOnWhisper(issueId: string, value: string, replyTo: string | undefined, active: () => boolean): Promise<string> {
  return operation(active, async commit => {
    const game = useGameStore.getState(), state = game.exVenusWhisper
    const issue = state.issues.find(i => i.id === issueId)
    if (!issue || issue.term !== game.termIndex || issue.day < game.date - 1 || issue.day > game.date) throw Error('This issue is archived. Join a current discussion instead.')
    if (!value.trim() || value.length > WHISPER_TEXT) throw Error(`Write a comment of 1–${WHISPER_TEXT} characters.`)
    if (issue.comments.length >= WHISPER_COMMENTS - 3) throw Error('This discussion is full.')
    if (replyTo && !issue.comments.some(c => c.id === replyTo)) throw Error('That comment is no longer available.')
    const id = crypto.randomUUID()
    const comment: WhisperComment = { id, person: { id: 'reader', name: [game.playerFirstName, game.playerLastName].filter(Boolean).join(' ') || 'Reader', handle: whisperPlayerHandle(game.playerFirstName, game.playerLastName) }, player: true,
      text: value.trim(), mentions: whisperMentions(value, whisperPeople(game)), ...(replyTo ? { replyTo } : {}) }
    await commit(withWhisperIssue(state, { ...issue, comments: [...issue.comments, comment] }))
    return id
  })
}

/** One bounded reply batch; the secret author uses exactly the same prompt as the other readers. */
export async function replyOnWhisper(issueId: string, replyTo: string | undefined, group: string, active: () => boolean): Promise<string[]> {
  return operation(active, async (commit, current) => {
    const game = useGameStore.getState(), state = game.exVenusWhisper, issue = state.issues.find(i => i.id === issueId)
    if (!issue || issue.term !== game.termIndex || issue.day < game.date - 1 || issue.day > game.date) throw Error('This issue is archived.')
    const target = issue.comments.find(c => c.id === replyTo)
    if (replyTo && (!target?.player || issue.answered.includes(replyTo))) return []
    if (!replyTo && issue.comments.some(c => !c.player)) return []
    const addressees = whisperAddressees(issue, replyTo, whisperPeople(game))
    const priority = addressees.map(p => p.id)
    const people = whisperCommenters(game, Math.random, priority, Math.min(WHISPER_COMMENTS - issue.comments.length, replyTo ? (Math.random() < .35 ? 3 : 1) : 3))
    if (!people.length) return []
    const response = await window.api.llm.completeWhisper(buildWhisperReplies(issue, people, replyTo, whisperPlayerHandle(game.playerFirstName, game.playerLastName), addressees), group)
    if (!current()) throw Error('The game changed. No replies were added.')
    if (!response.ok) throw Error(response.error.message)
    const batch = validateWhisperComments(response.data, people).map(c => {
      const p = people.find(p => p.id === c.speaker)!
      return { id: crypto.randomUUID(), person: { id: p.id, name: p.name, handle: p.handle }, player: false,
        text: c.text, mentions: whisperMentions(c.text, whisperPeople(game)), ...(replyTo ? { replyTo } : {}) }
    })
    await commit(withWhisperIssue(state, { ...issue, comments: [...issue.comments, ...batch], answered: [...issue.answered, ...(replyTo ? [replyTo] : [])] }))
    return batch.map(c => c.id)
  })
}

/** A removed issue stays removed for its publication day, including after a reload or new term. */
export async function dismissWhisper(issueId: string, active: () => boolean): Promise<void> {
  await operation(active, async commit => {
    const state = useGameStore.getState().exVenusWhisper
    await commit({ ...state, issues: state.issues.filter(i => i.id !== issueId), dismissed: [...state.dismissed, issueId] })
  })
}
