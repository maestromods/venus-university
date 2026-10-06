import { describe, expect, it } from 'vitest'
import { validateRecord } from '@shared/jsonValidate'
import { pointsForTier } from '@shared/playerStats'
import {
  BREAK_READ,
  breakClock,
  breakOver,
  breakPlayed,
  breakSlotDate,
  breakSlots,
  breakSpent,
  openBreak,
  mayInvite,
  openTalk,
  pendingReachWeek,
  playedMemories,
  reachOutDue,
  stampBreak,
  TALK_TURNS,
  withBreakClosed,
  withBreakThreads,
  tripStep,
  withInvite,
  withInviteAnswered,
  withPlayerLine,
  withReaches,
  withReply,
  withSlotSpent,
  withTimeAlone,
  withTravel,
  withVisit,
  withTalkJudged,
  withTalkLeft,
  withTalkStarted,
  type BreakDraft,
  type BreakStanding,
  type TalkJudgement
} from '@shared/termBreak'
import type { TermCarry } from '@shared/termTypes'
import { emptyBunnyboard, type CharState } from '@shared/types'

/**
 * The break played between two semesters. The next semester's opening save is computed from how
 * it closed, so a slot spent past its end, a conversation counted before it was judged or a
 * memory kept after the player blanked it would be carried into a semester that never saw it
 * happen.
 */

/** A fresh break after a spring. */
function fresh(): BreakDraft {
  return openBreak({ stats: { brain: 0, body: 0, heart: 0 } })
}

/** A break with `count` slots let go by. */
function rested(count: number): BreakDraft {
  let draft = fresh()
  for (let i = 0; i < count; i++) draft = withSlotSpent(draft, 'spring')
  return draft
}

/** A judgement that says nothing but its verdict, with whatever is laid over it. */
function judgement(over: Partial<TalkJudgement> = {}): TalkJudgement {
  return {
    verdict: 'neutral',
    reason: 'Nothing changed.',
    summary: 'They texted.',
    memories: [],
    promisesMade: [],
    promisesKept: [],
    promisesBroken: [],
    ...over
  }
}

/** One whole conversation with `charId`: a text, her reply, his goodbye, and the judgement. */
function talked(draft: BreakDraft, charId: string, over: Partial<TalkJudgement> = {}): BreakDraft {
  const started = withTalkStarted(draft, charId, 'hey', 'spring')
  return withTalkJudged(withTalkLeft(withReply(started, ['hi'], false)), judgement(over))
}

const close: BreakStanding = { disposition: 'trusted', lover: false }
const distant: BreakStanding = { disposition: 'neutral', lover: false }
const lover: BreakStanding = { disposition: 'devoted', lover: true }

describe('openBreak', () => {
  it('opens on the reader a tier down in everything, with nothing spent', () => {
    const draft = openBreak({
      stats: { brain: pointsForTier(3) + 4, body: pointsForTier(2), heart: pointsForTier(1) }
    })
    expect(draft).toEqual({
      stats: { brain: pointsForTier(2), body: pointsForTier(1), heart: pointsForTier(1) },
      spent: [],
      talks: [],
      promises: {}
    })
  })
})

describe('the break clock', () => {
  it('runs two slots to a week, twelve weeks after a spring and four after a fall', () => {
    expect(breakSlots('spring')).toBe(24)
    expect(breakSlots('fall')).toBe(8)
    expect(breakClock(0, 'spring')).toEqual({ week: 1, slot: 1 })
    expect(breakClock(3, 'spring')).toEqual({ week: 2, slot: 2 })
    expect(breakClock(23, 'spring')).toEqual({ week: 12, slot: 2 })
  })

  it('stays on the last slot once every one is spent', () => {
    expect(breakClock(8, 'fall')).toEqual({ week: 4, slot: 2 })
  })

  it('dates every slot before the new semester and after the old one', () => {
    for (const [ended, gap] of [
      ['spring', 88],
      ['fall', 33]
    ] as const) {
      const dates = Array.from({ length: breakSlots(ended) }, (_, slot) =>
        breakSlotDate(slot, ended).date
      )
      expect(Math.max(...dates)).toBeLessThan(0)
      expect(Math.min(...dates)).toBeGreaterThan(-gap)
      expect([...dates].sort((a, b) => a - b)).toEqual(dates)
    }
  })
})

