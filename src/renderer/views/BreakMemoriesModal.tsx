/**
 * What everybody remembers of a break, once it is over: a row for each memory written for
 * somebody who is coming back and a blank one for each girl given none, every row an editable
 * sentence. Every value is already an answer, so a dismissal commits as Save does.
 */
import { useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'

import type { BreakMemory } from '@shared/termCarry'
import type { Character } from '@shared/types'
import { MemoryRow } from '../components/MemoryRow'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import { UNKNOWN_NAME } from '../stores/gameStore'
import type { ScreenTheme } from './clockTheme'
import { gestures, lift, panelUnderTab, press, veilIn } from './motion'
import '../vu_styles/MemoryEdit.css'

/** One row of the panel: whose memory it is, and the memory as it stands. */
interface BreakMemoryRow extends BreakMemory {
  charId: string
}

export interface BreakMemoriesModalProps {
  /** The screen's own theme — a portal inherits no palette. */
  theme: ScreenTheme
  /** Whoever the break has anything to say about, in roster order. */
  cast: readonly Character[]
  /** Whose name the reader has learned, by charId; anybody else is masked and shown no face. */
  nameKnown: Readonly<Record<string, boolean>>
  /** What each of them remembers as it stands, by charId. */
  memories: Readonly<Record<string, readonly BreakMemory[]>>
  /** The one answer: Save, Escape and a click on the dimming alike. */
  onSave: (memories: Record<string, BreakMemory[]>) => void
}

/** The panel's rows: every memory in the cast's order, and a blank one for a girl with none. */
function rowsOf(
  cast: readonly Character[],
  memories: Readonly<Record<string, readonly BreakMemory[]>>
): BreakMemoryRow[] {
  return cast.flatMap(({ charId }) => {
    const written = memories[charId] ?? []
    return written.length > 0
      ? written.map((memory) => ({ charId, type: memory.type, desc: memory.desc }))
      : [{ charId, type: 'liked' as const, desc: '' }]
  })
}

/** The rows as the map they are saved as; every girl in the cast keeps an entry, empty or not. */
function memoriesOf(
  cast: readonly Character[],
  rows: readonly BreakMemoryRow[]
): Record<string, BreakMemory[]> {
  return Object.fromEntries(
    cast.map(({ charId }) => [
      charId,
      rows
        .filter((row) => row.charId === charId)
        .map((row) => ({ type: row.type, desc: row.desc }))
    ])
  )
}

export function BreakMemoriesModal({
  theme,
  cast,
  nameKnown,
  memories,
  onSave
}: BreakMemoriesModalProps): JSX.Element | null {
  const [drafts, setDrafts] = useState<BreakMemoryRow[]>(() => rowsOf(cast, memories))
  // The shell reads its close at the moment it fires, so a dismissal commits the latest drafts.
  const { host, overlayProps } = useModalShell(() => onSave(memoriesOf(cast, drafts)))

  /** Writes one row's verb or words, leaving the others as they stand. */
  function edit(index: number, change: Partial<BreakMemory>): void {
    setDrafts((was) => was.map((draft, at) => (at === index ? { ...draft, ...change } : draft)))
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
        id="break-memories"
        className="vu-memedit vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label="Edit memories?"
        variants={panelUnderTab}
        // A form, so Enter in any field is the answer the foot gives.
        onSubmit={(event) => {
          event.preventDefault()
          onSave(memoriesOf(cast, drafts))
        }}
        // And the screen behind this never sees that key.
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.stopPropagation()
        }}
      >
        <TitleTab>Edit memories?</TitleTab>

        <p className="vu-note-text">
          This is what each of them remembers of the break. Reword a line, or blank it to drop
          it. Keep it short, use past-tense and refer to yourself as “the reader”.
        </p>

        <div className="vu-scroll-box">
          <div className="vu-memedit-rows">
            {drafts.map((draft, index) => {
              const known = nameKnown[draft.charId] === true
              const character = cast.find((c) => c.charId === draft.charId)
              return (
                <MemoryRow
                  key={`${draft.charId}-${index}`}
                  id={`break-memory-${draft.charId}-${index}`}
                  name={known ? (character?.firstName ?? UNKNOWN_NAME) : UNKNOWN_NAME}
                  faceOf={known ? draft.charId : undefined}
                  type={draft.type}
                  desc={draft.desc}
                  onType={(type) => edit(index, { type })}
                  onDesc={(desc) => edit(index, { desc })}
                  autoFocus={index === 0}
                />
              )
            })}
          </div>
          <div className="vu-scroll-fade" />
        </div>

        {/* Every row is already an answer, so the foot carries one and no cancel. */}
        <div className="vu-foot">
          <motion.button
            id="break-memories-save"
            className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
            type="submit"
            {...gestures(false, lift, press)}
          >
            Save
          </motion.button>
        </div>
      </motion.form>
    </motion.div>,
    host
  )
}
