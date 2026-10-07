import { useRef, useState, type FormEvent, type JSX } from 'react'
import { motion } from 'motion/react'
import { PLAYTHROUGH_NAME_LIMIT } from '@shared/playthroughNames'
import type { PlaythroughSummary } from '@shared/types'
import { useSaveStore } from '../stores/saveStore'
import { gestures, quietLift, quietPress } from '../views/motion'
import { TextField } from './TextField'
import { useDismissLayer } from './useModalShell'
import '../vu_styles/PlaythroughRename.css'

/** Edits a folder's display name from a separate control below its load button. */
export function PlaythroughRename({ playthrough }: { playthrough: PlaythroughSummary }): JSX.Element {
  const rename = useSaveStore(s => s.renamePlaythrough)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(playthrough.label)
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  useDismissLayer(() => { if (!sending.current) setOpen(false) }, open)

  /** Holds the editor open until the write succeeds; a refused write reports through the store. */
  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (sending.current || !name.trim()) return
    sending.current = true
    setBusy(true)
    try {
      if (await rename(playthrough.playthroughId, name)) setOpen(false)
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  return (
    <div className="vu-playthrough-rename">
      {open ? (
        <form onSubmit={event => void submit(event)}>
          <TextField
            id={`playthrough-name-${playthrough.playthroughId}`}
            label="Playthrough name" value={name} onChange={setName}
            maxLength={PLAYTHROUGH_NAME_LIMIT} autoFocus disabled={busy}
          />
          <div className="vu-playthrough-rename-actions">
            <motion.button type="button" className="vu-btn vu-btn--quiet" disabled={busy}
              {...gestures(busy, quietLift, quietPress)} onClick={() => setOpen(false)}>
              Cancel
            </motion.button>
            <motion.button type="submit" className="vu-btn vu-btn--quiet" disabled={busy || !name.trim()}
              {...gestures(busy || !name.trim(), quietLift, quietPress)}>
              {busy ? 'Saving…' : 'Save name'}
            </motion.button>
          </div>
        </form>
      ) : (
        <motion.button type="button" className="vu-btn vu-btn--quiet"
          aria-label={`Rename ${playthrough.label}`} {...gestures(false, quietLift, quietPress)}
          onClick={() => { setName(playthrough.label); setOpen(true) }}>
          Rename
        </motion.button>
      )}
    </div>
  )
}