describe('spending a slot', () => {
  it('spends none past the last one', () => {
    const full = rested(24)
    expect(breakSpent(full, 'spring')).toBe(true)
    expect(withSlotSpent(full, 'spring')).toBe(full)
    expect(withTalkStarted(full, 'a', 'hey', 'spring')).toBe(full)
  })

  it('spends none once the break is over', () => {
    const closed = withBreakClosed(rested(2), {})
    expect(breakOver(closed)).toBe(true)
    expect(withSlotSpent(closed, 'spring')).toBe(closed)
  })

  it('spends none while a conversation is open', () => {
    const started = withTalkStarted(fresh(), 'a', 'hey', 'spring')
    expect(started.spent).toEqual([{ kind: 'text', charId: 'a' }])
    expect(withSlotSpent(started, 'spring')).toBe(started)
    expect(withTalkStarted(started, 'b', 'hey', 'spring')).toBe(started)
  })

  it('spends nothing on a blank first text', () => {
    const draft = fresh()
    expect(withTalkStarted(draft, 'a', '   ', 'spring')).toBe(draft)
  })
})

describe('a slot spent alone', () => {
  it('pays every stat it exercised twice over, as an hour alone does in a semester', () => {
    const draft = withTimeAlone(
      fresh(),
      ' ran every morning ',
      ['You run.', '  ', 'You read on the porch.'],
      { body: true, brain: true },
      'spring'
    )
    expect(draft.stats).toEqual({ brain: 2, body: 2, heart: 0 })
    expect(draft.spent).toEqual([{ kind: 'alone' }])
    expect(draft.alone).toEqual([
      {
        slot: 0,
        action: 'ran every morning',
        lines: ['You run.', 'You read on the porch.'],
        exercised: { brain: true, body: true, heart: false }
      }
    ])
  })

  it('spends the slot and pays nothing where it exercised nothing', () => {
    const draft = withTimeAlone(fresh(), 'slept in', ['You sleep in.'], {}, 'spring')
    expect(draft.stats).toEqual({ brain: 0, body: 0, heart: 0 })
    expect(draft.spent).toHaveLength(1)
  })

  it('is refused with nothing said, with a conversation open, and with no slot left', () => {
    const draft = fresh()
    expect(withTimeAlone(draft, '  ', ['x'], { body: true }, 'spring')).toBe(draft)
    const talking = withTalkStarted(draft, 'a', 'hey', 'spring')
    expect(withTimeAlone(talking, 'ran', ['x'], { body: true }, 'spring')).toBe(talking)
    const full = rested(24)
    expect(withTimeAlone(full, 'ran', ['x'], { body: true }, 'spring')).toBe(full)
  })

  it('makes the break one that was played, as a conversation does and a slot let go does not', () => {
    expect(breakPlayed(rested(3))).toBe(false)
    expect(breakPlayed(withTimeAlone(fresh(), 'ran', ['x'], {}, 'spring'))).toBe(true)
    expect(breakPlayed(talked(fresh(), 'a'))).toBe(true)
  })
})

describe('a conversation', () => {
  it('takes his texts one at a time, each after her reply', () => {
    const started = withTalkStarted(fresh(), 'a', 'hey', 'spring')
    // Her reply is owed, so a second text of his is refused.
    expect(withPlayerLine(started, 'you there?')).toBe(started)
    const replied = withReply(started, [' hi ', ''], false)
    expect(openTalk(replied)?.lines).toEqual([
      { sender: 'player', text: 'hey' },
      { sender: 'contact', text: 'hi' }
    ])
    expect(openTalk(withPlayerLine(replied, 'how is home'))?.lines).toHaveLength(3)
  })

  it('ends on her reply to his last turn, and takes no text after it', () => {
    let draft = withTalkStarted(fresh(), 'a', 'one', 'spring')
    for (let turn = 2; turn <= TALK_TURNS; turn++) {
      draft = withPlayerLine(withReply(draft, ['ok'], false), `text ${turn}`)
    }
    const ended = withReply(draft, ['bye'], false)
    expect(openTalk(ended)?.ended).toBe('cap')
    expect(withPlayerLine(ended, 'wait')).toBe(ended)
  })

  it('ends early when she leaves, or when he does once she has answered', () => {
    const started = withTalkStarted(fresh(), 'a', 'hey', 'spring')
    expect(withTalkLeft(started)).toBe(started)
    expect(openTalk(withReply(started, ['i have to go'], true))?.ended).toBe('her')
    expect(openTalk(withTalkLeft(withReply(started, ['hi'], false)))?.ended).toBe('player')
  })

  it('is not judged before it has ended', () => {
    const replied = withReply(withTalkStarted(fresh(), 'a', 'hey', 'spring'), ['hi'], false)
    expect(withTalkJudged(replied, judgement())).toBe(replied)
  })
})

