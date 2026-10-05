/**
 * A slot of the break spent on himself: the well he says what he will do in, and once it has
 * been written how it went and what it did for his stats. Saying what he does is what spends
 * the slot, so the panel can be opened and left before that.
 */
import { useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'

import {
  STAT_KEYS,
  STAT_LABELS,
  statsLowestFirst,
  type PlayerStats
} from '@shared/playerStats'
import type { Season } from '@shared/term'
import { aloneGains, type BreakAlone } from '@shared/termBreak'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import { breakStatAction } from '../prompts/breakStatActions'
import { useAudioStore } from '../stores/audioStore'
import type { ScreenTheme } from './clockTheme'
import {
  dealt,
  dealtItem,
  dealtItemDead,
  gestures,
  lift,
  panelUnderTab,
  press,
  quietLift,
  quietPress,
  spin,
  veilIn
} from './motion'
import '../vu_styles/Break.css'

export interface BreakAloneModalProps {
  /** The screen's own theme — a portal inherits no palette. */
  theme: ScreenTheme
  /** The week of the break the slot falls in. */
  week: number
  /** The slot that would be spent, which is what its suggestions are dealt by. */
  slot: number
  /** The season of the semester the break follows. */
  ended: Season
  /** His stats as they stand: the suggestions lead with his weakest. */
  stats: PlayerStats
  /** The slot as it was spent, once it has been; absent while he is still saying what he will do. */
  spent: BreakAlone | null
  /** Whether the call that writes it is out. */
  writing: boolean
  /** What he does with the slot, which is what spends it. */
  onStart: (action: string) => void
  /** Puts the panel away: before the slot is spent, or once it has been read. */
  onClose: () => void
}

const SUGGESTIONS_IN = dealt(0.1, 0.05)

/** Milliseconds per character of the typewriter, the scene box's own pace. */
const REVEAL_MS = 18

/** How many of those ticks pass between one line and the next. */
const LINE_BEAT = 18

/** What has a sound as it is typed: a letter or a digit, and nothing a space or a mark says. */
const VOICED = /[\p{L}\p{N}]/u

/** A suggestion with the stat it exercises drawn in that stat's own hue. */
function IdeaWords({ text }: { text: string }): JSX.Element {
  const key = STAT_KEYS.find((stat) => text.includes(STAT_LABELS[stat]))
  if (!key) return <>{text}</>
  const at = text.indexOf(STAT_LABELS[key])
  return (
    <>
      {text.slice(0, at)}
      <b style={{ '--stat': `var(--vu-stat-${key})` } as CSSProperties}>{STAT_LABELS[key]}</b>
      {text.slice(at + STAT_LABELS[key].length)}
    </>
  )
}

export function BreakAloneModal({
  theme,
  week,
  slot,
  ended,
  stats,
  spent,
  writing,
  onStart,
  onClose
}: BreakAloneModalProps): JSX.Element | null {
  const [text, setText] = useState('')
  const { host, overlayProps } = useModalShell(() => {
    if (!writing) onClose()
  })
  const canStart = !writing && spent === null && text.trim() !== ''

  // What it did for him, in the lines a scene's ending gives the same thing.
  const gains = spent ? aloneGains(spent.exercised).lines : []

  // How it went is typed out as a scene's narration is: a letter at a time under the narrator's
  // blip, a beat between lines, and a click to have the rest at once. A slot that was already
  // written when the panel opened is shown whole.
  const lines = spent?.lines ?? []
  const starts: number[] = []
  let total = 0
  for (const line of lines) {
    starts.push(total)
    total += line.length + LINE_BEAT
  }
  const [typed, setTyped] = useState(spent ? total : 0)
  const typing = spent !== null && typed < total
  useEffect(() => {
    if (!typing) return
    const timer = setInterval(() => setTyped((count) => count + 1), REVEAL_MS)
    return () => clearInterval(timer)
  }, [typing])

  // The voice under the typewriter: a blip on every third letter or digit, as the box gives.
  const typedBefore = useRef(typed)
  useEffect(() => {
    const before = typedBefore.current
    typedBefore.current = typed
    if (typed !== before + 1) return
    const at = starts.findLastIndex((start) => start < typed)
    const line = lines[at]
    const within = typed - (starts[at] ?? 0)
    if (!line || within > line.length || !VOICED.test(line[within - 1] ?? '')) return
    let voiced = 0
    for (const character of line.slice(0, within)) if (VOICED.test(character)) voiced += 1
    if (voiced % 3 === 0) useAudioStore.getState().play('narrator')
    // The lines and their starts are the slot's own and do not change under a count.
  }, [typed])

  // What it did for him arrives once the telling is over, with the sting it has in a scene.
  const told = spent !== null && !typing
  const stung = useRef(spent !== null)
  const gained = gains.length > 0
  useEffect(() => {
    if (!told || stung.current) return
    stung.current = true
    if (gained) useAudioStore.getState().play('positive')
  }, [told, gained])

  /** Spends the slot on what the well holds. */
  function start(): void {
    if (canStart) onStart(text)
  }

  // One thing to do per stat, his weakest first, as the semester's own row deals them.
  const suggestions = statsLowestFirst(stats).map((stat) => breakStatAction(stat, slot, ended))

  if (!host) return null

  return createPortal(
    <motion.div
      className="vu-veil"
      data-theme={theme}
      variants={veilIn}
      initial="hidden"
      animate="shown"
      exit="gone"
      {...overlayProps}
    >
      <motion.form
        id="break-alone"
        className="vu-breaktalk vu-breakalone vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label="Time to yourself"
        variants={panelUnderTab}
        // A form, so Enter in the well is the answer the foot gives.
        onSubmit={(event) => {
          event.preventDefault()
          start()
        }}
        // And the screen behind this never sees that key.
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.stopPropagation()
        }}
      >
        <TitleTab>Time to yourself</TitleTab>

        <span className="vu-breaktalk-count">Week {week}</span>

        {spent ? (
          // A click anywhere on the telling lands the rest of it, as one does on the box.
          <div className="vu-breakalone-told" onClick={() => setTyped(total)}>
            {spent.lines.map((line, index) => {
              const shown = Math.max(0, Math.min(line.length, typed - (starts[index] ?? 0)))
              return (
                <p key={index} className="vu-note-text">
                  {line.slice(0, shown)}
                  {/* The words not yet typed hold their room, so nothing below them moves. */}
                  <span className="vu-breakalone-untyped">{line.slice(shown)}</span>
                </p>
              )
            })}
            {told && (
              <ul className="vu-breaktalk-came">
                {gains.map((gain, index) => (
                  <li key={index} className="vu-note-text">
                    {gain.text}
                  </li>
                ))}
                {gains.length === 0 && (
                  <li className="vu-note-text">None of it did much for your stats.</li>
                )}
              </ul>
            )}
          </div>
        ) : (
          <>
            <motion.ul
              className="vu-breakalone-ideas"
              variants={SUGGESTIONS_IN}
              initial="hidden"
              animate="shown"
            >
              {suggestions.map((idea) => (
                <motion.li key={idea} variants={writing ? dealtItemDead : dealtItem}>
                  <motion.button
                    type="button"
                    className="vu-breakalone-idea"
                    disabled={writing}
                    {...gestures(writing, quietLift, quietPress)}
                    onClick={() => onStart(idea)}
                  >
                    <IdeaWords text={idea} />
                  </motion.button>
                </motion.li>
              ))}
            </motion.ul>
            <label className="vu-field">
              <input
                id="break-alone-text"
                className="vu-input"
                aria-label="What you do with the slot"
                placeholder="What do you do?"
                value={text}
                disabled={writing}
                autoFocus
                onChange={(event) => setText(event.target.value)}
              />
            </label>
            {writing && (
              <span className="vu-breaktalk-wait">
                <motion.span className="vu-ring" animate={spin} />
                Writing it
              </span>
            )}
          </>
        )}

        <div className="vu-foot">
          {spent ? (
            <motion.button
              id="break-alone-close"
              type="button"
              className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
              {...gestures(false, lift, press)}
              onClick={onClose}
            >
              Close
            </motion.button>
          ) : (
            <>
              <motion.button
                id="break-alone-cancel"
                type="button"
                className="vu-btn vu-btn--outline vu-btn--panel vu-paper"
                {...gestures(writing, lift, press)}
                disabled={writing}
                onClick={onClose}
              >
                Cancel
              </motion.button>
              <motion.button
                id="break-alone-start"
                type="submit"
                className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
                {...gestures(!canStart, lift, press)}
                disabled={!canStart}
              >
                Go
              </motion.button>
            </>
          )}
        </div>
      </motion.form>
    </motion.div>,
    host
  )
}
