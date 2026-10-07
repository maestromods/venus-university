import { describe, expect, it } from 'vitest'
import { FINAL_DATE } from '@shared/classes'
import { bossChatIdOf } from '@shared/jobs'
import { pairKeyOf } from '@shared/npcRelationships'
import { pointsForTier, rustedStats } from '@shared/playerStats'
import { emptyFlags } from '@shared/relationship'
import {
  daysToNextTerm,
  LAST_TERM_INDEX,
  readerYearOf,
  seasonOf,
  type Season
} from '@shared/term'
import { carriedOpening, carryTerm, returningChars, withBreakMemories } from '@shared/termCarry'
import {
  emptyBunnyboard,
  type CharMemory,
  type CharState,
  type ChatMessage,
  type GameSave
} from '@shared/types'
import { formatGameDate } from '../src/renderer/prompts/gameDate'
import { playerStats, playthroughRecord } from './fixtures'

/**
 * A semester carried into the next one. The opening save of the new term is computed from the
 * last save of the old one, so a date left where it was would land inside a semester it never
 * happened in, and somebody left on the phone who is not on the roster is a thread to nobody.
 */

/** A memory on `date`. */
function memory(date: number, desc = 'the reader was kind'): CharMemory {
  return { date, type: 'liked', desc }
}

/** One character's moving half, as a save holds it. */
function state(over: Partial<CharState> = {}): CharState {
  return { memories: [], flags: emptyFlags(), nameKnown: true, ...over }
}

/** One text, sent on `date`. */
function text(date: number): ChatMessage {
  return { id: `m${date}`, sender: 'contact', text: 'hey', date, time: 1 }
}

/** The last save of a semester: only what the carry reads is filled in. */
function save(over: Partial<GameSave> = {}): GameSave {
  return {
    stats: playerStats(0, 0, 0),
    money: 250,
    date: FINAL_DATE,
    time: 0,
    charInfo: {},
    bunnyboard: emptyBunnyboard(),
    inventory: [],
    npcRelationships: {},
    gradesStanding: null,
    bunnybotThrough: 24,
    bunnymapUnlocked: true,
    bunnyshopUnlocked: true,
    venusJobIntroSent: true,
    bunnybotContactIntroSent: true,
    bunnybotFirstPostNudgeSent: false,
    bunnybotTwoTimingTipSent: false,
    bunnybotDeferred: [],
    graduationSeen: true,
    ...over
  } as GameSave
}

/** A spring roster of a junior, a senior and a freshman. */
function springRecord(): ReturnType<typeof playthroughRecord> {
  const profile = (year: number) => ({
    year,
    dorm: 'lowrise_1' as const,
    major: 'Art',
    schedule: {}
  })
  return playthroughRecord({
    chars: ['ana', 'bea', 'cy'],
    profiles: { ana: profile(3), bea: profile(4), cy: profile(1) }
  })
}

describe('returningChars', () => {
  it('lets the seniors go after a spring, and nobody after a fall', () => {
    expect(returningChars(springRecord())).toEqual(['ana', 'cy'])
    expect(returningChars({ ...springRecord(), term: { index: 1 } })).toEqual(['ana', 'bea', 'cy'])
  })
})

describe('the two calendars', () => {
  it('give a day carried across a break the calendar date it had', () => {
    for (const from of ['spring', 'fall'] as const) {
      const to: Season = from === 'spring' ? 'fall' : 'spring'
      for (const date of [0, 46, FINAL_DATE, FINAL_DATE + 7]) {
        expect(formatGameDate(date - daysToNextTerm(from), to)).toBe(formatGameDate(date, from))
      }
    }
  })
})

describe('readerYearOf', () => {
  it('moves the reader up every fall and graduates him in his fourth spring', () => {
    const years = Array.from({ length: LAST_TERM_INDEX + 1 }, (_, index) => readerYearOf(index))
    expect(years).toEqual([1, 2, 2, 3, 3, 4, 4])
    expect(seasonOf(LAST_TERM_INDEX)).toBe('spring')
  })
})

describe('rustedStats', () => {
  it('brings each stat back a tier down, at the fewest points that buy it', () => {
    expect(rustedStats(playerStats(130, 61, 20))).toEqual(
      playerStats(pointsForTier(4), pointsForTier(3), pointsForTier(1))
    )
  })

  it('leaves the floor where it is', () => {
    expect(rustedStats(playerStats(0, 14, 15))).toEqual(playerStats(0, 0, 0))
  })
})