describe('the judgement', () => {
  const liked = { type: 'liked', desc: 'the reader asked about her audition' } as const
  const loved = { type: 'loved', desc: 'the reader remembered her birthday' } as const
  const hated = { type: 'hated', desc: 'the reader laughed at her plan' } as const

  it('keeps two memories at most, and none against its own verdict', () => {
    const draft = talked(fresh(), 'a', {
      verdict: 'warmer',
      memories: [liked, hated, liked, liked]
    })
    expect(draft.talks[0].memories).toEqual([liked, liked])
    expect(openTalk(draft)).toBeNull()
  })

  it('turns a strong memory mild until the conversation before went the same way', () => {
    const once = talked(fresh(), 'a', { verdict: 'warmer', memories: [loved] })
    expect(once.talks[0].memories).toEqual([{ ...loved, type: 'liked' }])
    const twice = talked(once, 'a', { verdict: 'warmer', memories: [loved] })
    expect(twice.talks[1].memories).toEqual([loved])
    // Somebody else's good conversation in between changes nothing for her.
    const turned = talked(talked(once, 'b', { verdict: 'warmer' }), 'a', {
      verdict: 'cooler',
      memories: [hated]
    })
    expect(turned.talks[2].memories).toEqual([{ ...hated, type: 'disliked' }])
  })

  it('files a promise he makes, and marks the open ones it says he kept or broke', () => {
    const made = talked(fresh(), 'a', { promisesMade: ['call her on Sunday', 'send the photos'] })
    expect(made.promises.a.map((p) => p.state)).toEqual(['open', 'open'])
    // Saying one of them again owes her nothing new.
    const again = talked(made, 'a', { promisesMade: ['Call her on Sunday'] })
    expect(again.promises.a).toHaveLength(2)
    const kept = talked(made, 'a', { promisesKept: [0] })
    expect(kept.promises.a.map((p) => p.state)).toEqual(['kept', 'open'])
    // The numbers count the promises still open, so 0 is now the photos.
    const broken = talked(kept, 'a', { promisesBroken: [0] })
    expect(broken.promises.a.map((p) => p.state)).toEqual(['kept', 'broken'])
  })
})

describe('playedMemories', () => {
  it('holds silence against somebody close after a summer, and nobody else', () => {
    const memories = playedMemories(fresh(), { near: close, far: distant }, 'spring')
    expect(memories.near).toEqual([
      { type: 'disliked', desc: 'the reader did not write to her once all summer' }
    ])
    expect(memories.far).toEqual([])
  })

  it('holds a silent winter break against a lover only', () => {
    const memories = playedMemories(fresh(), { near: close, hers: lover }, 'fall')
    expect(memories.near).toEqual([])
    expect(memories.hers).toHaveLength(1)
  })

  it('clears the silence with one conversation, whatever came of it', () => {
    const draft = talked(fresh(), 'near')
    expect(playedMemories(draft, { near: close }, 'spring').near).toEqual([])
  })

  it('remembers one promise he never kept, and none he did', () => {
    const made = talked(fresh(), 'a', { promisesMade: ['call her on Sunday', 'send the photos'] })
    expect(playedMemories(made, { a: distant }, 'spring').a).toEqual([
      {
        type: 'disliked',
        desc: 'the reader promised to call her on Sunday and never did'
      }
    ])
    const kept = talked(made, 'a', { promisesKept: [0, 1] })
    expect(playedMemories(kept, { a: distant }, 'spring').a).toEqual([])
  })

  it('counts nothing from a conversation that was never judged', () => {
    const open = withReply(withTalkStarted(fresh(), 'a', 'hey', 'spring'), ['hi'], false)
    expect(playedMemories(open, { a: distant }, 'spring').a).toEqual([])
  })

  it('keeps the newest five of what she was left with', () => {
    let draft = fresh()
    for (let i = 0; i < 4; i++) {
      draft = talked(draft, 'a', {
        verdict: 'warmer',
        memories: [
          { type: 'liked', desc: `first of ${i}` },
          { type: 'liked', desc: `second of ${i}` }
        ]
      })
    }
    const kept = playedMemories(draft, { a: close }, 'spring').a
    expect(kept.map((memory) => memory.desc)).toEqual([
      'second of 1',
      'first of 2',
      'second of 2',
      'first of 3',
      'second of 3'
    ])
  })
})

