/**
 * A slot of the break spent on himself: the well he says what he will do in, and once it has
 * been written how it went and what it did for his stats. Saying what he does is what spends
 * the slot, so the panel can be opened and left before that.
 */
import { useEffect, useRef, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'

import { aloneGains, type BreakAlone } from '@shared/termBreak'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import { useAudioStore } from '../stores/audioStore'
import type { ScreenTheme } from './clockTheme'
import { gestures, lift, panelUnderTab, press, spin, veilIn } from './motion'
import '../vu_styles/Break.css'

export interface BreakAloneModalProps {
  /** The screen's own theme — a portal inherits no palette. */
  theme: ScreenTheme
  /** The week of the break the slot falls in. */
  week: number
  /** The slot as it was spent, once it has been; absent while he is still saying what he will do. */
  spent: BreakAlone | null
  /** Whether the call that writes it is out. */
  writing: boolean
  /** What he does with the slot, which is what spends it. */
  onStart: (action: string) => void
  /** Puts the panel away: before the slot is spent, or once it has been read. */
  onClose: () => void
}

export function BreakAloneModal({
  theme,
  week,
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

  // Those lines arrive with the sting they have there, once.
  const stung = useRef(spent !== null)
  const gained = gains.length > 0
  useEffect(() => {
    if (!spent || stung.current) return
    stung.current = true
    if (gained) useAudioStore.getState().play('positive')
  }, [spent, gained])

  /** Spends the slot on what the well holds. */
  function start(): void {
    if (canStart) onStart(text)
  }

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
          <div className="vu-breakalone-told">
            {spent.lines.map((line, index) => (
              <p key={index} className="vu-note-text">
                {line}
              </p>
            ))}
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
          </div>
        ) : (
          <>
            <p className="vu-note-text">
              What do you do with it? Saying so spends this slot, and whatever it works on — your
              smarts, your fitness, your way with people — is what it builds.
            </p>
            <label className="vu-field">
              <input
                id="break-alone-text"
                className="vu-input"
                aria-label="What you do with the slot"
                placeholder="go running every morning"
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
                Spend the slot
              </motion.button>
            </>
          )}
        </div>
      </motion.form>
    </motion.div>,
    host
  )
}