describe('carryTerm', () => {
  it('dates everything it carries before the new semester begins', () => {
    const { carry } = carryTerm(
      save({
        charInfo: {
          ana: state({
            memories: [memory(3), memory(FINAL_DATE)],
            textMemory: memory(120),
            jealousyMemories: [memory(90)],
            giftMemories: [memory(60)],
            datingSince: 80,
            brokeUpOn: 110,
            feed: [
              {
                id: 'p',
                text: 'done!',
                date: FINAL_DATE + 7,
                time: 1,
                likes: 2,
                liked: true,
                likedOn: FINAL_DATE + 7
              }
            ]
          }),
          cy: state()
        },
        bunnyboard: {
          ...emptyBunnyboard(),
          conversations: { ana: { charId: 'ana', messages: [text(100)], unread: 0, summary: 's' } }
        },
        npcFriendships: [{ a: 'ana', b: 'cy', date: 50, time: 0 }]
      }),
      springRecord(),
      ['ana', 'cy']
    )

    const back = daysToNextTerm('spring')
    const ana = carry.charInfo.ana
    expect(ana.memories.map((entry) => entry.date)).toEqual([3 - back, FINAL_DATE - back])
    const dates = [
      ...ana.memories.map((entry) => entry.date),
      ana.textMemory?.date,
      ana.jealousyMemories?.[0].date,
      ana.giftMemories?.[0].date,
      ana.datingSince,
      ana.brokeUpOn,
      ana.feed?.[0].date,
      ana.feed?.[0].likedOn,
      carry.bunnyboard.conversations.ana.messages[0].date,
      carry.npcFriendships?.[0].date
    ]
    for (const date of dates) expect(date).toBeLessThan(0)
    // The dating ran thirty days, and still does.
    expect((ana.brokeUpOn ?? 0) - (ana.datingSince ?? 0)).toBe(30)
  })

  it('leaves behind whoever is not coming back, and every boss', () => {
    const boss = bossChatIdOf('cutetea')
    const thread = (charId: string) => ({ charId, messages: [], unread: 0, summary: null })
    const { carry } = carryTerm(
      save({
        charInfo: { ana: state({ leftFor: 'bea' }), bea: state(), cy: state({ leftFor: 'ana' }) },
        bunnyboard: {
          conversations: {
            ana: thread('ana'),
            bea: thread('bea'),
            venus: thread('venus'),
            [boss]: thread(boss)
          },
          requestsSent: ['bea', 'cy'],
          requestsReceived: ['bea'],
          contactsBadge: 0,
          suggestions: ['bea']
        },
        npcRelationships: {
          [pairKeyOf('ana', 'bea')]: { affinity: 4 },
          [pairKeyOf('ana', 'cy')]: {
            affinity: -2,
            encounter: { date: 100, kind: 'dorm', ref: 'kitchen', positive: false }
          }
        }
      }),
      springRecord(),
      // The player kept the senior on the roster; she has graduated all the same.
      ['ana', 'bea', 'cy'].filter((charId) => returningChars(springRecord()).includes(charId))
    )

    expect(Object.keys(carry.charInfo).sort()).toEqual(['ana', 'cy'])
    expect(Object.keys(carry.bunnyboard.conversations).sort()).toEqual(['ana', 'venus'])
    expect(carry.bunnyboard.requestsSent).toEqual(['cy'])
    expect(carry.bunnyboard.requestsReceived).toEqual([])
    expect(carry.bunnyboard).not.toHaveProperty('suggestions')
    expect(carry.npcRelationships).toEqual({ [pairKeyOf('ana', 'cy')]: { affinity: -2 } })
    // Left for somebody who is gone is nobody's business any more; left for somebody back is.
    expect(carry.charInfo.ana).not.toHaveProperty('leftFor')
    expect(carry.charInfo.cy.leftFor).toBe('ana')
  })

  it('carries nothing that belonged to the old timetable', () => {
    const { carry, stats } = carryTerm(
      save({
        stats: playerStats(100, 100, 100),
        charInfo: {
          ana: state({
            job: { jobId: 'cutetea', shifts: [3] },
            metSlots: [2],
            ignoredInvitation: true,
            suspicions: [{ subject: 'cy', slot: 200 }],
            crushHint: { met: true },
            gifts: ['rose'],
            seenOutfits: ['swim']
          })
        }
      }),
      springRecord(),
      ['ana']
    )

    expect(carry.charInfo.ana).toEqual({
      memories: [],
      flags: emptyFlags(),
      nameKnown: true,
      gifts: ['rose'],
      seenOutfits: ['swim']
    })
    expect(stats).toEqual(playerStats(60, 60, 60))
    expect(carry.money).toBe(250)
    // Nothing BunnyBot owes the clock is owed a second time.
    expect(carry.bunnybotThrough).toBeGreaterThan(FINAL_DATE * 2)
  })
})

