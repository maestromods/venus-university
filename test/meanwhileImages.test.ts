import { describe, expect, it, vi } from 'vitest'
import { meanwhileBackgroundKey, meanwhileBackgroundUrl } from '../src/renderer/views/meanwhileImages'
import { bgUrl } from '../src/renderer/views/bgAssets'

vi.mock('../src/renderer/views/bgAssets', () => ({ bgUrl: vi.fn((key: string) =>
  ['asian_food', 'bowling_alley', 'roller_rink', 'cat_cafe'].includes(key) ? `/art/${key}.png` : null) }))

describe('Meanwhile location artwork', () => {
  it('resolves timetable IDs and outing locations instead of treating them as filenames', () => {
    expect(meanwhileBackgroundUrl({ kind: 'hangout', ref: 'eastern_buffet' })).toBe('/art/asian_food.png')
    expect(bgUrl).toHaveBeenCalledWith('asian_food', 'day', false)
    expect(meanwhileBackgroundKey({ kind: 'hangout', ref: 'spring_mart' })).toBe('supermarket')
    expect(meanwhileBackgroundKey({ kind: 'hangout', ref: 'cutetea' })).toBe('cute_tea')
    expect(meanwhileBackgroundKey({ kind: 'hangout', ref: 'future_cinema' })).toBe('theater')
    expect(meanwhileBackgroundKey({ kind: 'dorm', ref: 'some-dorm' })).toBe('dorm_lounge')
    expect(meanwhileBackgroundKey({ kind: 'class', ref: 'some-class' })).toBe('classroom')
  })
  it('uses installed City Life artwork and leaves missing artwork to the themed fallback', () => {
    for (const ref of ['bowling_alley', 'roller_rink', 'cat_cafe']) {
      expect(meanwhileBackgroundUrl({ kind: 'hangout', ref })).toBe(`/art/${ref}.png`)
    }
    expect(meanwhileBackgroundUrl({ kind: 'hangout', ref: 'missing-location' })).toBeNull()
  })
})
