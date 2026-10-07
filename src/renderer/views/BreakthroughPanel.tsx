import { useEffect, useState, type JSX } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { BREAKTHROUGH_MOD } from '@shared/breakthrough'
import { fullNameOf } from '@shared/types'
import { activateBreakthrough, breakthroughCast, canBreakthrough } from '../stores/breakthrough'
import { interject } from '../stores/gameLoop'
import { useGameStore } from '../stores/gameStore'
import { useModOn } from '../stores/modsStore'
import { BREAKTHROUGH_SECONDS, breakthroughBannerMotion, breakthroughHaloMotion, gestures, lift, press, quietLift, quietPress } from './motion'
import '../vu_styles/Breakthrough.css'

export function BreakthroughPanel({ hidden, blocked }: { hidden: boolean; blocked: boolean }): JSX.Element | null {
  const game = useGameStore(s => s), on = useModOn(BREAKTHROUGH_MOD)
  const [selected,setSelected] = useState(''), [expanded,setExpanded] = useState(false)
  const [draft,setDraft] = useState(''), [error,setError] = useState('')
  const ids = breakthroughCast(game), id = ids.includes(selected) ? selected : ids[0]
  useEffect(() => { setExpanded(false); setDraft(''); setError(''); setSelected('') }, [game.playthroughId,game.loads,game.date,game.time])
  if (!on || hidden || !id) return null
  const amount = game.exBreakthrough.meters[id] ?? 0, ready = amount >= 100
  const canUse = !blocked && canBreakthrough(game,id)
  const activate = (): void => {
    setError('')
    try { activateBreakthrough(id,draft,interject); setDraft(''); setExpanded(false) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not activate Breakthrough.') }
  }
  return <aside className="vu-breakthrough vu-paper" aria-label="Breakthrough spirit"
    onKeyDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
    <motion.button type="button" className="vu-breakthrough-heading" disabled={blocked}
      aria-expanded={expanded} {...gestures(blocked,quietLift,quietPress)} onClick={() => setExpanded(v => !v)}>
      <span>✦ Breakthrough</span><small>{ready ? 'READY' : `${amount} / 100`}</small>
    </motion.button>
    <select aria-label="Breakthrough character" value={id} disabled={blocked || !!game.exBreakthrough.pending}
      onChange={e => {setSelected(e.target.value);setDraft('');setError('')}}>
      {ids.map(id => <option key={id} value={id}>{game.charInfo[id]?.nameKnown ? fullNameOf(game.characters[id]) : 'Unknown character'}</option>)}
    </select>
    <div className="vu-breakthrough-track" role="progressbar" aria-label="Spirit" aria-valuemin={0} aria-valuemax={100} aria-valuenow={amount}>
      <span style={{width:`${amount}%`}} />
    </div>
    {expanded && <div className="vu-breakthrough-detail">
      <p>Liked +10 · Loved +20 · Hated −15 · Disliked unchanged. Spirit settles after the scene, up to +20 per character per time slot.</p>
      {ready ? <label>What do you do, and what do you hope changes?
        <textarea value={draft} maxLength={1000} rows={4} disabled={blocked || !!game.exBreakthrough.pending}
          onChange={e => setDraft(e.target.value)} placeholder="I open up honestly and try to rebuild our trust…" />
      </label> : <p>At 100 spirit, turn a meaningful moment into a Breakthrough.</p>}
      <p>A strong positive opportunity, grounded in their personality and the situation. Spending it resets this character’s bar to 0.</p>
      {ready && <motion.button type="button" className="vu-btn vu-btn--outline vu-paper" disabled={!canUse || !draft.trim()}
        {...gestures(!canUse || !draft.trim(),lift,press)} onClick={activate}>Unleash · 100 spirit</motion.button>}
      {ready && !canUse && <p>Available whenever the scene lets you reply to this character.</p>}
      {error && <p role="alert">{error}</p>}
    </div>}
  </aside>
}

export function BreakthroughFlourish(): JSX.Element | null {
  const flash = useGameStore(s => s.breakthroughFlash), playthrough = useGameStore(s => s.playthroughId)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => {
      if (useGameStore.getState().breakthroughFlash?.id === flash.id) useGameStore.setState({breakthroughFlash:null})
    },BREAKTHROUGH_SECONDS * 1000)
    return () => clearTimeout(timer)
  },[flash])
  if (!flash || flash.playthroughId !== playthrough) return null
  return <div key={flash.id} className="vu-breakthrough-flourish" role="status" aria-live="polite" data-reduced={reduced || undefined}>
    {!reduced && <motion.div className="vu-breakthrough-halo" aria-hidden="true" animate={breakthroughHaloMotion}/>}
    <motion.div className="vu-breakthrough-banner vu-paper" animate={reduced ? undefined : breakthroughBannerMotion}>
      <span aria-hidden="true">✧ ── ✦ ── ✧</span><small>{flash.name}</small>
      <strong>Breakthrough</strong><span>Make this moment matter.</span><span aria-hidden="true">✦</span>
    </motion.div>
  </div>
}