describe('withBreakClosed', () => {
  it('drops a memory the player blanked and keeps the girl it was about', () => {
    const closed = withBreakClosed(rested(1), {
      a: [
        { type: 'liked', desc: '  the reader called her every Sunday ' },
        { type: 'hated', desc: '   ' }
      ],
      b: [{ type: 'loved', desc: '' }]
    })
    expect(closed.memories).toEqual({
      a: [{ type: 'liked', desc: 'the reader called her every Sunday' }],
      b: []
    })
    expect(closed.spent).toHaveLength(1)
  })
})

describe('withBreakThreads', () => {
  const state: CharState = {
    memories: [],
    flags: {} as CharState['flags'],
    nameKnown: true
  }

  it('files each conversation on her thread, dated on its slot, after what was there', () => {
    const board = emptyBunnyboard()
    board.conversations.a = {
      charId: 'a',
      messages: [{ id: 'old', sender: 'contact', text: 'see you', date: -90, time: 1 }],
      unread: 0,
      summary: 'They said goodbye.'
    }
    const carry = { bunnyboard: board, charInfo: { a: state, b: state } } as unknown as TermCarry
    const draft = talked(talked(rested(1), 'a'), 'gone')

    const filed = withBreakThreads(carry, draft.talks, 'spring')
    const thread = filed.bunnyboard.conversations.a
    expect(thread.summary).toBe('They said goodbye.')
    expect(thread.messages.map((m) => [m.sender, m.text, m.date, m.time])).toEqual([
      ['contact', 'see you', -90, 1],
      ['player', 'hey', breakSlotDate(1, 'spring').date, 1],
      ['contact', 'hi', breakSlotDate(1, 'spring').date, 1]
    ])
    // Somebody who is not coming back has no thread to file it on.
    expect(filed.bunnyboard.conversations.gone).toBeUndefined()
    expect(carry.bunnyboard.conversations.a.messages).toHaveLength(1)
  })
})

describe('the break record', () => {
  it('reads back what was stamped, and refuses another version', () => {
    const stamped = stampBreak(talked(rested(3), 'a'), 1000)
    expect(validateRecord(JSON.parse(JSON.stringify(stamped)), 'here', BREAK_READ)).toEqual(
      stamped
    )
    expect(() =>
      validateRecord({ ...stamped, schemaVersion: stamped.schemaVersion + 1 }, 'here', BREAK_READ)
    ).toThrow(/unsupported schemaVersion/)
  })
})

describe('what the girls send on their own', () => {
  const fresh: BreakDraft = {
    stats: { brain: 0, body: 0, heart: 0 },
    spent: [],
    talks: [],
    promises: {}
  }

  it('asks for a week once, and never over an open conversation or a finished break', () => {
    expect(pendingReachWeek(fresh, 'spring')).toBe(1)
    const asked = withReaches(fresh, 1, [])
    expect(pendingReachWeek(asked, 'spring')).toBeNull()
    const second = withSlotSpent(withSlotSpent(asked, 'spring'), 'spring')
    expect(pendingReachWeek(second, 'spring')).toBe(2)
    const talking = withTalkStarted(second, 'a', 'hey', 'spring')
    expect(pendingReachWeek(talking, 'spring')).toBeNull()
    expect(pendingReachWeek(withBreakClosed(second, {}), 'spring')).toBeNull()
  })

  it('opens his reply on her texts, answers them, and files only the unanswered on the phone', () => {
    const written = withReaches(fresh, 2, [
      { charId: 'a', lines: ['hey stranger', ' '] },
      { charId: 'b', lines: ['you alive?'] },
      { charId: 'c', lines: ['  '] }
    ])
    expect(written.reaches?.map((reach) => reach.charId)).toEqual(['a', 'b'])
    const talking = withTalkStarted(written, 'a', 'hi!', 'spring')
    expect(openTalk(talking)?.lines).toEqual([
      { sender: 'contact', text: 'hey stranger' },
      { sender: 'player', text: 'hi!' }
    ])
    expect(talking.reaches?.map((reach) => reach.answered === true)).toEqual([true, false])

    const state = {} as CharState
    const carry = {
      charInfo: { a: state, b: state },
      bunnyboard: emptyBunnyboard()
    } as unknown as TermCarry
    const filed = withBreakThreads(carry, talking.talks, 'spring', talking.reaches)
    expect(filed.bunnyboard.conversations.a?.messages.map((m) => m.text)).toEqual([
      'hey stranger',
      'hi!'
    ])
    expect(filed.bunnyboard.conversations.b?.messages.map((m) => m.text)).toEqual(['you alive?'])
  })

  it('has nobody who soured on him write, and everybody close write in the last week', () => {
    const lover: BreakStanding = { disposition: 'devoted', lover: true }
    const sour: BreakStanding = { disposition: 'annoyed', lover: false }
    const known: BreakStanding = { disposition: 'neutral', lover: false }
    for (let week = 1; week <= 12; week += 1) expect(reachOutDue('a', sour, week, 'spring')).toBeNull()
    expect(reachOutDue('a', lover, 12, 'spring')).toBe('last')
    expect(reachOutDue('a', lover, 4, 'fall')).toBe('last')
    expect(reachOutDue('a', known, 12, 'spring')).toBeNull()
    expect(reachOutDue('a', known, 4, 'fall')).toBeNull()
  })
})

