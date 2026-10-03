/**
 * The break between two semesters, played a slot at a time between a finished semester's ending
 * and the roster of the next one: its clock, the reader as the break has left him, whoever is
 * coming back, and the way on. Skipped or played out, it closes on what each of them remembers
 * of it, which the player may reword before choosing the roster.
 */
import { useEffect, useState, type JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'

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
  withBreakClosed,
  withSlotSpent,
  type BreakDraft
} from '@shared/termBreak'
import type { BreakMemory } from '@shared/termCarry'
import type { AppError } from '@shared/types'
import { CardCaption } from '../components/CardCaption'
import { ConfirmModal } from '../components/ConfirmModal'
import { LlmFailureModal } from '../components/LlmFailureModal'
import { spriteUrl } from '../stores/characterStore'
import {
  clearStagedContinuation,
  stageContinuation,
  stagedContinuation
} from '../stores/newGame'
import { breakCast, cancelBreakCall, writeBreakMemories } from '../stores/termBreak'
import { useUiStore } from '../stores/uiStore'
import { BreakMemoriesModal } from './BreakMemoriesModal'
import { heldScreenTheme } from './clockTheme'
import {
  dealt,
  dealtItem,
  decorIn,
  fadeIn,
  FILL,
  gestures,
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
  // The memory call is out.
  const [writing, setWriting] = useState(false)
  const [failure, setFailure] = useState<AppError | null>(null)
  const [confirmingSkip, setConfirmingSkip] = useState(false)
  const [editing, setEditing] = useState(false)

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
        const { schemaVersion: _schemaVersion, savedAt: _savedAt, ...resumed } = stored
        setDraft(resumed)
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
  const dead = draft === null || writing

  /** Puts the break as it stands on disk; a refused write is reported and play goes on. */
  async function persist(next: BreakDraft): Promise<void> {
    if (!from) return
    const written = await window.api.saves.writeBreak(from.playthroughId, next)
    if (!written.ok) showError(written.error)
  }

  /** Closes the break on what everybody remembers of it, and opens those memories to be reworded. */
  async function close(base: BreakDraft): Promise<void> {
    if (!from) return
    setWriting(true)
    const outcome = await writeBreakMemories(from)
    setWriting(false)
    if (outcome.status === 'cancelled') return
    if (outcome.status === 'failed') {
      setFailure(outcome.error)
      return
    }
    const closed = withBreakClosed(base, outcome.memories)
    setDraft(closed)
    await persist(closed)
    if (cast.length > 0) setEditing(true)
  }

  /** Lets the slot go by, and closes the break when it was the last one. */
  function rest(): void {
    if (!draft || dead) return
    const next = withSlotSpent(draft, { kind: 'rest' }, ended)
    setDraft(next)
    if (breakSpent(next, ended)) void persist(next).then(() => close(next))
    else void persist(next)
  }

  /** The reworded memories, kept. */
  function saveMemories(memories: Record<string, BreakMemory[]>): void {
    setEditing(false)
    if (!draft) return
    const next = withBreakClosed(draft, memories)
    setDraft(next)
    void persist(next)
  }

  /** On to the roster of the next semester, handing it how the break went. */
  function toRoster(): void {
    if (!from || !draft?.memories) return
    stageContinuation({ ...from, played: { stats: draft.stats, memories: draft.memories } })
    setView('newGame')
  }

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
        <motion.ul className="vu-break-grid" variants={GRID_IN} initial="hidden" animate="shown">
          {faces.map((character) => (
            <motion.li key={character.charId} className="vu-card" variants={dealtItem}>
              <div className="vu-card-face">
                <div className="vu-arch vu-break-arch vu-paper">
                  <div className="vu-crop vu-card-crop">
                    <img
                      className="vu-card-sprite"
                      src={spriteUrl(character.charId, 'neutral')}
                      alt=""
                    />
                  </div>
                </div>
                <CardCaption character={character} />
              </div>
            </motion.li>
          ))}
        </motion.ul>
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
              onClick={() => draft && void close(draft)}
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
                Skip the break
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
            title="Skip the break?"
            message={`The rest of ${words.endBreakSpan} goes by without you, and what everybody remembers of it is written for you. You can reword it before the semester starts.`}
            confirmText="Skip the break"
            cancelText="Cancel"
            onConfirm={() => {
              setConfirmingSkip(false)
              if (draft) void close(draft)
            }}
            onCancel={() => setConfirmingSkip(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {failure && (
          <LlmFailureModal
            key="failure"
            id="break-failure"
            theme={theme}
            error={failure}
            title="Couldn't write the break"
            retryMessage="Retry sends the same request."
            cancelText="Cancel"
            onRetry={() => {
              setFailure(null)
              if (draft) void close(draft)
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
