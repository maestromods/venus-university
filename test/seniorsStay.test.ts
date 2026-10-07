import { afterEach, describe, expect, it } from 'vitest'
import { SENIOR_YEAR } from '@shared/classes'
import { graduatesAfter, setSeniorsGraduate, yearAfter } from '@shared/term'
import { graduatedChars, returningChars } from '@shared/termCarry'
import type { PlaythroughRecord } from '@shared/types'

/** A spring roster with one girl in each class year. */
const record = {
  chars: ['fresh', 'soph', 'junior', 'senior'],
  profiles: {
    fresh: { year: 1 },
    soph: { year: 2 },
    junior: { year: 3 },
    senior: { year: SENIOR_YEAR }
  }
} as unknown as PlaythroughRecord

describe('seniors graduating, and the option that keeps them', () => {
  afterEach(() => setSeniorsGraduate(true))

  it('sends seniors off after a spring, as it always has', () => {
    expect(graduatesAfter(SENIOR_YEAR, 'spring')).toBe(true)
    expect(graduatesAfter(SENIOR_YEAR, 'fall')).toBe(false)
    expect(returningChars(record)).toEqual(['fresh', 'soph', 'junior'])
    expect(graduatedChars(record)).toEqual(['senior'])
  })

  it('keeps everybody once seniors no longer graduate', () => {
    setSeniorsGraduate(false)
    expect(graduatesAfter(SENIOR_YEAR, 'spring')).toBe(false)
    expect(returningChars(record)).toEqual(['fresh', 'soph', 'junior', 'senior'])
    expect(graduatedChars(record)).toEqual([])
  })

  it('leaves a senior who stays a senior', () => {
    expect(yearAfter(SENIOR_YEAR, 'spring')).toBe(SENIOR_YEAR)
  })
})
