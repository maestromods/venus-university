import { describe, expect, it } from 'vitest'
import { validateRecord } from '@shared/jsonValidate'
import { pointsForTier } from '@shared/playerStats'
import {
  BREAK_READ,
  breakClock,
  breakOver,
  breakSlots,
  breakSpent,
  openBreak,
  stampBreak,
  withBreakClosed,
  withSlotSpent,
  type BreakDraft
} from '@shared/termBreak'

/**
 * The break played between two semesters. The next semester's opening save is computed from how
 * it closed, so a slot spent past its end or a memory kept after the player blanked it would be
 * carried into a semester that never saw it happen.
 */

/** A break with `count` slots let go by. */
function spentBreak(count: number): BreakDraft {
  let draft = openBreak({ stats: { brain: 0, body: 0, heart: 0 } })
  for (let i = 0; i < count; i++) draft = withSlotSpent(draft, { kind: 'rest' }, 'spring')
  return draft
}

describe('openBreak', () => {
  it('opens on the reader a tier down in everything, with nothing spent', () => {
    const draft = openBreak({
      stats: { brain: pointsForTier(3) + 4, body: pointsForTier(2), heart: pointsForTier(1) }
    })
    expect(draft).toEqual({
      stats: { brain: pointsForTier(2), body: pointsForTier(1), heart: pointsForTier(1) },
      spent: []
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
})

describe('withSlotSpent', () => {
  it('spends no slot past the last one', () => {
    const full = spentBreak(24)
    expect(breakSpent(full, 'spring')).toBe(true)
    expect(withSlotSpent(full, { kind: 'rest' }, 'spring')).toBe(full)
  })

  it('spends no slot once the break is over', () => {
    const closed = withBreakClosed(spentBreak(2), {})
    expect(breakOver(closed)).toBe(true)
    expect(withSlotSpent(closed, { kind: 'rest' }, 'spring')).toBe(closed)
  })
})

describe('withBreakClosed', () => {
  it('drops a memory the player blanked and keeps the girl it was about', () => {
    const closed = withBreakClosed(spentBreak(1), {
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

describe('the break record', () => {
  it('reads back what was stamped, and refuses another version', () => {
    const stamped = stampBreak(spentBreak(3), 1000)
    expect(validateRecord(JSON.parse(JSON.stringify(stamped)), 'here', BREAK_READ)).toEqual(
      stamped
    )
    expect(() =>
      validateRecord({ ...stamped, schemaVersion: stamped.schemaVersion + 1 }, 'here', BREAK_READ)
    ).toThrow(/unsupported schemaVersion/)
  })
})
