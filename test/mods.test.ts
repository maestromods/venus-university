import { describe, expect, it } from 'vitest'
import {
  BUILD,
  buildLine,
  cleanSwitches,
  CONTINUING_SEMESTERS,
  missingRequirement,
  modNames,
  modOn,
  MODS,
  modsOn,
  NO_SWITCHES,
  optionOn,
  playthroughMods,
  switchedOn,
  withMod,
  withOption,
  type ModDef
} from '@shared/mods'

const base = { author: 'a', version: '1.0.0', blurb: '' }

/** A small list with each shape a mod can have. */
const LIST: readonly ModDef[] = [
  { ...base, id: 'free', name: 'Free', scope: 'anytime', defaultOn: true },
  { ...base, id: 'quiet', name: 'Quiet', scope: 'anytime', defaultOn: false },
  { ...base, id: 'places', name: 'Places', scope: 'playthrough', defaultOn: true },
  {
    ...base,
    id: 'work',
    name: 'Work',
    scope: 'playthrough',
    defaultOn: true,
    requires: ['places'],
    options: [{ id: 'raises', label: 'Raises', hint: '', default: true }]
  }
]

describe('the shipped list', () => {
  it('gives every mod an id of its own that can go in a file', () => {
    const ids = MODS.map((mod) => mod.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('only requires mods it has', () => {
    for (const mod of MODS) {
      for (const needed of mod.requires ?? []) expect(MODS.some((m) => m.id === needed)).toBe(true)
    }
  })

  it('plays the break and offers continuing in Load Game until told otherwise', () => {
    expect(optionOn(NO_SWITCHES, CONTINUING_SEMESTERS, 'play-the-break')).toBe(true)
    expect(optionOn(NO_SWITCHES, CONTINUING_SEMESTERS, 'offer-in-load-game')).toBe(true)
    expect(optionOn(NO_SWITCHES, CONTINUING_SEMESTERS, 'seniors-graduate')).toBe(true)
  })

  it('has the Photo Feature on until it is switched off, on its own', () => {
    expect(modOn(NO_SWITCHES, 'photo-feature')).toBe(true)
    const off = withMod(NO_SWITCHES, 'photo-feature', false)
    expect(modOn(off, 'photo-feature')).toBe(false)
    expect(modOn(off, 'continuing-semesters')).toBe(true)
  })

  it('has Continuing Semesters on until it is switched off', () => {
    expect(modOn(NO_SWITCHES, CONTINUING_SEMESTERS)).toBe(true)
    expect(modOn(withMod(NO_SWITCHES, CONTINUING_SEMESTERS, false), CONTINUING_SEMESTERS)).toBe(false)
  })
})

describe('modOn', () => {
  it('answers a default until the switch is touched', () => {
    expect(modOn(NO_SWITCHES, 'free', null, LIST)).toBe(true)
    expect(modOn(NO_SWITCHES, 'quiet', null, LIST)).toBe(false)
    expect(modOn(withMod(NO_SWITCHES, 'quiet', true), 'quiet', null, LIST)).toBe(true)
  })

  it('is off for a mod the build does not have', () => {
    expect(modOn(withMod(NO_SWITCHES, 'gone', true), 'gone', null, LIST)).toBe(false)
  })

  it('is off while something it requires is off, and back when that returns', () => {
    const without = withMod(NO_SWITCHES, 'places', false)
    expect(switchedOn(without, 'work', LIST)).toBe(true)
    expect(modOn(without, 'work', null, LIST)).toBe(false)
    expect(missingRequirement(without, 'work', LIST)?.id).toBe('places')
    expect(modOn(withMod(without, 'places', true), 'work', null, LIST)).toBe(true)
  })

  it('reads a playthrough mod off the playthrough it is asked about', () => {
    const off = withMod(NO_SWITCHES, 'places', false)
    // Started with it: on, whatever the switch says now.
    expect(modOn(off, 'places', { mods: ['places'] }, LIST)).toBe(true)
    // Started without it, or before the list existed: off, whatever the switch says now.
    expect(modOn(NO_SWITCHES, 'places', { mods: [] }, LIST)).toBe(false)
    expect(modOn(NO_SWITCHES, 'places', {}, LIST)).toBe(false)
    // No playthrough in hand: what a new one would get.
    expect(modOn(NO_SWITCHES, 'places', null, LIST)).toBe(true)
  })

  it('reads an anytime mod off its switch, whatever the playthrough names', () => {
    expect(modOn(withMod(NO_SWITCHES, 'free', false), 'free', { mods: ['free'] }, LIST)).toBe(false)
  })

  it('does not hang on mods that require each other', () => {
    const circle: ModDef[] = [
      { ...base, id: 'a', name: 'A', scope: 'anytime', defaultOn: true, requires: ['b'] },
      { ...base, id: 'b', name: 'B', scope: 'anytime', defaultOn: true, requires: ['a'] }
    ]
    expect(modOn(NO_SWITCHES, 'a', null, circle)).toBe(true)
  })
})

describe('options', () => {
  it('answers a default until set, and off for one nobody declared', () => {
    expect(optionOn(NO_SWITCHES, 'work', 'raises', LIST)).toBe(true)
    expect(optionOn(withOption(NO_SWITCHES, 'work', 'raises', false), 'work', 'raises', LIST)).toBe(false)
    expect(optionOn(NO_SWITCHES, 'work', 'nothing', LIST)).toBe(false)
  })
})

describe('a new playthrough', () => {
  it('names the playthrough mods that are on, and no others', () => {
    expect(playthroughMods(NO_SWITCHES, LIST)).toEqual(['places', 'work'])
    expect(playthroughMods(withMod(NO_SWITCHES, 'places', false), LIST)).toEqual([])
    expect(playthroughMods(NO_SWITCHES)).toEqual([])
  })
})

describe('what the build says of itself', () => {
  it('counts the mods that are on', () => {
    expect(modsOn(NO_SWITCHES, LIST).map((mod) => mod.id)).toEqual(['free', 'places', 'work'])
    expect(buildLine(NO_SWITCHES, LIST)).toBe(`${BUILD.name} ${BUILD.version} · 3 mods on · unofficial`)
    expect(buildLine(withMod(withMod(NO_SWITCHES, 'places', false), 'quiet', false), LIST)).toBe(
      `${BUILD.name} ${BUILD.version} · 1 mod on · unofficial`
    )
  })

  it('names every mod for the log', () => {
    expect(modNames(LIST.slice(0, 2))).toBe('Free 1.0.0, Quiet 1.0.0')
  })
})

describe('cleanSwitches', () => {
  it('keeps yes and no, and drops everything else', () => {
    expect(cleanSwitches({ on: { a: true, b: 'yes', c: false }, options: { 'a:x': false, y: 1 }, more: 1 })).toEqual({
      on: { a: true, c: false },
      options: { 'a:x': false }
    })
  })

  it('makes an empty set of anything that is not one', () => {
    for (const value of [null, undefined, 3, 'on', [], { on: [true] }]) {
      expect(cleanSwitches(value)).toEqual({ on: {}, options: {} })
    }
  })
})
