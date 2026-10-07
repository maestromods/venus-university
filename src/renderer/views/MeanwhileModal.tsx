import { MeanwhileIcon } from '../components/BunnyboardFeatureIcons'
import '../vu_styles/BunnyboardFeature.css'
import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import { MEANWHILE_MOD, meanwhileEvents, type MeanwhileScene } from '@shared/meanwhile'
import { fullNameOf } from '@shared/types'
import { useGameStore } from '../stores/gameStore'
import { useModOn } from '../stores/modsStore'
import { generateMeanwhile, meanwhileReady } from '../stores/meanwhile'
import { profileUrl } from '../stores/characterStore'
import { formatShortGameDate } from '../prompts/gameDate'
import { bgUrl } from './bgAssets'
import { gestures, lift, press, quietLift, quietPress } from './motion'
import '../vu_styles/Meanwhile.css'

export function MeanwhilePage(): JSX.Element | null {
  const game = useGameStore(s => s), on = useModOn(MEANWHILE_MOD)
  const [selected,setSelected] = useState<MeanwhileScene|null>(null), [index,setIndex] = useState(0)
  const [busy,setBusy] = useState(false), [error,setError] = useState('')
  const ticket = useRef<{active:boolean;group:string}|null>(null)
  const cancel = (): void => {
    const held=ticket.current
    if (held) { held.active=false; void window.api.jobs.cancelGroup(held.group); ticket.current=null }
  }
  useEffect(() => { cancel(); setSelected(null); setBusy(false); setError(''); return cancel }, [game.loads,game.playthroughId,game.date,game.time,on])
  if (!on) return null
  const rows=meanwhileEvents(game), line=selected?.lines[index]
  const speaker=line?game.characters[line.speaker]:undefined
  async function watch(event: MeanwhileScene): Promise<void> {
    cancel(); setSelected(event); setIndex(0); setError(''); setBusy(false)
    if(event.lines.length) return
    const own={active:true,group:'meanwhile:'+crypto.randomUUID()};ticket.current=own;setBusy(true)
    try { const scene=await generateMeanwhile(event.id,own.group,()=>own.active)
      if(own.active)setSelected(scene)
    } catch(e) { if(own.active)setError(e instanceof Error?e.message:'Could not write this conversation.') }
    finally { if(own.active)setBusy(false) }
  }
  const key=selected?.kind==='class'?'classroom':selected?.kind==='dorm'?'lowrise_dorm_room':
    ({btb_arcade:'arcade',green_hill_park:'park',cutetea:'bubble_tea',kendall_library:'library'}[selected?.ref??'']??selected?.ref)
  // Native encounters carry a day, not a time slot. A neutral day illustration avoids inventing one.
  const backdrop=key?bgUrl(key,'day',false):null
  return <section className="vu-bb-feature vu-meanwhile" aria-label="Meanwhile conversations">
      <header className="vu-bb-feature-heading">
        <div><span className="vu-bb-feature-label">Away from the spotlight</span><h1>Meanwhile…</h1><p>A little campus life, even when you’re not there.</p></div>
        <span className="vu-bb-feature-seal" aria-hidden="true"><MeanwhileIcon /></span>
      </header>
      <div className="vu-bb-feature-columns">
        <aside className="vu-bb-feature-list">
          <span className="vu-bb-feature-label">Recent encounters</span>
          <nav className="vu-meanwhile-events" aria-label="NPC encounters">
            {rows.length?rows.map(event=><motion.button key={event.id} type="button" className="vu-meanwhile-event" aria-pressed={selected?.id===event.id}
              disabled={!event.lines.length&&!meanwhileReady()} {...gestures(!event.lines.length&&!meanwhileReady(),quietLift,quietPress)} onClick={()=>void watch(event)}>
              <strong>{event.title}</strong><span>{formatShortGameDate(event.date)} · {event.where}</span><small>{event.lines.length?'Watch again':'Watch conversation'}</small>
            </motion.button>):<p className="vu-empty vu-empty--flush">No recent encounters between known characters yet. Check back as the semester progresses.</p>}
          </nav>
          <p className="vu-meanwhile-note">A spectator’s view. Your character isn’t here.</p>
        </aside>
        <section className="vu-meanwhile-view" aria-label="Conversation viewer">
          <div className="vu-meanwhile-scene">
            {backdrop&&<img className="vu-meanwhile-backdrop" src={backdrop} alt="" onError={e=>{e.currentTarget.style.visibility='hidden'}}/>}
            <div className="vu-meanwhile-story">
              <header className="vu-meanwhile-scene-heading">
                <h2>{selected?.title??'Off the beaten path'}</h2>
                <p>{selected?`${selected.where} · ${formatShortGameDate(selected.date)}`:'Choose an encounter to watch. Writing a new conversation uses your configured AI; replays use the saved copy.'}</p>
              </header>
              {busy&&<p className="vu-meanwhile-message" role="status">Writing their conversation…</p>}
              {error&&<div className="vu-meanwhile-message" role="alert"><p>{error}</p><motion.button className="vu-btn vu-btn--quiet" {...gestures(false,quietLift,quietPress)} onClick={()=>selected&&void watch(selected)}>Retry</motion.button></div>}
              {line&&<div className="vu-meanwhile-line"><img src={profileUrl(line.speaker)} alt="" onError={e=>{e.currentTarget.style.visibility='hidden'}}/>
                <div><strong>{speaker?fullNameOf(speaker):'Character'}</strong><p>{line.text}</p></div></div>}
            </div>
          </div>
          <div className="vu-meanwhile-controls">
            <motion.button className="vu-btn vu-btn--quiet" disabled={!line||index===0} {...gestures(!line||index===0,quietLift,quietPress)} onClick={()=>setIndex(i=>i-1)}>Previous</motion.button>
            <span>{line?`${index+1} / ${selected!.lines.length}`:'Read-only'}</span>
            <motion.button className="vu-btn vu-btn--primary vu-paper" disabled={!line||index>=selected!.lines.length-1} {...gestures(!line||index>=selected!.lines.length-1,lift,press)} onClick={()=>setIndex(i=>i+1)}>Next</motion.button>
          </div>
          <p className="vu-meanwhile-spectator">Read-only dramatization · no time or relationship changes</p>
        </section>
      </div>
    </section>
}
