/**
 * Something of the break told in the box a scene speaks through — a slot he spent on himself,
 * or a leg of a trip — a line at a time, each put away by the click that brings the next. The
 * box stands waiting while the telling is still being written.
 */
import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'

import { aloneGains, type BreakAlone } from '@shared/termBreak'
import type { SceneLine } from '@shared/types'
import { useAudioStore } from '../stores/audioStore'
import { markStatusLine } from '../stores/loop/statusSteps'
import { DialogueBox } from './Dialogue'
import { veilIn } from './motion'
import '../vu_styles/Break.css'

export interface BreakNarrationProps {
  /** What is told, in order; absent while the call that writes it is out. */
  lines: readonly SceneLine[] | null
  /** The last line has been read and clicked past. */
  onDone: () => void
}

/** Milliseconds per character of the typewriter, the scene's own pace. */
const REVEAL_MS = 18

/** What has a sound as it is typed: a letter or a digit, and nothing a space or a mark says. */
const VOICED = /[\p{L}\p{N}]/u

/** A slot spent alone as it is told: how it went, then what it did for him in the lines a scene's ending gives the same thing. */
export function aloneLines(spent: BreakAlone): SceneLine[] {
  const gains = aloneGains(spent.exercised).lines
  return [
    ...spent.lines.map((text) => ({ speaker: '', text })),
    ...(gains.length > 0
      ? gains.map((gain) => markStatusLine(gain.text, undefined, gain.polarity))
      : [{ speaker: '', text: 'None of it did much for your stats.' }])
  ]
}

export function BreakNarration({ lines: told, onDone }: BreakNarrationProps): JSX.Element {
  const [at, setAt] = useState(0)
  const [revealed, setRevealed] = useState(0)
  const [typeHeld, setTypeHeld] = useState(false)
  const [skips, setSkips] = useState(0)
  const lines = told ?? []

  const line = lines[at]
  const text = line?.text ?? ''
  const fullyRevealed = text !== '' && revealed >= text.length

  // Held at nothing while the box is still arriving, so it never lands on a word half said.
  if (typeHeld && revealed !== 0) setRevealed(0)

  useEffect(() => {
    if (!text || typeHeld) return
    const timer = setInterval(() => {
      setRevealed((count) => {
        if (count >= text.length) {
          clearInterval(timer)
          return count
        }
        return count + 1
      })
    }, REVEAL_MS)
    return () => clearInterval(timer)
  }, [at, text, typeHeld])

  // The narrator's voice under the typewriter: a blip on every third letter or digit.
  const revealedBefore = useRef(0)
  useEffect(() => {
    const before = revealedBefore.current
    revealedBefore.current = revealed
    if (revealed !== before + 1 || !VOICED.test(text[revealed - 1] ?? '')) return
    let voiced = 0
    for (const character of text.slice(0, revealed)) if (VOICED.test(character)) voiced += 1
    if (voiced % 3 === 0) useAudioStore.getState().play('narrator')
  }, [revealed, text])

  // A line that went one way or the other rings as it arrives.
  const polarity = line?.status?.polarity
  useEffect(() => {
    if (polarity) useAudioStore.getState().play(polarity)
  }, [at, polarity])

  /** The click: the box landed, then the line said whole, then the next line or the end. */
  function advance(): void {
    if (!line) return
    if (typeHeld) setSkips((count) => count + 1)
    else if (!fullyRevealed) setRevealed(text.length)
    else if (at < lines.length - 1) {
      setAt(at + 1)
      setRevealed(0)
    } else onDone()
  }

  // Space and Enter are that same click.
  const advanceRef = useRef(advance)
  advanceRef.current = advance
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== ' ' && event.key !== 'Enter') return
      event.preventDefault()
      advanceRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <motion.div
      id="break-narration"
      className="vu-break-told"
      variants={veilIn}
      initial="hidden"
      animate="shown"
      exit="gone"
      onClick={advance}
    >
      <DialogueBox
        ready
        covered={false}
        text={text}
        marks={line?.status?.marks}
        revealed={revealed}
        fullyRevealed={fullyRevealed}
        boxWaiting={!line}
        sending={false}
        onTypeHold={setTypeHeld}
        skips={skips}
        rowShown={false}
      />
    </motion.div>
  )
}