describe('a trip to see somebody', () => {
  const fresh: BreakDraft = {
    stats: { brain: 0, body: 0, heart: 0 },
    spent: [],
    talks: [],
    promises: {}
  }
  const lover: BreakStanding = { disposition: 'devoted', lover: true }
  const judged = {
    verdict: 'warmer' as const,
    summary: 'They walked the pier.',
    memories: [{ type: 'liked' as const, desc: 'the reader came to see her' }],
    exercised: { brain: false, body: false, heart: true }
  }

  it('takes four slots from the next second slot of a week, and nothing else may be done in them', () => {
    const invited = withInvite(fresh, 'a', 'spring')
    const booked = withInviteAnswered(invited, 'a', true, 'spring')
    expect(booked.invites).toEqual([{ charId: 'a', week: 1, state: 'accepted', departs: 1 }])
    // The first slot of the week is still his own.
    expect(tripStep(booked)).toBeNull()
    const leaving = withSlotSpent(booked, 'spring')
    expect(tripStep(leaving)).toEqual({ charId: 'a', kind: 'out' })
    expect(withSlotSpent(leaving, 'spring')).toBe(leaving)
    expect(withTalkStarted(leaving, 'b', 'hey', 'spring')).toBe(leaving)
    expect(withVisit(leaving, judged, 'spring')).toBe(leaving)

    const there = withTravel(leaving, 'spring')
    expect(tripStep(there)).toEqual({ charId: 'a', kind: 'visit', day: 1 })
    expect(withTravel(there, 'spring')).toBe(there)
    const second = withVisit(there, judged, 'spring')
    expect(second.stats.heart).toBe(1)
    const last = withVisit(second, judged, 'spring')
    expect(tripStep(last)).toEqual({ charId: 'a', kind: 'back' })
    const home = withTravel(last, 'spring')
    expect(home.spent.map((entry) => entry.kind)).toEqual([
      'rest',
      'travel',
      'visit',
      'visit',
      'travel'
    ])
    expect(home.invites?.[0]?.state).toBe('done')
    expect(tripStep(home)).toBeNull()
    expect(playedMemories(home, { a: lover }, 'spring').a).toEqual([
      { type: 'liked', desc: 'the reader came to see her' },
      { type: 'liked', desc: 'the reader came to see her' }
    ])
  })

  it('cannot be booked over another trip or past the end of the break', () => {
    const two = withInvite(withInvite(fresh, 'a', 'spring'), 'b', 'spring')
    const booked = withInviteAnswered(two, 'a', true, 'spring')
    expect(withInviteAnswered(booked, 'b', true, 'spring')).toBe(booked)
    expect(mayInvite(booked, 'a', lover, 'spring')).toBe(false)

    // A winter of eight slots with five gone has not four left from the next second slot.
    let late = fresh
    for (let slot = 0; slot < 5; slot += 1) late = withSlotSpent(late, 'fall')
    expect(mayInvite(late, 'a', lover, 'fall')).toBe(false)
    const asked = { ...late, invites: [{ charId: 'a', week: 3, state: 'open' as const }] }
    expect(withInviteAnswered(asked, 'a', true, 'fall')).toBe(asked)
    expect(withInviteAnswered(asked, 'a', false, 'fall').invites?.[0]?.state).toBe('declined')
  })
})
