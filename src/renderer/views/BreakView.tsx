/**
 * The break between two semesters, played a slot at a time between a finished semester's ending
 * and the roster of the next one: its clock, the reader as the break has left him, whoever is
 * coming back, and the way on. A slot goes on a conversation with one of them or is let go by.
 * Skipped or played out, the break closes on what each of them remembers of it, which the
 * player may reword before choosing the roster.
 */
import { useEffect, useRef, useState, type JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'

import { appError } from '@shared/errors'
import { STAT_KEYS, STAT_LABELS, tierName } from '@shared/playerStats'
import { seasonOf, seasonWords, termIndexOf } from '@shared/term'
import {
  breakClock,
  breakOver,
  breakSlots,
  breakSpent,
  breakWeeks,
  BREAK_SLOTS_PER_WEEK,
  openBreak,
  openTalk,
  playedMemories,
  replyOwed,
  withBreakClosed,
  withPlayerLine,
  withReply,
  withSlotSpent,
  withTalkJudged,
  withTalkLeft,
  withTalkStarted,
  type BreakDraft,
  type BreakTalk
} from '@shared/termBreak'
import type { BreakMemory } from '@shared/termCarry'
import type { AppError, Character } from '@shared/types'
import { CardCaption } from '../components/CardCaption'
import { ConfirmModal } from '../components/ConfirmModal'
import { LlmFailureModal } from '../components/LlmFailureModal'
import { spriteUrl } from '../stores/characterStore'
import {
  clearStagedContinuation,
  stageContinuation,
  stagedContinuation
} from '../stores/newGame'
import {
  breakCast,
  breakStandings,
  cancelBreakCall,
  canText,
  judgeTalk,
  replyToTalk,
  writeBreakCards,
  writeBreakMemories
} from '../stores/termBreak'
import { useUiStore } from '../stores/uiStore'
import { BreakMemoriesModal } from './BreakMemoriesModal'
import { BreakTalkModal, type TalkPhase } from './BreakTalkModal'
import { heldScreenTheme } from './clockTheme'
import {
  cardLift,
  dealt,
  dealtItem,
  decorIn,
  fadeIn,
  FILL,
  gestures,
  hovered,
  lift,
  press,
  quietLift,
  quietPress,
  spin
} from './motion'
import { BackIcon, ChevronIcon } from './screenIcons'
import '../vu_styles/Break.css'

const HEADER_IN = fadeIn(0.1)
const READER_IN = fadeIn(0.2)
const GRID_IN = dealt(0.25, 0.04)
const FOOT_IN = fadeIn(0.5)

/** `"Summer vacation"` — a sentence's words for the break, as a title wears them. */
function titled(words: string): string {
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** A call that failed, and what answering its modal with Retry does. */
interface Failure {
  error: AppError
  title: string
  retry: () => void
}

export function BreakView(): JSX.Element | null {
  const setView = useUiStore((s) => s.setView)
  const showError = useUiStore((s) => s.showError)
  const [theme] = useState(heldScreenTheme)

  // The finished semester this break follows, taken once at mount and dropped by the effect
  // below; the roster screen is handed it again on the way out.
  const [from] = useState(stagedContinuation)
  useEffect(() => {
    clearStagedContinuation()
  }, [])

  // The break as it stands: null until whatever was already on disk has been read.
  const [draft, setDraft] = useState<BreakDraft | null>(null)
  // The memory call of a skipped break is out.
  const [writing, setWriting] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [confirmingSkip, setConfirmingSkip] = useState(false)
  const [editing, setEditing] = useState(false)
  // Whose conversation panel is up, and what it is waiting on.
  const [talking, setTalking] = useState<string | null>(null)
  const [phase, setPhase] = useState<TalkPhase>('idle')
  // The conversation the panel goes on showing once it has been judged, until it is closed.
  const [shown, setShown] = useState<BreakTalk | null>(null)

  // What a resumed break owes its open conversation, picked up once after the read.
  const resumed = useRef(false)

  useEffect(() => {
    if (!from) {
      setView('mainMenu')
      return
    }
    let live = true
    void (async () => {
      const read = await window.api.saves.break(from.playthroughId)
      if (!live) return
      if (!read.ok) showError(read.error)
      // The break is the semester's: one already under way is resumed whichever save was picked.
      const stored = read.ok ? read.data : null
      if (stored) {
        const { schemaVersion: _schemaVersion, savedAt: _savedAt, ...kept } = stored
        setDraft(kept)
      } else {
        setDraft(openBreak(from.save))
      }
    })()
    return () => {
      live = false
    }
  }, [from, setView, showError])

  // Unmounting abandons the call with it.
  useEffect(() => cancelBreakCall, [])

  // A break left in the middle of a conversation comes back onto it, and onto whatever call
  // it was waiting for.
  useEffect(() => {
    if (!draft || resumed.current) return
    resumed.current = true
    const talk = openTalk(draft)
    if (!talk) return
    setTalking(talk.charId)
    if (replyOwed(talk)) void answer(draft)
    else if (talk.ended) void judge(draft)
    // Once, on the break as it was read: the ref above is what holds it to that.
  }, [draft])

  if (!from) return null

  const ended = seasonOf(termIndexOf(from.record))
  const words = seasonWords(ended)
  const cast = breakCast(from)
  const nameKnown = Object.fromEntries(
    cast.map((c) => [c.charId, from.save.charInfo[c.charId]?.nameKnown === true])
  )
  // A face is drawn only for somebody whose name he has learned.
  const faces = cast.filter((c) => nameKnown[c.charId])

  const over = draft !== null && breakOver(draft)
  const spent = draft !== null && breakSpent(draft, ended)
  const clock = draft ? breakClock(draft.spent.length, ended) : null
  const share = draft ? Math.round((draft.spent.length / breakSlots(ended)) * 100) : 0
  const underWay = draft !== null && openTalk(draft) !== null
  const dead = draft === null || writing || underWay
  const played = draft !== null && draft.talks.length > 0

  /** Puts the break as it stands on screen and on disk; a refused write is reported and play goes on. */
  async function keep(next: BreakDraft): Promise<void> {
    setDraft(next)
    if (!from) return
    const written = await window.api.saves.writeBreak(from.playthroughId, next)
    if (!written.ok) showError(written.error)
  }

  /** Closes a break nobody played on memories written for it, and opens them to be reworded. */
  async function writeUnplayed(base: BreakDraft): Promise<void> {
    if (!from) return
    setWriting(true)
    const outcome = await writeBreakMemories(from)
    setWriting(false)
    if (outcome.status === 'cancelled') return
    if (outcome.status === 'failed') {
      setFailure({
        error: outcome.error,
        title: "Couldn't write the break",
        retry: () => void writeUnplayed(base)
      })
      return
    }
    await keep(withBreakClosed(base, outcome.data))
    if (cast.length > 0) setEditing(true)
  }

  /** Closes a played break on what happened in it, and opens those memories to be reworded. */
  async function closePlayed(base: BreakDraft): Promise<void> {
    if (!from) return
    // Somebody he had no way of writing to cannot mind not having heard from him.
    const standings = Object.fromEntries(
      Object.entries(breakStandings(from)).map(([charId, standing]) => [
        charId,
        canText(from, charId) ? standing : { disposition: 'neutral' as const, lover: false }
      ])
    )
    await keep(withBreakClosed(base, playedMemories(base, standings, ended)))
    if (cast.length > 0) setEditing(true)
  }

  /** Ends the break where it stands: by what happened in it, or written for him where nothing did. */
  function finish(base: BreakDraft): void {
    if (base.talks.length > 0 || breakSpent(base, ended)) void closePlayed(base)
    else void writeUnplayed(base)
  }

  /** Lets the slot go by, and closes the break when it was the last one. */
  function rest(): void {
    if (!draft || dead) return
    const next = withSlotSpent(draft, ended)
    if (breakSpent(next, ended)) void keep(next).then(() => closePlayed(next))
    else void keep(next)
  }

  /** Asks for her reply to his newest text, and for the judgement where that reply ended it. */
  async function answer(base: BreakDraft): Promise<void> {
    if (!from) return
    setPhase('replying')
    const outcome = await replyToTalk(from, base)
    if (outcome.status === 'cancelled') return
    const said =
      outcome.status === 'done' && outcome.data.messages.some((text) => text.trim() !== '')
    if (outcome.status === 'failed' || !said) {
      setPhase('idle')
      setFailure({
        error:
          outcome.status === 'failed'
            ? outcome.error
            : appError('LLM_EMPTY', 'Her reply came back empty.'),
        title: "Couldn't send the text",
        retry: () => void answer(base)
      })
      return
    }
    const next = withReply(base, outcome.data.messages, outcome.data.leaving)
    await keep(next)
    if (openTalk(next)?.ended) await judge(next)
    else setPhase('idle')
  }

  /** Asks what the conversation that has just ended came to, which is what closes it. */
  async function judge(base: BreakDraft): Promise<void> {
    if (!from) return
    setPhase('judging')
    const outcome = await judgeTalk(from, base)
    if (outcome.status === 'cancelled') return
    setPhase('idle')
    if (outcome.status === 'failed') {
      setFailure({
        error: outcome.error,
        title: "Couldn't end the conversation",
        retry: () => void judge(base)
      })
      return
    }
    const next = withTalkJudged(base, outcome.data)
    setShown(next.talks[next.talks.length - 1] ?? null)
    await keep(next)
  }

  /**
   * His next text to whoever the panel is up for. The first one of a break asks for everybody's
   * cards before anything is spent, and the first one of a conversation spends the slot.
   */
  async function send(charId: string, text: string): Promise<void> {
    if (!from || !draft) return
    if (openTalk(draft)) {
      const next = withPlayerLine(draft, text)
      if (next === draft) return
      await keep(next)
      await answer(next)
      return
    }

    let base = draft
    if (!base.cards?.[charId]) {
      setPhase('replying')
      const outcome = await writeBreakCards(from)
      if (outcome.status === 'cancelled') return
      if (outcome.status === 'failed' || !outcome.data[charId]) {
        setPhase('idle')
        setFailure({
          error:
            outcome.status === 'failed'
              ? outcome.error
              : appError('LLM_MALFORMED', 'The break came back without her in it.'),
          title: "Couldn't send the text",
          retry: () => void send(charId, text)
        })
        return
      }
      base = { ...base, cards: { ...base.cards, ...outcome.data } }
    }
    const next = withTalkStarted(base, charId, text, ended)
    await keep(next)
    if (openTalk(next)) await answer(next)
    else setPhase('idle')
  }

  /** Ends the open conversation himself, and has it judged. */
  function leave(): void {
    if (!draft) return
    const next = withTalkLeft(draft)
    if (next === draft) return
    void keep(next).then(() => judge(next))
  }

  /** Puts the conversation panel away, and closes the break where that was its last slot. */
  function closeTalk(): void {
    setTalking(null)
    setShown(null)
    if (draft && !breakOver(draft) && !openTalk(draft) && breakSpent(draft, ended)) {
      void closePlayed(draft)
    }
  }

  /** The reworded memories, kept. */
  function saveMemories(memories: Record<string, BreakMemory[]>): void {
    setEditing(false)
    if (!draft) return
    void keep(withBreakClosed(draft, memories))
  }

  /** On to the roster of the next semester, handing it how the break went. */
  function toRoster(): void {
    if (!from || !draft?.memories) return
    stageContinuation({
      ...from,
      played: {
        stats: draft.stats,
        memories: draft.memories,
        talks: draft.talks.filter((talk) => talk.verdict !== undefined)
      }
    })
    setView('newGame')
  }

  const talkingTo = talking ? cast.find((c) => c.charId === talking) : undefined
  const open = draft ? openTalk(draft) : null
  const panelTalk = open ?? shown

  return (
    <div className="vu-break" data-theme={theme}>
      {/* The screen's idle: the arch arrives and then breathes, both on the one variant. */}
      <motion.div className="vu-break-decor" variants={decorIn} initial="hidden" animate="shown" />

      <motion.header
        className="vu-break-header"
        variants={HEADER_IN}
        initial="hidden"
        animate="shown"
      >
        <motion.button
          className="vu-circle vu-break-back"
          aria-label="Main Menu"
          {...gestures(false, quietLift, quietPress)}
          onClick={() => setView('mainMenu')}
        >
          <BackIcon />
        </motion.button>

        <div className="vu-title">
          <h1 className="vu-title-text">{titled(words.endBreak)}</h1>
        </div>

        {clock && (
          <span className="vu-break-clock">
            {over
              ? 'Over'
              : `Week ${clock.week} of ${breakWeeks(ended)} · slot ${clock.slot} of ${BREAK_SLOTS_PER_WEEK}`}
          </span>
        )}
      </motion.header>

      <motion.section
        className="vu-break-reader"
        variants={READER_IN}
        initial="hidden"
        animate="shown"
      >
        <span className="vu-track vu-break-track" aria-hidden="true">
          <motion.span
            className="vu-bar"
            initial={false}
            animate={{ width: `${over ? 100 : share}%` }}
            transition={FILL}
          />
        </span>
        {draft && (
          <ul className="vu-break-stats">
            {STAT_KEYS.map((key) => (
              <li key={key} className="vu-chip vu-paper">
                {STAT_LABELS[key]} · {tierName(draft.stats[key])}
              </li>
            ))}
          </ul>
        )}
      </motion.section>

      {faces.length > 0 ? (
        <>
          {!over && <p className="vu-hint vu-break-hint">Click somebody to text her.</p>}
          <motion.ul className="vu-break-grid" variants={GRID_IN} initial="hidden" animate="shown">
            {faces.map((character) => (
              <BreakFace
                key={character.charId}
                character={character}
                texted={draft?.talks.filter((talk) => talk.charId === character.charId).length ?? 0}
                // A girl he cannot reach, and anybody once the slots are gone, is only a face.
                opens={!over && !spent && !dead && canText(from, character.charId)}
                onOpen={() => setTalking(character.charId)}
              />
            ))}
          </motion.ul>
        </>
      ) : (
        <p className="vu-empty vu-break-empty">Nobody he knows by name is coming back.</p>
      )}

      <motion.footer className="vu-break-foot" variants={FOOT_IN} initial="hidden" animate="shown">
        {writing && (
          <span className="vu-break-writing">
            <motion.span className="vu-ring" animate={spin} />
            Writing the break
          </span>
        )}

        <div className="vu-foot">
          {over ? (
            <>
              {cast.length > 0 && (
                <motion.button
                  id="break-edit-memories"
                  className="vu-btn vu-btn--outline vu-btn--panel vu-paper"
                  {...gestures(false, lift, press)}
                  onClick={() => setEditing(true)}
                >
                  Edit memories
                </motion.button>
              )}
              <motion.button
                id="break-to-roster"
                className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
                {...gestures(false, lift, press)}
                onClick={toRoster}
              >
                Choose the roster
                <ChevronIcon />
              </motion.button>
            </>
          ) : spent ? (
            <motion.button
              id="break-finish"
              className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
              {...gestures(dead, lift, press)}
              disabled={dead}
              onClick={() => draft && finish(draft)}
            >
              Finish the break
            </motion.button>
          ) : (
            <>
              <motion.button
                id="break-skip"
                className="vu-btn vu-btn--outline vu-btn--panel vu-paper"
                {...gestures(dead, lift, press)}
                disabled={dead}
                onClick={() => setConfirmingSkip(true)}
              >
                {played ? 'End the break here' : 'Skip the break'}
              </motion.button>
              <motion.button
                id="break-rest"
                className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
                {...gestures(dead, lift, press)}
                disabled={dead}
                onClick={rest}
              >
                Let the slot pass
              </motion.button>
            </>
          )}
        </div>
      </motion.footer>

      <AnimatePresence>
        {confirmingSkip && (
          <ConfirmModal
            key="skip"
            id="break-skip-confirm"
            theme={theme}
            title={played ? 'End the break here?' : 'Skip the break?'}
            message={
              played
                ? `The rest of ${words.endBreakSpan} goes by without another word from you. Anybody close to you that you never wrote to will remember it, and so will anybody you promised something and did not come back to.`
                : `The rest of ${words.endBreakSpan} goes by without you, and what everybody remembers of it is written for you. You can reword it before the semester starts.`
            }
            confirmText={played ? 'End the break here' : 'Skip the break'}
            cancelText="Cancel"
            onConfirm={() => {
              setConfirmingSkip(false)
              if (draft) finish(draft)
            }}
            onCancel={() => setConfirmingSkip(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {talkingTo && draft && !failure && (
          <BreakTalkModal
            key="talk"
            theme={theme}
            character={talkingTo}
            week={breakClock(panelTalk?.slot ?? draft.spent.length, ended).week}
            talk={panelTalk?.charId === talkingTo.charId ? panelTalk : null}
            phase={phase}
            onSend={(text) => void send(talkingTo.charId, text)}
            onLeave={leave}
            onClose={closeTalk}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {failure && (
          <LlmFailureModal
            key="failure"
            id="break-failure"
            theme={theme}
            error={failure.error}
            title={failure.title}
            retryMessage="Retry sends the same request."
            cancelText="Cancel"
            onRetry={() => {
              const { retry } = failure
              setFailure(null)
              retry()
            }}
            onAbandon={() => setFailure(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editing && draft?.memories && (
          <BreakMemoriesModal
            key="memories"
            theme={theme}
            cast={cast}
            nameKnown={nameKnown}
            memories={draft.memories}
            onSave={saveMemories}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/** One girl who is coming back: her archway and her name, and how often he has written to her. */
function BreakFace({
  character,
  texted,
  opens,
  onOpen
}: {
  character: Character
  texted: number
  opens: boolean
  onOpen: () => void
}): JSX.Element {
  const face = (
    <>
      <div className="vu-arch vu-break-arch vu-paper">
        <div className="vu-crop vu-card-crop">
          <img className="vu-card-sprite" src={spriteUrl(character.charId, 'neutral')} alt="" />
        </div>
      </div>
      <CardCaption character={character} />
    </>
  )

  return (
    <motion.li className="vu-card" variants={dealtItem} {...hovered(!opens, cardLift)}>
      {opens ? (
        <motion.button className="vu-card-face" whileTap={press} onClick={onOpen}>
          {face}
        </motion.button>
      ) : (
        <div className="vu-card-face">{face}</div>
      )}
      {texted > 0 && (
        <span className="vu-sticker vu-break-texted">
          {texted === 1 ? 'Texted' : `Texted ${texted}`}
        </span>
      )}
    </motion.li>
  )
}
