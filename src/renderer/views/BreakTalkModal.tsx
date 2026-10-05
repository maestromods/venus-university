/**
 * One conversation of a break: her thread as far as it has gone, how many texts he has left,
 * the well he types the next one into, and once it is over what it came to. The first text is
 * what spends the slot, so the panel can be opened and left before one is sent; from then until
 * the conversation has been judged there is no way out of it.
 */
import { useEffect, useRef, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'

import { memoryStatusLine } from '@shared/relationship'
import { TALK_TURNS, talkTurns, type BreakTalk } from '@shared/termBreak'
import type { Character } from '@shared/types'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import { typingDelayFor } from '../stores/textingPace'
import type { ScreenTheme } from './clockTheme'
import { gestures, lift, panelUnderTab, press, spin, typingDot, veilIn } from './motion'
import '../vu_styles/Bunnyboard.css'
import '../vu_styles/Break.css'

/** What the panel is waiting on, if anything. */
export type TalkPhase = 'idle' | 'replying' | 'judging'

export interface BreakTalkModalProps {
  /** The screen's own theme — a portal inherits no palette. */
  theme: ScreenTheme
  character: Character
  /** The week of the break the conversation falls in. */
  week: number
  /** The conversation as it stands: open, just judged, or absent before his first text. */
  talk: BreakTalk | null
  phase: TalkPhase
  /** His next text; the first one opens the conversation and spends the slot. */
  onSend: (text: string) => void
  /** Ends the conversation himself. */
  onLeave: () => void
  /** Puts the panel away: before a first text, or once the conversation has been judged. */
  onClose: () => void
}

export function BreakTalkModal({
  theme,
  character,
  week,
  talk,
  phase,
  onSend,
  onLeave,
  onClose
}: BreakTalkModalProps): JSX.Element | null {
  const [text, setText] = useState('')
  const judged = talk?.verdict !== undefined
  // Nothing leaves a conversation under way but its own ending.
  const locked = talk !== null && !judged
  const { host, overlayProps } = useModalShell(() => {
    if (!locked && phase === 'idle') onClose()
  })

  // How many of the thread's lines are on screen. Whatever was already said when the panel
  // opened is; a text of hers that arrives after that lands one at a time, each after the time
  // it would have taken her to type, as her texts do on the phone.
  const lines = talk?.lines.length ?? 0
  const [landed, setLanded] = useState(lines)
  const next = talk?.lines[landed]
  useEffect(() => {
    if (!next) return
    if (next.sender === 'player') {
      setLanded((count) => count + 1)
      return
    }
    const timer = setTimeout(() => setLanded((count) => count + 1), typingDelayFor(next.text))
    return () => clearTimeout(timer)
  }, [next])
  const typing = phase === 'replying' || next?.sender === 'contact'
  // The judgement may be back before her last text has landed; it waits its turn.
  const settled = landed >= lines
  // Over as far as the player has been shown.
  const done = judged && settled

  const turns = talk ? talkTurns(talk) : 0
  const waiting = phase !== 'idle' || !settled
  const canWrite = !judged && !waiting && talk?.ended === undefined && turns < TALK_TURNS
  const canSend = canWrite && text.trim() !== ''

  // The thread follows its newest line, and the wait under it.
  const thread = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = thread.current
    if (node) node.scrollTop = node.scrollHeight
  }, [landed, typing, phase, judged])

  /** Sends what the well holds and empties it. */
  function send(): void {
    if (!canSend) return
    onSend(text)
    setText('')
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
        id="break-talk"
        className="vu-breaktalk vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label={`Texting ${character.firstName}`}
        variants={panelUnderTab}
        // A form, so Enter in the well is the answer the foot gives.
        onSubmit={(event) => {
          event.preventDefault()
          send()
        }}
        // And the screen behind this never sees that key.
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.stopPropagation()
        }}
      >
        <TitleTab>{character.firstName}</TitleTab>

        <span className="vu-breaktalk-count">
          Week {week} · text {Math.min(turns + (canWrite ? 1 : 0), TALK_TURNS)} of {TALK_TURNS}
        </span>

        <div className="vu-scroll-box vu-breaktalk-box">
          <div className="vu-breaktalk-thread" ref={thread}>
            {talk === null && (
              <p className="vu-empty vu-empty--flush">
                The first text spends this slot on {character.firstName}.
              </p>
            )}
            {talk?.lines.slice(0, landed).map((line, index) => (
              <div
                key={index}
                className={`vu-bb-bubble vu-bb-bubble--${line.sender === 'player' ? 'mine' : 'theirs'}`}
              >
                {line.text}
              </div>
            ))}
            {typing && (
              <div
                className="vu-bb-bubble vu-bb-bubble--theirs vu-bb-bubble--typing"
                aria-label="typing"
              >
                {typingDot.map((beat, index) => (
                  <motion.span key={index} className="vu-bb-dot" animate={beat} />
                ))}
              </div>
            )}
            {phase === 'judging' && settled && (
              <span className="vu-breaktalk-wait">
                <motion.span className="vu-ring" animate={spin} />
                The conversation is over
              </span>
            )}
            {done && (
              <ul className="vu-breaktalk-came">
                {(talk?.memories ?? []).map((memory, index) => {
                  // What it left her remembering, said as a scene's ending says it: the verb
                  // painted in the colour of which way it went.
                  const { text: said, status } = memoryStatusLine(character.firstName, memory)
                  const mark = status?.marks?.[0]
                  return (
                    <li key={index} className="vu-note-text">
                      {mark ? (
                        <>
                          {said.slice(0, mark.start)}
                          <span className="vu-breaktalk-mark" data-tone={mark.tone}>
                            {said.slice(mark.start, mark.end)}
                          </span>
                          {said.slice(mark.end)}
                        </>
                      ) : (
                        said
                      )}
                    </li>
                  )
                })}
                {(talk?.memories ?? []).length === 0 && (
                  <li className="vu-note-text">
                    {character.firstName} will not remember much of this one.
                  </li>
                )}
              </ul>
            )}
          </div>
          <div className="vu-scroll-fade" />
        </div>

        {!done && (
          <label className="vu-field">
            <input
              id="break-talk-text"
              className="vu-input"
              aria-label={`Text ${character.firstName}`}
              placeholder={canWrite ? 'hey, how is it going?' : ''}
              value={text}
              disabled={!canWrite}
              autoFocus
              onChange={(event) => setText(event.target.value)}
            />
          </label>
        )}

        <div className="vu-foot">
          {done || talk === null ? (
            <motion.button
              id="break-talk-close"
              type="button"
              className={`vu-btn ${done ? 'vu-btn--primary' : 'vu-btn--outline'} vu-btn--panel vu-paper`}
              {...gestures(waiting, lift, press)}
              disabled={waiting}
              onClick={onClose}
            >
              {done ? 'Close' : 'Cancel'}
            </motion.button>
          ) : (
            <motion.button
              id="break-talk-leave"
              type="button"
              className="vu-btn vu-btn--outline vu-btn--panel vu-paper"
              {...gestures(!canWrite, lift, press)}
              disabled={!canWrite}
              onClick={onLeave}
            >
              End the conversation
            </motion.button>
          )}
          {!done && (
            <motion.button
              id="break-talk-send"
              type="submit"
              className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
              {...gestures(!canSend, lift, press)}
              disabled={!canSend}
            >
              Send
            </motion.button>
          )}
        </div>
      </motion.form>
    </motion.div>,
    host
  )
}
