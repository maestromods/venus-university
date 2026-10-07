import { useEffect, useRef, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { VENUS_WHISPER_MOD, WHISPER_COMMENTS, WHISPER_TEXT, whisperIssueId, whisperPeople, whisperPlayerHandle } from '@shared/venusWhisper'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import { useGameStore } from '../stores/gameStore'
import { useModOn } from '../stores/modsStore'
import { profileUrl } from '../stores/characterStore'
import { commentOnWhisper, dismissWhisper, publishWhisper, replyOnWhisper, useWhisperActivity, whisperReady } from '../stores/venusWhisper'
import { breatheMark, gestures, lift, press, quietLift, quietPress, panelUnderTab, veilIn } from './motion'
import '../vu_styles/VenusWhisper.css'

/** A separate reading room for the campus column and its one public discussion per issue. */
export function VenusWhisperModal({ theme, onClose }: { theme: 'day' | 'night'; onClose: () => void }): JSX.Element | null {
  const game = useGameStore(s => s), on = useModOn(VENUS_WHISPER_MOD)
  const backgroundBusy = useWhisperActivity(s => s.working)
  const [selected, setSelected] = useState(''), [draft, setDraft] = useState(''), [replyTo, setReplyTo] = useState<string>()
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [deleting, setDeleting] = useState(false)
  const [hidden, setHidden] = useState<string[]>([]), [typing, setTyping] = useState('')
  const ticket = useRef<{ active: boolean; group: string } | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const cancel = (): void => {
    const t = ticket.current
    if (t) { t.active = false; void window.api.jobs.cancelGroup(t.group); ticket.current = null }
    timers.current.forEach(clearTimeout); timers.current = []
  }
  useEffect(() => {
    cancel(); setBusy(false); setError(''); setHidden([]); setTyping(''); setSelected(''); setDraft(''); setReplyTo(undefined)
    return cancel
  }, [game.playthroughId, game.loads, game.date, game.time, on])
  const close = (): void => { cancel(); onClose() }
  const { host, overlayProps } = useModalShell(close)
  if (!host || !on) return null
  const state = game.exVenusWhisper
  const rows = state.issues.filter(i => i.term < game.termIndex || (i.term === game.termIndex && i.day <= game.date))
    .sort((a, b) => b.term - a.term || b.day - a.day)
  const issue = rows.find(i => i.id === selected) ?? rows[0]
  const today = whisperIssueId(game.termIndex, game.date)
  const published = rows.some(i => i.id === today) || state.dismissed.includes(today)
  const activeIssue = !!issue && issue.term === game.termIndex && issue.day >= game.date - 1
  const ready = !busy && !backgroundBusy && whisperReady(), people = whisperPeople(game)
  const target = issue?.comments.find(c => c.id === replyTo)
  const unanswered = issue?.comments.filter(c => c.player && !issue.answered.includes(c.id)).at(-1)

  /** Saved replies are revealed with short human pauses; closing never loses an already saved batch. */
  function reveal(ids: string[], done: () => void): void {
    if (!ids.length) { setBusy(false); setTyping(''); done(); return }
    setHidden(ids)
    let delay = 500 + Math.random() * 700
    for (let n = 0; n < ids.length; n++) {
      const c = useGameStore.getState().exVenusWhisper.issues.flatMap(i => i.comments).find(c => c.id === ids[n])
      timers.current.push(setTimeout(() => setTyping(`${c?.person.name ?? 'Someone'} is typing…`), delay))
      delay += 800 + Math.random() * 1300
      timers.current.push(setTimeout(() => {
        setHidden(h => h.filter(id => id !== ids[n])); setTyping('')
        if (n === ids.length - 1) { setBusy(false); done() }
      }, delay))
      delay += 300 + Math.random() * 700
    }
  }

  /** One cancellable action owns publication, replies and the local typing presentation. */
  async function run(action: (group: string, alive: () => boolean) => Promise<string[]>, status: string): Promise<void> {
    if (busy) return
    cancel(); setBusy(true); setError(''); setTyping(status); setDeleting(false)
    const t = { active: true, group: `venus-whisper:${crypto.randomUUID()}` }; ticket.current = t
    try {
      const ids = await action(t.group, () => t.active)
      if (t.active) reveal(ids, () => { if (ticket.current === t) ticket.current = null })
    } catch (e) {
      if (t.active) { setError(e instanceof Error ? e.message : 'The newsletter could not be updated.'); setBusy(false); setTyping('') }
    }
  }

  async function publish(): Promise<void> {
    await run(async (group, alive) => {
      const id = await publishWhisper(group, alive)
      if (alive()) setSelected(id)
      return replyOnWhisper(id, undefined, group, alive)
    }, 'Fetching today’s issue…')
  }

  async function send(): Promise<void> {
    if (!issue) return
    await run(async (group, alive) => {
      const id = await commentOnWhisper(issue.id, draft, replyTo, alive)
      if (alive()) { setDraft(''); setReplyTo(undefined) }
      return replyOnWhisper(issue.id, id, group, alive)
    }, 'Someone is reading your comment…')
  }

  return createPortal(<motion.div className="vu-veil" data-theme={theme} variants={veilIn} initial="hidden" animate="shown" exit="gone" {...overlayProps}>
    <motion.section className="vu-whisper vu-paper" role="dialog" aria-modal="true" aria-label="The Venus Whisper" variants={panelUnderTab}>
      <TitleTab>The Venus Whisper</TitleTab>
      <header className="vu-whisper-header">
        <div><span className="vu-whisper-meta">Campus correspondence</span><p>Everybody has a story. Somebody has a column.</p></div>
        <motion.span className="vu-whisper-seal" animate={breatheMark} aria-hidden="true"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4zM8 8h8M8 12h3M8 16h8M15 12h1"/></svg></motion.span>
      </header>
      <div className="vu-whisper-body">
        <aside className="vu-whisper-rail">
          <motion.button className="vu-btn vu-btn--primary vu-paper vu-btn--panel" disabled={published || !ready}
            {...gestures(published || !ready, lift, press)} onClick={() => void publish()}>Read today’s issue</motion.button>
          <p className="vu-whisper-note">One issue a day, written when you open it. New issues and replies use your configured AI.</p>
          <nav aria-label="Past issues" className="vu-whisper-archive">
            {rows.map(i => <motion.button key={i.id} className="vu-whisper-edition" aria-pressed={issue?.id === i.id}
              disabled={busy} {...gestures(busy, quietLift, quietPress)} onClick={() => { setSelected(i.id); setReplyTo(undefined); setDraft(''); setError(''); setDeleting(false) }}>
              <span className="vu-whisper-meta">Semester {i.term + 1} · Day {i.day + 1}</span><strong>{i.title}</strong><span>{i.comments.length} comments</span>
            </motion.button>)}
            {!rows.length && <p className="vu-empty vu-empty--flush">The first edition is waiting to be written.</p>}
          </nav>
        </aside>
        <div className="vu-whisper-reading">
          <div className="vu-whisper-scroll">
            {issue ? <>
              <article className="vu-whisper-article">
                <span className="vu-whisper-meta">Semester {issue.term + 1} · Day {issue.day + 1} · Anonymous editorial</span>
                <h2>{issue.title}</h2><div className="vu-whisper-copy">{issue.body}</div>
                <p className="vu-whisper-signature">Yours, somewhere on campus.</p>
              </article>
              <section className="vu-whisper-discussion" aria-label="Comments">
                <h3>The campus replies <span>{issue.comments.length}</span></h3>
                {issue.comments.filter(c => !hidden.includes(c.id)).map(c => {
                  const parent = issue.comments.find(p => p.id === c.replyTo)
                  return <div key={c.id} className="vu-whisper-comment">
                    <span className="vu-whisper-avatar" aria-hidden="true"><span>{c.person.name.charAt(0)}</span>{!c.player && <img src={profileUrl(c.person.id)} alt=""/>}</span>
                    <div><div className="vu-whisper-byline"><strong>{c.person.name}</strong><span>@{c.player && c.person.handle === 'reader' ? whisperPlayerHandle(game.playerFirstName, game.playerLastName) : c.person.handle}</span></div>
                      {parent && <small className="vu-whisper-reply-label">Reply to {parent.person.name}: {parent.text.slice(0, 90)}{parent.text.length > 90 ? '…' : ''}</small>}
                      <p>{c.text}</p>
                      {activeIssue && <motion.button className="vu-pill" disabled={!ready} {...gestures(!ready, quietLift, quietPress)} onClick={() => setReplyTo(c.id)}>Reply</motion.button>}
                    </div>
                  </div>
                })}
                {!issue.comments.length && <p className="vu-empty vu-empty--flush">A fresh page. Nobody has weighed in yet.</p>}
                {activeIssue && (unanswered || !issue.comments.some(c => !c.player)) && <motion.button className="vu-btn vu-btn--quiet" disabled={!ready}
                  {...gestures(!ready, quietLift, quietPress)} onClick={() => void run((g, a) => replyOnWhisper(issue.id, unanswered?.id, g, a), 'Someone is typing…')}>Get replies</motion.button>}
              </section>
            </> : <div className="vu-whisper-welcome"><h2>A little bird told us.</h2><p>Public posts, chance encounters, and just enough speculation to start a conversation.</p><p>The columnist signs no name. Everyone else speaks for themselves.</p></div>}
          </div>
          <div className="vu-whisper-status" role="status" aria-live="polite">{typing || (activeIssue ? 'Public conversation · keep it campus appropriate' : issue ? 'Archived issue · comments are closed' : 'Read an issue to join the conversation')}</div>
          {error && <p className="vu-whisper-error" role="alert">{error}</p>}
          {activeIssue && <div className="vu-whisper-composer">
            <div className="vu-whisper-compose-top"><span>{target ? `Replying to ${target.person.name}` : 'Comment on this issue'}</span>
              {target && <motion.button className="vu-pill" {...gestures(false, quietLift, quietPress)} onClick={() => setReplyTo(undefined)}>Cancel reply</motion.button>}
              <label className="vu-whisper-tag">Mention <select aria-label="Tag a character" value="" disabled={!ready} onChange={e => {
                const p = people.find(p => p.id === e.target.value)
                if (p) setDraft(d => `${d}${d && !d.endsWith(' ') ? ' ' : ''}@${p.handle} `.slice(0, WHISPER_TEXT))
              }}><option value="">Choose a name</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            </div>
            <textarea aria-label="Public comment" maxLength={WHISPER_TEXT} value={draft} disabled={!ready || issue.comments.length >= WHISPER_COMMENTS - 3} onChange={e => setDraft(e.target.value)}/>
            <div className="vu-whisper-compose-foot"><span>{draft.length} / {WHISPER_TEXT}</span>
              <motion.button className="vu-btn vu-btn--primary vu-paper vu-btn--panel" disabled={!ready || !draft.trim() || issue.comments.length >= WHISPER_COMMENTS - 3}
                {...gestures(!ready || !draft.trim() || issue.comments.length >= WHISPER_COMMENTS - 3, lift, press)} onClick={() => void send()}>Post comment</motion.button></div>
          </div>}
        </div>
      </div>
      <footer className="vu-foot vu-whisper-foot">
        {issue && <div><motion.button className="vu-btn vu-btn--quiet" disabled={!ready} {...gestures(!ready, quietLift, quietPress)} onClick={() => {
          if (!deleting) { setDeleting(true); return }
          void run(async (_g, alive) => { await dismissWhisper(issue.id, alive); setSelected(''); return [] }, 'Filing the archive…')
        }}>{deleting ? 'Confirm delete issue' : 'Delete issue'}</motion.button>
        {deleting && <motion.button className="vu-pill" {...gestures(false, quietLift, quietPress)} onClick={() => setDeleting(false)}>Keep issue</motion.button>}</div>}
        <motion.button className="vu-btn vu-btn--quiet" {...gestures(false, quietLift, quietPress)} onClick={close}>Back to menu</motion.button>
      </footer>
    </motion.section>
  </motion.div>, host)
}
