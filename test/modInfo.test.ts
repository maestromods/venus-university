import { describe, expect, it } from 'vitest'
import { modLine, modNames, MODS } from '@shared/modInfo'

describe('modInfo', () => {
  it('names this build', () => {
    expect(MODS.length).toBeGreaterThan(0)
    const named = MODS.map((mod) => `${mod.name} ${mod.version}`).join(', ')
    expect(modLine()).toBe(`Modded · ${named} · unofficial`)
  })

  it('names every mod of a build that carries several', () => {
    const mods = [
      { name: 'One', version: '1.0.0' },
      { name: 'Two', version: '0.2.0' }
    ]
    expect(modNames(mods)).toBe('One 1.0.0, Two 0.2.0')
    expect(modLine(mods)).toBe('Modded · One 1.0.0, Two 0.2.0 · unofficial')
  })
})
