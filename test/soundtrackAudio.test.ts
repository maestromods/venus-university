/// <reference path="../src/renderer/signalsmith-stretch.d.ts" />
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AudioKey } from '@shared/audio'

const flags = vi.hoisted(() => ({ enabled: true }))
vi.mock('../src/renderer/stores/modsStore', () => ({ modIsOn: () => flags.enabled }))
vi.mock('signalsmith-stretch', () => ({ default: async () => ({ addBuffers: async () => {}, connect() {}, disconnect() {}, schedule: async () => {}, stop: async () => {} }) }))

class Param {
  value = 1
  cancelAndHoldAtTime() {}
  setValueAtTime(value: number) { this.value = value }
  linearRampToValueAtTime(value: number) { this.value = value }
}
class Node {
  gain = new Param(); frequency = new Param(); Q = new Param()
  connect() {}; disconnect() {}
}
class Source extends Node {
  static made: Source[] = []
  buffer: AudioBuffer | null = null
  loop = false; onended: (() => void) | null = null; stopped = false
  playbackRate = new Param()
  constructor() { super(); Source.made.push(this) }
  start() {}
  stop() { this.stopped = true }
  finish() { this.onended?.() }
}
class Context {
  currentTime = 0; state = 'running'; destination = new Node(); sampleRate = 44100
  resume = async () => {}; close = async () => {}
  createGain() { return new Node() }
  createBufferSource() { return new Source() }
  createBiquadFilter() { return new Node() }
  createConvolver() { return new Node() }
  createBuffer(channels: number, length: number, rate: number) { return { numberOfChannels: channels, length, duration: length / rate, getChannelData: () => new Float32Array(length) } }
  async decodeAudioData(bytes: ArrayBuffer) {
    return this.createBuffer(1, new Uint8Array(bytes)[0] === 2 ? 88200 : 5292000, 44100)
  }
}
let engine: typeof import('../src/renderer/stores/audioEngine')
let store: typeof import('../src/renderer/stores/soundtrackStore')
const track = { file: 'a'.repeat(64) + '.wav', name: 'custom.wav', loop: true }
async function settle() { for (let i = 0; i < 40; i++) await Promise.resolve() }
async function cue(key: AudioKey | null) { engine.apply('music', { key, fade: .01 }); await settle() }
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); flags.enabled = true; Source.made = []
  vi.stubGlobal('AudioContext', Context); vi.stubGlobal('AudioBufferSourceNode', Source)
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {}, api: {
    assets: { readAudio: vi.fn(async () => ({ ok: true, data: new Uint8Array([1]) })) },
    soundtracks: {
      list: vi.fn(async () => ({ ok: true, data: { title: track, landing_day: track } })),
      read: vi.fn(async () => ({ ok: true, data: new Uint8Array([2]) }))
    }
  } })
  store = await import('../src/renderer/stores/soundtrackStore')
  await store.useSoundtrackStore.getState().load()
  engine = await import('../src/renderer/stores/audioEngine')
  engine.start()
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('loops a short custom title and never applies the stock thirty-second ending clock', async () => {
  const ending = vi.fn(); engine.onEnding(ending)
  await cue('title')
  expect(Source.made.at(-1)?.loop).toBe(true)
  expect(Source.made.at(-1)?.buffer?.duration).toBe(2)
  await vi.advanceTimersByTimeAsync(10_000)
  expect(ending).not.toHaveBeenCalled()
})

it('leaves a play-once cue finished across repeated updates, then plays it on re-entry', async () => {
  store.useSoundtrackStore.setState({ map: { landing_day: { ...track, loop: false } } })
  await cue('landing_day')
  const first = Source.made.at(-1)!
  expect(first.loop).toBe(false)
  first.finish()
  await cue('landing_day'); await cue('landing_day')
  expect(Source.made).toHaveLength(1)
  await cue(null); await cue('landing_day')
  expect(Source.made).toHaveLength(2)
})

it('restores native playback on disable and returns to the kept replacement on enable', async () => {
  await cue('title')
  flags.enabled = false; engine.refreshSoundtracks(); await settle()
  expect(Source.made.at(-1)?.buffer?.duration).toBe(120)
  expect(Source.made.at(-1)?.loop).toBe(false)
  flags.enabled = true; engine.refreshSoundtracks(); await settle()
  expect(Source.made.at(-1)?.buffer?.duration).toBe(2)
  expect(Source.made.at(-1)?.loop).toBe(true)
  expect(store.useSoundtrackStore.getState().map.title).toEqual(track)
})

it('does not restart a finished track when an unrelated slot changes', async () => {
  store.useSoundtrackStore.setState({ map: { landing_day: { ...track, loop: false } } })
  await cue('landing_day'); Source.made[0].finish()
  engine.refreshSoundtracks(['ending']); await settle()
  await cue('landing_day')
  expect(Source.made).toHaveLength(1)
})

it('falls back once to the original when an imported file is missing', async () => {
  vi.mocked(window.api.soundtracks.read).mockResolvedValue({ ok: true, data: null })
  await cue('title')
  expect(Source.made.at(-1)?.buffer?.duration).toBe(120)
  expect(store.useSoundtrackStore.getState().errors.title).toContain('missing')
  await cue(null); await cue('title')
  expect(window.api.soundtracks.read).toHaveBeenCalledTimes(1)
})

it('discards an in-flight replacement when the cue is restored or disabled', async () => {
  let finish!: (value: Awaited<ReturnType<typeof window.api.soundtracks.read>>) => void
  vi.mocked(window.api.soundtracks.read).mockReturnValue(new Promise(resolve => { finish = resolve }))
  engine.apply('music', { key: 'title', fade: .01 }); await settle()
  flags.enabled = false; engine.refreshSoundtracks(); await settle()
  finish({ ok: true, data: new Uint8Array([2]) }); await settle()
  expect(Source.made).toHaveLength(1)
  expect(Source.made[0].buffer?.duration).toBe(120)
})
