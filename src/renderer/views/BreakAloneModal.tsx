/**
 * A slot of the break spent on himself: the suggestions and the well he says what he will do
 * in. Saying what he does is what spends the slot and puts the panel away for the telling, so
 * the panel can be opened and left before that.
 */
import { useState, type CSSProperties, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'

import {
  STAT_KEYS,
  STAT_LABELS,
  statsLowestFirst,
  type PlayerStats
} from '@shared/playerStats'
import type { Season } from '@shared/term'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import { breakStatAction } from '../prompts/breakStatActions'
import type { ScreenTheme } from './clockTheme'
import {
  dealt,
  dealtItem,
  gestures,
  lift,
  panelUnderTab,
  press,
  quietLift,
  quietPress,
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
  /** What he does with the slot, which is what spends it. */
  onStart: (action: string) => void
  /** Puts the panel away with the slot unspent. */
  onClose: () => void
}

const SUGGESTIONS_IN = dealt(0.1, 0.05)

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
  onStart,
  onClose
}: BreakAloneModalProps): JSX.Element | null {
  const [text, setText] = useState('')
  const { host, overlayProps } = useModalShell(onClose)
  const canStart = text.trim() !== ''

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

        <motion.ul
          className="vu-breakalone-ideas"
          variants={SUGGESTIONS_IN}
          initial="hidden"
          animate="shown"
        >
          {suggestions.map((idea) => (
            <motion.li key={idea} variants={dealtItem}>
              <motion.button
                type="button"
                className="vu-breakalone-idea"
                {...gestures(false, quietLift, quietPress)}
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
            autoFocus
            onChange={(event) => setText(event.target.value)}
          />
        </label>

        <div className="vu-foot">
          <motion.button
            id="break-alone-cancel"
            type="button"
            className="vu-btn vu-btn--outline vu-btn--panel vu-paper"
            {...gestures(false, lift, press)}
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
        </div>
      </motion.form>
    </motion.div>,
    host
  )
}