describe('carriedOpening', () => {
  it('lays what was carried over the save New Game composed, and keeps what the new semester dealt', () => {
    const { carry } = carryTerm(
      save({
        money: 900,
        tallies: { moneyEarned: 50, kisses: 2, sex: 0, shiftsWorked: 4, tokensGenerated: 1000 },
        charInfo: {
          ana: state({
            memories: [memory(100)],
            feed: [{ id: 'old', text: 'spring', date: 90, time: 0, likes: 1 }]
          }),
          cy: state()
        },
        npcRelationships: { [pairKeyOf('ana', 'cy')]: { affinity: 3 } }
      }),
      springRecord(),
      ['ana', 'cy']
    )

    // What New Game writes for a roster of two returning girls and a newcomer.
    const fresh = save({
      money: 100,
      tallies: { moneyEarned: 0, kisses: 0, sex: 0, shiftsWorked: 0, tokensGenerated: 30 },
      charInfo: {
        ana: state({
          nameKnown: false,
          job: { jobId: 'cutetea', shifts: [3] },
          feed: [{ id: 'new', text: 'summer', date: -10, time: 1, likes: 0 }]
        }),
        cy: state({ nameKnown: false }),
        dee: state({ nameKnown: false })
      },
      npcRelationships: {
        [pairKeyOf('ana', 'cy')]: { affinity: -5 },
        [pairKeyOf('ana', 'dee')]: { affinity: 1 }
      }
    })
    const opening = carriedOpening(fresh, carry)

    expect(opening.money).toBe(900)
    expect(opening.tallies).toMatchObject({ kisses: 2, shiftsWorked: 4, tokensGenerated: 1030 })
    expect(opening.charInfo.ana.nameKnown).toBe(true)
    expect(opening.charInfo.ana.memories).toHaveLength(1)
    expect(opening.charInfo.ana.job).toEqual({ jobId: 'cutetea', shifts: [3] })
    expect(opening.charInfo.ana.feed?.map((post) => post.id)).toEqual(['old', 'new'])
    // The newcomer opens as New Game wrote her.
    expect(opening.charInfo.dee).toEqual(fresh.charInfo.dee)
    // Two returning girls keep what they thought of each other; a pair with a newcomer is rolled.
    expect(opening.npcRelationships).toEqual({
      [pairKeyOf('ana', 'cy')]: { affinity: 3 },
      [pairKeyOf('ana', 'dee')]: { affinity: 1 }
    })
  })
})

describe('withBreakMemories', () => {
  it('files the break after everything older, before day 0, dropping nothing', () => {
    const old = Array.from({ length: 20 }, (_, index) => memory(index + 10))
    const { carry } = carryTerm(
      save({ charInfo: { ana: state({ memories: old }) } }),
      springRecord(),
      ['ana']
    )
    const filed = withBreakMemories(carry, {
      ana: [
        { type: 'loved', desc: 'the reader called her every week' },
        { type: 'disliked', desc: 'the reader forgot her birthday' }
      ],
      nobody: [{ type: 'liked', desc: 'the reader waved' }]
    }).charInfo

    expect(Object.keys(filed)).toEqual(['ana'])
    expect(filed.ana.memories).toHaveLength(old.length + 2)
    const [first, second] = filed.ana.memories.slice(-2)
    expect([first.type, second.type]).toEqual(['loved', 'disliked'])
    expect(first.date).toBeLessThan(second.date)
    expect(second.date).toBeLessThan(0)
    // Newer than anything she already remembered.
    expect(first.date).toBeGreaterThan(filed.ana.memories[old.length - 1].date)
  })
})
