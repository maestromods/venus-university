/**
 * The break between two semesters, played a slot at a time between a finished semester's ending
 * and the roster of the next one: its clock, the reader as the break has left him, whoever is
 * coming back, and the way on. A slot goes on a conversation with one of them or is let go by.
 * Skipped or played out, the break closes on what each of them remembers of it, which the
 * player may reword before choosing the roster.
 */
import { useEffect, useRef, useState, type JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'

import { appError } from '@shared/errors'
import { seasonOf, seasonWords, termIndexOf, type Season } from '@shared/term'
import {
  breakClock,
  breakOver,
  breakPlayed,
  breakSlotDate,
  breakSpent,
  breakWeeks,
  BREAK_SLOTS_PER_WEEK,
  openBreak,
  openTalk,
  mayInvite,
  openInvite,
  pendingReachWeek,
  playedMemories,
  tripDeparture,
  tripSlotsAhead,
  tripStep,
  activeTrip,
  withInvite,
  withInviteAnswered,
  withTravel,
  unansweredReach,
  withReaches,
  withReachRead,
  replyOwed,
  withBreakClosed,
  withPlayerLine,
  withReply,
  withSlotSpent,
  withTimeAlone,
  withTalkJudged,
  withTalkLeft,
  withTalkStarted,
  type BreakAlone,
  type BreakDraft,
  type BreakEntry,
  type BreakTalk
} from '@shared/termBreak'
import type { BreakMemory } from '@shared/termCarry'
import type { AppError, Character, SceneLine } from '@shared/types'
import { CardCaption } from '../components/CardCaption'
import { ConfirmModal } from '../components/ConfirmModal'
import { LlmFailureModal } from '../components/LlmFailureModal'
import { useWindowKeydown } from '../components/useWindowKeydown'
import { spriteUrl } from '../stores/characterStore'
import {
  clearStagedContinuation,
  stageContinuation,
  stagedContinuation
} from '../stores/newGame'
import {
  breakCast,
  breakStandings,
  breakTags,
  cancelBreakCall,
  canText,
  judgeTalk,
  replyToTalk,
  spendTimeAlone,
  writeBreakCards,
  writeBreakMemories,
  startVisit,
  writeReachOuts
} from '../stores/termBreak'
import { useAudioStore } from '../stores/audioStore'
import { useUiStore } from '../stores/uiStore'
import { isWebBuild } from '../platform'
import { StatRadar } from '../components/StatRadar'
import { BreakAloneModal } from './BreakAloneModal'
import { aloneLines, BreakNarration } from './BreakNarration'
import { BreakMemoriesModal } from './BreakMemoriesModal'
import { BreakTalkModal, type TalkPhase } from './BreakTalkModal'
import { heldScreenTheme } from './clockTheme'
import { GameMenuModal } from './GameMenuModal'
import {
  cardLift,
  dealt,
  dealtItem,
  decorIn,
  fadeIn,
  gestures,
  hovered,
  lift,
  press,
  quietLift,
  quietPress,
  spin
} from './motion'
import { formatShortGameDate } from '../prompts/gameDate'
import { BackIcon, CheckIcon, ChevronIcon } from './screenIcons'
import '../vu_styles/Bunnyboard.css'
import '../vu_styles/Break.css'

const HEADER_IN = fadeIn(0.1)
const READER_IN = fadeIn(0.2)
const GRID_IN = dealt(0.25, 0.04)
const FOOT_IN = fadeIn(0.5)

/** `"Summer vacation"` — a sentence's words for the break, as a title wears them. */
function titled(words: string): string {
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** A call that failed, and what answering its modal with Retry does. */
interface Failure {
  error: AppError
  title: string
  retry: () => void
  /** What answering the failure with no does, where that is more than putting it away. */
  abandon?: () => void
}

export function BreakView(): JSX.Element | null {
  const setView = useUiStore((s) => s.setView)
  const showError = useUiStore((s) => s.showError)
  const openModal = useUiStore((s) => s.openModal)
  const appModals = useUiStore((s) => s.modals.length)
  const [theme] = useState(heldScreenTheme)

  // The finished semester this break follows, taken once at mount and dropped by the effect
  // below; the roster screen is handed it again on the way out.
  const [from] = useState(stagedContinuation)
  useEffect(() => {
    clearStagedContinuation()
  }, [])

  // The break as it stands: null until whatever was already on disk has been read.
  const [draft, setDraft] = useState<BreakDraft | null>(null)
  // The memory call of a skipped break is out.
  const [writing, setWriting] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [confirmingSkip, setConfirmingSkip] = useState(false)
  const [editing, setEditing] = useState(false)
  // Whose conversation panel is up, and what it is waiting on.
  const [talking, setTalking] = useState<string | null>(null)
  const [phase, setPhase] = useState<TalkPhase>('idle')
  // The conversation the panel goes on showing once it has been judged, until it is closed.
  const [shown, setShown] = useState<BreakTalk | null>(null)
  const [menu, setMenu] = useState(false)
  // The panel for a slot spent on himself: whether it is up, whether its call is out, and the
  // slot it goes on showing once it has been written, until it is closed.
  const [alone, setAlone] = useState(false)
  const [aloneWriting, setAloneWriting] = useState(false)
  const [aloneSpent, setAloneSpent] = useState<BreakAlone | null>(null)
  // A leg of a trip being told, and the break as it stands once that leg has been read.
  const [travel, setTravel] = useState<{ lines: SceneLine[]; next: BreakDraft } | null>(null)
  // The box is up from the moment the slot is asked for until its last line is clicked past.
  const telling = aloneWriting || aloneSpent !== null || travel !== null

  // The call for what the girls send at the top of a week is out.
  const [checking, setChecking] = useState(false)
  // The week that call was last made for, so one week is asked for once.
  const asked = useRef<number | null>(null)

  // Escape opens the menu where nothing else is up to answer it; a panel in front has already
  // taken the key for itself.
  useWindowKeydown((event) => {
    if (event.key !== 'Escape') return
    if (menu || talking || alone || telling || editing || confirmingSkip || failure || appModals > 0) return
    setMenu(true)
  })

  // What a resumed break owes its open conversation, picked up once after the read.
  const resumed = useRef(false)

  useEffect(() => {
    if (!from) {
      setView('mainMenu')
      return
    }
    let live = true
    void (async () => {
      const read = await window.api.saves.break(from.playthroughId)
      if (!live) return
      if (!read.ok) showError(read.error)
      // The break is the semester's: one already under way is resumed whichever save was picked.
      const stored = read.ok ? read.data : null
      if (stored) {
        const { schemaVersion: _schemaVersion, savedAt: _savedAt, ...kept } = stored
        setDraft(kept)
      } else {
        setDraft(openBreak(from.save))
      }
    })()
    return () => {
      live = false
    }
  }, [from, setView, showError])

  // Unmounting abandons the call with it.
  useEffect(() => cancelBreakCall, [])

  // A break left in the middle of a conversation comes back onto it, and onto whatever call
  // it was waiting for.
  useEffect(() => {
    if (!draft || resumed.current) return
    resumed.current = true
    const talk = openTalk(draft)
    if (!talk) return
    setTalking(talk.charId)
    if (replyOwed(talk)) void answer(draft)
    else if (talk.ended) void judge(draft)
    // Once, on the break as it was read: the ref above is what holds it to that.
  }, [draft])

  // A week is opened by whatever the girls send on their own in it, asked for once the screen
  // is clear of the panel that spent the slot before it.
  useEffect(() => {
    if (!from || !draft || failure || talking || telling || alone) return
    const week = pendingReachWeek(draft, seasonOf(termIndexOf(from.record)))
    if (week === null || asked.current === week) return
    asked.current = week
    void checkPhone(draft, week)
    // `checkPhone` reads nothing that is not named here.
  }, [from, draft, failure, talking, telling, alone])

  if (!from) return null

  const ended = seasonOf(termIndexOf(from.record))
  const words = seasonWords(ended)
  const cast = breakCast(from)
  const nameKnown = Object.fromEntries(
    cast.map((c) => [c.charId, from.save.charInfo[c.charId]?.nameKnown === true])
  )
  // What he calls each of them: as the semester left it, and as a visit has since changed it.
  const tags = breakTags(from, draft?.visits)
  // A face is drawn only for somebody whose name he has learned.
  const faces = cast.filter((c) => nameKnown[c.charId])

  const over = draft !== null && breakOver(draft)
  const spent = draft !== null && breakSpent(draft, ended)
  const underWay = draft !== null && openTalk(draft) !== null
  const dead = draft === null || writing || underWay || checking
  const played = draft !== null && breakPlayed(draft)

  /** Puts the break as it stands on screen and on disk; a refused write is reported and play goes on. */
  async function keep(next: BreakDraft): Promise<void> {
    setDraft(next)
    if (!from) return
    const written = await window.api.saves.writeBreak(from.playthroughId, next)
    if (!written.ok) showError(written.error)
  }

  /** Whether she may ask him to come and stay, as the break stands. */
  function invitable(base: BreakDraft, charId: string): boolean {
    if (!from) return false
    const standing = breakStandings(from)[charId]
    return standing !== undefined && mayInvite(base, charId, standing, ended)
  }

  /** His answer to her invitation, which costs nothing either way. */
  function answerInvite(charId: string, accept: boolean): void {
    if (!draft) return
    const next = withInviteAnswered(draft, charId, accept, ended)
    if (next !== draft) void keep(next)
  }

  /** The slot the trip under way claims: a leg of the journey told, or a stretch with her played. */
  function takeTrip(): void {
    if (!from || !draft || dead) return
    const step = tripStep(draft)
    if (!step) return
    if (step.kind === 'visit') {
      if (!startVisit(from, draft)) {
        showError(appError('BREAK_NO_VISIT', 'The visit could not be started.'))
      }
      return
    }
    const name = from.characters[step.charId]?.firstName ?? 'her'
    const lines =
      step.kind === 'out'
        ? [
            `You pack a bag and set off on the long way out to see ${name}.`,
            `By the time you get there, the week is gone.`
          ]
        : [
            `You say goodbye to ${name} and start the long way home.`,
            `By the time you are back in your own room, the trip is behind you.`
          ]
    setTravel({
      lines: lines.map((text) => ({ speaker: '', text })),
      next: withTravel(draft, ended)
    })
  }

  /** The leg has been read: its slot is spent, and the break closed where that was its last. */
  function closeTravel(): void {
    if (!travel) return
    const { next } = travel
    setTravel(null)
    if (breakSpent(next, ended)) void keep(next).then(() => closePlayed(next))
    else void keep(next)
  }

  /** Asks who writes to him in `week`, and files what they send; nothing else moves meanwhile. */
  async function checkPhone(base: BreakDraft, week: number): Promise<void> {
    if (!from) return
    setChecking(true)
    const outcome = await writeReachOuts(from, base, week)
    setChecking(false)
    if (outcome.status === 'cancelled') return
    if (outcome.status === 'failed') {
      setFailure({
        error: outcome.error,
        title: "Couldn't check your phone",
        retry: () => void checkPhone(base, week),
        // The week goes on with nobody having written, rather than asking for ever.
        abandon: () => void keep(withReaches(base, week, []))
      })
      return
    }
    const { arrived, cards } = outcome.data
    if (arrived.length > 0) useAudioStore.getState().play('text_in')
    let next = withReaches(
      cards ? { ...base, cards: { ...base.cards, ...cards } } : base,
      week,
      arrived
    )
    for (const sent of arrived) {
      if (sent.invites && invitable(next, sent.charId)) next = withInvite(next, sent.charId, ended)
    }
    await keep(next)
  }

  /** Closes a break nobody played on memories written for it, and opens them to be reworded. */
  async function writeUnplayed(base: BreakDraft): Promise<void> {
    if (!from) return
    setWriting(true)
    const outcome = await writeBreakMemories(from)
    setWriting(false)
    if (outcome.status === 'cancelled') return
    if (outcome.status === 'failed') {
      setFailure({
        error: outcome.error,
        title: "Couldn't write the break",
        retry: () => void writeUnplayed(base)
      })
      return
    }
    await keep(withBreakClosed(base, outcome.data))
    if (cast.length > 0) setEditing(true)
  }

  /** Closes a played break on what happened in it, and opens those memories to be reworded. */
  async function closePlayed(base: BreakDraft): Promise<void> {
    if (!from) return
    // Somebody he had no way of writing to cannot mind not having heard from him.
    const standings = Object.fromEntries(
      Object.entries(breakStandings(from)).map(([charId, standing]) => [
        charId,
        canText(from, charId) ? standing : { disposition: 'neutral' as const, lover: false }
      ])
    )
    await keep(withBreakClosed(base, playedMemories(base, standings, ended)))
    if (cast.length > 0) setEditing(true)
  }

  /** Ends the break where it stands: by what happened in it, or written for him where nothing did. */
  function finish(base: BreakDraft): void {
    if (breakPlayed(base) || breakSpent(base, ended)) void closePlayed(base)
    else void writeUnplayed(base)
  }

  /** Lets the slot go by, and closes the break when it was the last one. */
  function rest(): void {
    if (!draft || dead) return
    const next = withSlotSpent(draft, ended)
    if (breakSpent(next, ended)) void keep(next).then(() => closePlayed(next))
    else void keep(next)
  }

  /** Asks for her reply to his newest text, and for the judgement where that reply ended it. */
  async function answer(base: BreakDraft): Promise<void> {
    if (!from) return
    setPhase('replying')
    const outcome = await replyToTalk(from, base)
    if (outcome.status === 'cancelled') return
    const said =
      outcome.status === 'done' && outcome.data.messages.some((text) => text.trim() !== '')
    if (outcome.status === 'failed' || !said) {
      setPhase('idle')
      setFailure({
        error:
          outcome.status === 'failed'
            ? outcome.error
            : appError('LLM_EMPTY', 'Her reply came back empty.'),
        title: "Couldn't send the text",
        retry: () => void answer(base)
      })
      return
    }
    const next = withReply(base, outcome.data.messages, outcome.data.leaving)
    await keep(next)
    if (openTalk(next)?.ended) await judge(next)
    else setPhase('idle')
  }

  /** Asks what the conversation that has just ended came to, which is what closes it. */
  async function judge(base: BreakDraft): Promise<void> {
    if (!from) return
    setPhase('judging')
    const outcome = await judgeTalk(from, base)
    if (outcome.status === 'cancelled') return
    setPhase('idle')
    if (outcome.status === 'failed') {
      setFailure({
        error: outcome.error,
        title: "Couldn't end the conversation",
        retry: () => void judge(base)
      })
      return
    }
    const judged = withTalkJudged(base, outcome.data)
    const charId = openTalk(base)?.charId
    // An invitation is hers to make only where she may, whatever the reply claims.
    const next =
      charId && outcome.data.invited && invitable(judged, charId)
        ? withInvite(judged, charId, ended)
        : judged
    setShown(judged.talks[judged.talks.length - 1] ?? null)
    await keep(next)
  }

  /**
   * His next text to whoever the panel is up for. The first one of a break asks for everybody's
   * cards before anything is spent, and the first one of a conversation spends the slot.
   */
  async function send(charId: string, text: string): Promise<void> {
    if (!from || !draft) return
    if (openTalk(draft)) {
      const next = withPlayerLine(draft, text)
      if (next === draft) return
      await keep(next)
      await answer(next)
      return
    }

    let base = draft
    if (!base.cards?.[charId]) {
      setPhase('replying')
      const outcome = await writeBreakCards(from)
      if (outcome.status === 'cancelled') return
      if (outcome.status === 'failed' || !outcome.data[charId]) {
        setPhase('idle')
        setFailure({
          error:
            outcome.status === 'failed'
              ? outcome.error
              : appError('LLM_MALFORMED', 'The break came back without her in it.'),
          title: "Couldn't send the text",
          retry: () => void send(charId, text)
        })
        return
      }
      base = { ...base, cards: { ...base.cards, ...outcome.data } }
    }
    const next = withTalkStarted(base, charId, text, ended)
    await keep(next)
    if (openTalk(next)) await answer(next)
    else setPhase('idle')
  }

  /** Ends the open conversation himself, and has it judged. */
  function leave(): void {
    if (!draft) return
    const next = withTalkLeft(draft)
    if (next === draft) return
    void keep(next).then(() => judge(next))
  }

  /** Puts the conversation panel away, and closes the break where that was its last slot. */
  function closeTalk(): void {
    setTalking(null)
    setShown(null)
    if (draft && !breakOver(draft) && !openTalk(draft) && breakSpent(draft, ended)) {
      void closePlayed(draft)
    }
  }

  /**
   * Spends the slot on himself. Nothing is spent until what he did has been written: the slot,
   * the telling of it and what it did for his stats are filed in one go.
   */
  async function spendAlone(action: string): Promise<void> {
    if (!from || !draft) return
    setAlone(false)
    setAloneWriting(true)
    const outcome = await spendTimeAlone(from, draft, action)
    setAloneWriting(false)
    if (outcome.status === 'cancelled') return
    if (outcome.status === 'failed') {
      setFailure({
        error: outcome.error,
        title: "Couldn't write it",
        retry: () => void spendAlone(action)
      })
      return
    }
    const next = withTimeAlone(draft, action, outcome.data.lines, outcome.data.exercised, ended)
    setAloneSpent(next.alone?.[next.alone.length - 1] ?? null)
    await keep(next)
  }

  /** The telling has been read: closes the break where that was its last slot. */
  function closeAlone(): void {
    setAloneSpent(null)
    if (draft && !breakOver(draft) && breakSpent(draft, ended)) void closePlayed(draft)
  }

  /** The reworded memories, kept. */
  function saveMemories(memories: Record<string, BreakMemory[]>): void {
    setEditing(false)
    if (!draft) return
    void keep(withBreakClosed(draft, memories))
  }

  /** On to the roster of the next semester, handing it how the break went. */
  function toRoster(): void {
    if (!from || !draft?.memories) return
    stageContinuation({
      ...from,
      played: {
        stats: draft.stats,
        memories: draft.memories,
        talks: draft.talks.filter((talk) => talk.verdict !== undefined),
        reaches: draft.reaches ?? [],
        visits: draft.visits ?? []
      }
    })
    setView('newGame')
  }

  /** Whether she has sent something he has not answered, and whether he has opened it. */
  function wroteOf(charId: string): 'new' | 'seen' | null {
    const reach = draft ? unansweredReach(draft, charId) : null
    return reach ? (reach.read ? 'seen' : 'new') : null
  }

  /** Puts her conversation panel up, which is what reads anything she has sent. */
  function openTalkPanel(charId: string): void {
    setTalking(charId)
    if (!draft) return
    const next = withReachRead(draft, charId)
    if (next !== draft) void keep(next)
  }

  // What the booked trip asks of the slot being played, and who it is to see.
  const step = draft && !over ? tripStep(draft) : null
  const away = step !== null
  const trip = draft && !over ? activeTrip(draft) : null
  const tripName = trip ? (from.characters[trip.charId]?.firstName ?? 'her') : ''
  const inviters = draft
    ? faces.filter((c) => openInvite(draft, c.charId) !== null).map((c) => c.firstName)
    : []
  // Who has written and not been opened yet, for the line over the faces.
  const unread = faces.filter((c) => wroteOf(c.charId) === 'new').map((c) => c.firstName)

  const talkingTo = talking ? cast.find((c) => c.charId === talking) : undefined
  const open = draft ? openTalk(draft) : null
  const panelTalk = open ?? shown

  return (
    <div className="vu-break" data-theme={theme}>
      {/* The screen's idle: the arch arrives and then breathes, both on the one variant. */}
      <motion.div className="vu-break-decor" variants={decorIn} initial="hidden" animate="shown" />

      <motion.header
        className="vu-break-header"
        variants={HEADER_IN}
        initial="hidden"
        animate="shown"
      >
        <motion.button
          className="vu-circle vu-break-back"
          aria-label="Main Menu"
          {...gestures(false, quietLift, quietPress)}
          onClick={() => setView('mainMenu')}
        >
          <BackIcon />
        </motion.button>

        <div className="vu-title">
          <h1 className="vu-title-text">{titled(words.endBreak)}</h1>
        </div>

        <motion.button
          id="break-menu"
          className="vu-pill vu-break-menu"
          {...gestures(false, quietLift, quietPress)}
          onClick={() => setMenu(true)}
        >
          Menu
        </motion.button>

      </motion.header>

      <motion.section
        className="vu-break-reader"
        variants={READER_IN}
        initial="hidden"
        animate="shown"
      >
        {draft && (
          <BreakCalendar
            spent={draft.spent}
            booked={over ? [] : tripSlotsAhead(draft)}
            ended={ended}
            over={over}
          />
        )}
        {draft && (
          <div className="vu-break-statpanel vu-paper">
            <StatRadar className="vu-break-radar" stats={draft.stats} arrival={{}} />
          </div>
        )}
      </motion.section>

      {faces.length > 0 ? (
        <>
          {!over && (
            <p className="vu-hint vu-break-hint">
              {step
                ? step.kind === 'out'
                  ? `It is time to leave for ${tripName}'s.`
                  : step.kind === 'back'
                    ? `It is time to travel home from ${tripName}'s.`
                    : `You are staying with ${tripName}.`
                : trip
                  ? `You leave to see ${tripName} once this slot is spent.`
                  : inviters.length > 0
                    ? `${listed(inviters)} invited you to come and stay. Open her messages to answer; it costs nothing, and she will wait.`
                    : unread.length > 0
                      ? `${listed(unread)} wrote to you. Reading is free and there is no rush: she will wait for an answer, this week or a later one.`
                      : 'Click somebody to text her.'}
            </p>
          )}
          <motion.ul
            // Dealt again when a trip takes the screen or gives it back.
            key={step ? 'away' : 'home'}
            className={`vu-break-grid${step ? ' vu-break-grid--away' : ''}`}
            variants={GRID_IN}
            initial="hidden"
            animate="shown"
          >
            {/* Away, the screen is hers alone: nobody else is there to be written to. */}
            {(step ? faces.filter((c) => c.charId === step.charId) : faces).map((character) => (
              <BreakFace
                key={character.charId}
                character={character}
                texted={draft?.talks.filter((talk) => talk.charId === character.charId).length ?? 0}
                // A girl he cannot reach, and anybody once the slots are gone, is only a face.
                opens={!over && !spent && !dead && !away && canText(from, character.charId)}
                invited={draft !== null && openInvite(draft, character.charId) !== null}
                // Whatever she sent before he arrived, she has since said to his face.
                wrote={step ? null : wroteOf(character.charId)}
                tag={tags[character.charId]}
                onOpen={() => openTalkPanel(character.charId)}
              />
            ))}
            {step && (
              <motion.li className="vu-break-trip" variants={dealtItem}>
                <ol className="vu-break-legs">
                  {TRIP_LEGS.map((leg, index) => {
                    const at = TRIP_LEGS.findIndex(
                      (other) => other.kind === step.kind && (other.day ?? 1) === (step.day ?? 1)
                    )
                    return (
                      <li
                        key={index}
                        className={`vu-break-leg${index < at ? ' vu-break-leg--done' : index === at ? ' vu-break-leg--now' : ''}`}
                        aria-current={index === at ? 'step' : undefined}
                      >
                        {leg.words(tripName)}
                      </li>
                    )
                  })}
                </ol>
              </motion.li>
            )}
          </motion.ul>
        </>
      ) : (
        <p className="vu-empty vu-break-empty">Nobody he knows by name is coming back.</p>
      )}

      <motion.footer className="vu-break-foot" variants={FOOT_IN} initial="hidden" animate="shown">
        {(writing || checking) && (
          <span className="vu-break-writing">
            <motion.span className="vu-ring" animate={spin} />
            {writing ? 'Writing the break' : 'Checking your phone'}
          </span>
        )}

        <div className="vu-foot">
          {over ? (
            <>
              {cast.length > 0 && (
                <motion.button
                  id="break-edit-memories"
                  className="vu-btn vu-btn--outline vu-btn--panel vu-paper"
                  {...gestures(false, lift, press)}
                  onClick={() => setEditing(true)}
                >
                  Edit memories
                </motion.button>
              )}
              <motion.button
                id="break-to-roster"
                className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
                {...gestures(false, lift, press)}
                onClick={toRoster}
              >
                Choose the roster
                <ChevronIcon />
              </motion.button>
            </>
          ) : spent ? (
            <motion.button
              id="break-finish"
              className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
              {...gestures(dead, lift, press)}
              disabled={dead}
              onClick={() => draft && finish(draft)}
            >
              Finish the break
            </motion.button>
          ) : step ? (
            <motion.button
              id="break-trip"
              className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
              {...gestures(dead, lift, press)}
              disabled={dead}
              onClick={takeTrip}
            >
              {step.kind === 'out'
                ? `Leave to see ${tripName}`
                : step.kind === 'back'
                  ? 'Travel home'
                  : `Spend the ${step.day === 1 ? 'first' : 'last'} days with ${tripName}`}
              <ChevronIcon />
            </motion.button>
          ) : (
            <>
              <motion.button
                id="break-skip"
                className="vu-btn vu-btn--outline vu-btn--panel vu-paper"
                {...gestures(dead, lift, press)}
                disabled={dead}
                onClick={() => setConfirmingSkip(true)}
              >
                {played ? 'End the break here' : 'Skip the break'}
              </motion.button>
              <motion.button
                id="break-alone-open"
                className="vu-btn vu-btn--outline vu-btn--panel vu-paper"
                {...gestures(dead, lift, press)}
                disabled={dead}
                onClick={() => setAlone(true)}
              >
                Time to yourself
              </motion.button>
              <motion.button
                id="break-rest"
                className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
                {...gestures(dead, lift, press)}
                disabled={dead}
                onClick={rest}
              >
                Let the slot pass
              </motion.button>
            </>
          )}
        </div>
      </motion.footer>

      <AnimatePresence>
        {menu && (
          <GameMenuModal
            key="menu"
            theme={theme}
            onClose={() => setMenu(false)}
            // The break keeps itself: it is written after everything done in it, and has no
            // slots of its own to save into.
            saveOffer="none"
            onSaveGame={() => setMenu(false)}
            onLoadGame={() => {
              setMenu(false)
              openModal('loadGame')
            }}
            onFeedback={() => {
              setMenu(false)
              openModal('feedback')
            }}
            onSettings={() => {
              setMenu(false)
              openModal('settings')
            }}
            onLeave={() => setView('mainMenu')}
            // The browser has no window of its own to close, so it is offered no way out.
            onQuit={isWebBuild() ? undefined : () => void window.api.app.quit()}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmingSkip && (
          <ConfirmModal
            key="skip"
            id="break-skip-confirm"
            theme={theme}
            title={played ? 'End the break here?' : 'Skip the break?'}
            message={
              played
                ? `The rest of ${words.endBreakSpan} goes by without another word from you. Anybody close to you that you never wrote to will remember it, and so will anybody you promised something and did not come back to.`
                : `The rest of ${words.endBreakSpan} goes by without you, and what everybody remembers of it is written for you. You can reword it before the semester starts.`
            }
            confirmText={played ? 'End the break here' : 'Skip the break'}
            cancelText="Cancel"
            onConfirm={() => {
              setConfirmingSkip(false)
              if (draft) finish(draft)
            }}
            onCancel={() => setConfirmingSkip(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {talkingTo && draft && !failure && (
          <BreakTalkModal
            key="talk"
            theme={theme}
            character={talkingTo}
            week={breakClock(panelTalk?.slot ?? draft.spent.length, ended).week}
            talk={panelTalk?.charId === talkingTo.charId ? panelTalk : null}
            opening={unansweredReach(draft, talkingTo.charId)?.lines ?? []}
            invite={
              openInvite(draft, talkingTo.charId) && !over
                ? {
                    // A yes is refused while another trip is booked or the break has not the room.
                    bookable: activeTrip(draft) === null && tripDeparture(draft, ended) !== null,
                    busy: activeTrip(draft) !== null,
                    leaves: breakClock(tripDeparture(draft, ended) ?? 0, ended).week
                  }
                : null
            }
            onInvite={(accept) => answerInvite(talkingTo.charId, accept)}
            phase={phase}
            onSend={(text) => void send(talkingTo.charId, text)}
            onLeave={leave}
            onClose={closeTalk}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {telling && !failure && (
          <BreakNarration
            key="told"
            lines={travel ? travel.lines : aloneSpent ? aloneLines(aloneSpent) : null}
            onDone={travel ? closeTravel : closeAlone}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {alone && draft && !failure && (
          <BreakAloneModal
            key="alone"
            theme={theme}
            week={breakClock(draft.spent.length, ended).week}
            slot={draft.spent.length}
            ended={ended}
            stats={draft.stats}
            onStart={(action) => void spendAlone(action)}
            onClose={() => setAlone(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {failure && (
          <LlmFailureModal
            key="failure"
            id="break-failure"
            theme={theme}
            error={failure.error}
            title={failure.title}
            retryMessage="Retry sends the same request."
            cancelText="Cancel"
            onRetry={() => {
              const { retry } = failure
              setFailure(null)
              retry()
            }}
            onAbandon={() => {
              const { abandon } = failure
              setFailure(null)
              abandon?.()
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editing && draft?.memories && (
          <BreakMemoriesModal
            key="memories"
            theme={theme}
            cast={cast}
            nameKnown={nameKnown}
            memories={draft.memories}
            onSave={saveMemories}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * The break as a row of its weeks, each under the date it starts on with its two slots as
 * boxes: ticked where the slot went on a conversation, struck where it was let go by, and the
 * week being played picked out.
 */
/** The four slots of a trip in order, as the screen lists them while he is away. */
const TRIP_LEGS: readonly { kind: 'out' | 'visit' | 'back'; day?: 1 | 2; words: (name: string) => string }[] = [
  { kind: 'out', words: (name) => `Travel out to ${name}` },
  { kind: 'visit', day: 1, words: (name) => `The first days with ${name}` },
  { kind: 'visit', day: 2, words: (name) => `The last days with ${name}` },
  { kind: 'back', words: () => 'Travel home' }
]

/** A plane, for a slot spent on the road. */
function PlaneIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  )
}

/** What each state of a slot's box is called. */
const SLOT_WORDS: Record<BreakEntry['kind'] | 'next' | 'booked' | 'open', string> = {
  text: 'Spent texting',
  alone: 'Spent on himself',
  rest: 'Let go by',
  travel: 'Spent travelling',
  visit: 'Spent with her',
  next: 'The slot being spent',
  booked: 'Taken by a trip',
  open: 'Not yet spent'
}

function BreakCalendar({
  spent,
  booked,
  ended,
  over
}: {
  spent: readonly BreakEntry[]
  /** The slots a booked trip has still to take, by index. */
  booked: readonly number[]
  ended: Season
  over: boolean
}): JSX.Element {
  const weeks = breakWeeks(ended)
  const current = over ? -1 : breakClock(spent.length, ended).week - 1
  // The weeks are dated against the semester they lead up to.
  const coming: Season = ended === 'spring' ? 'fall' : 'spring'

  return (
    <ol className="vu-break-weeks" aria-label="The weeks of the break">
      {Array.from({ length: weeks }, (_, week) => (
        <li
          key={week}
          className={`vu-slot vu-break-week${week === current ? ' vu-slot--on' : ''}`}
          aria-current={week === current ? 'step' : undefined}
        >
          <span className="vu-slot-half">
            {formatShortGameDate(breakSlotDate(week * BREAK_SLOTS_PER_WEEK, ended).date - 1, coming)}
          </span>
          <span className="vu-break-boxes">
            {Array.from({ length: BREAK_SLOTS_PER_WEEK }, (_, half) => {
              const slot = week * BREAK_SLOTS_PER_WEEK + half
              const entry = spent[slot]
              const state = entry
                ? entry.kind
                : !over && slot === spent.length
                  ? 'next'
                  : booked.includes(slot)
                    ? 'booked'
                    : 'open'
              return (
                <span
                  key={half}
                  className={`vu-break-box vu-break-box--${state}${
                    state === 'next' && booked.includes(slot) ? ' vu-break-box--booked' : ''
                  }`}
                  aria-label={SLOT_WORDS[state]}
                >
                  {state === 'text' || state === 'alone' || state === 'visit' ? (
                    <CheckIcon />
                  ) : state === 'travel' ? (
                    <PlaneIcon />
                  ) : null}
                </span>
              )
            })}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Names as a sentence lists them: "Ami", "Ami and Lili", "Ami, Lili and Gwen". */
function listed(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** One girl who is coming back: her archway and her name, and how often he has written to her. */
function BreakFace({
  character,
  texted,
  wrote,
  invited,
  tag,
  opens,
  onOpen
}: {
  /** Whether an invitation of hers is waiting on his answer. */
  invited: boolean
  /** What the reader calls her, as her contact page says it. */
  tag: string | undefined
  character: Character
  texted: number
  /** Whether she has sent something he has not answered, and whether he has opened it. */
  wrote: 'new' | 'seen' | null
  opens: boolean
  onOpen: () => void
}): JSX.Element {
  const face = (
    <>
      <div className="vu-arch vu-break-arch vu-paper">
        <div className="vu-crop vu-card-crop">
          <img className="vu-card-sprite" src={spriteUrl(character.charId, 'neutral')} alt="" />
        </div>
      </div>
      <CardCaption character={character} />
    </>
  )

  return (
    <motion.li className="vu-card" variants={dealtItem} {...hovered(!opens, cardLift)}>
      {opens ? (
        <motion.button className="vu-card-face" whileTap={press} onClick={onOpen}>
          {face}
        </motion.button>
      ) : (
        <div className="vu-card-face">{face}</div>
      )}
      {tag && (
        <span className="vu-bb-tag vu-break-tag" data-tag={tag.toLowerCase().replace(/\s+/g, '-')}>
          {tag}
        </span>
      )}
      {invited ? (
        <span className="vu-sticker vu-sticker--accent vu-break-wrote">Invited you</span>
      ) : (
        wrote && (
          <span
            className={`vu-sticker vu-break-wrote${wrote === 'new' ? ' vu-sticker--accent' : ''}`}
          >
            {wrote === 'new' ? 'New text' : 'Wrote you'}
          </span>
        )
      )}
      {texted > 0 && (
        <span className="vu-sticker vu-break-texted">
          {texted === 1 ? 'Texted' : `Texted ${texted}`}
        </span>
      )}
    </motion.li>
  )
}
