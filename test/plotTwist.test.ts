import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activePlotTwist, PLOT_TWIST_LIMIT, PLOT_TWIST_MOD, savedPlotTwist, validatePlotTwist } from '@shared/plotTwists'
import { NO_SWITCHES } from '@shared/mods'
import { stampSave } from '@shared/saveRules'
import type { GameSave, Result, SaveDraft } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useBunnyboardStore } from '../src/renderer/stores/bunnyboardStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { manualSaveDraft, writeAutosave, writePlotTwist, writesSettled } from '../src/renderer/stores/loop/saves'
import { loopState, resetLoopState } from '../src/renderer/stores/loop/state'
import { playthroughRecord, restoreApi, sceneLines, stubApi } from './fixtures'

const old = 'The observatory has reopened.'
const next = 'A comet will pass the campus tonight.'
const saved: Result<GameSave> = { ok: true, data: { saveId: 'autosave' } as GameSave }
const failed: Result<GameSave> = { ok: false, error: { code: 'SAVE_WRITE_FAILED', message: 'Disk is full.' } }

function autosave(implementation: (id: string, draft: SaveDraft) => Promise<Result<GameSave>> = async () => saved) {
  const fn = vi.fn(implementation)
  stubApi({ saves: { autosave: fn } })
  return fn
}

function reading(): void {
  useGameStore.setState({
    cast: ['char-1'], currentSceneTranscript: sceneLines('One.', 'Two.'),
    sceneLog: sceneLines('One.'), currentLine: sceneLines('One.')[0],
    pendingLines: sceneLines('Two.'), awaitingInput: false
  })
}

function hold() {
  let release = (): void => {}
  const promise = new Promise<void>(resolve => { release = resolve })
  return { promise, release }
}

beforeEach(() => {
  useGameStore.getState().reset()
  useBunnyboardStore.getState().reset()
  resetLoopState()
  useModsStore.setState({ switches: NO_SWITCHES })
  useGameStore.setState({ playthroughId: 'p1', exPlotTwist: old })
})

afterEach(async () => {
  await writesSettled()
  restoreApi()
  vi.restoreAllMocks()
})

describe('Plot Twist data', () => {
  it('accepts the boundary, trims new edits, and permits clearing', () => {
    expect(validatePlotTwist('x'.repeat(PLOT_TWIST_LIMIT)).ok).toBe(true)
    expect(validatePlotTwist(`  ${next}  `)).toEqual({ ok: true, data: next })
    expect(validatePlotTwist(' \n ')).toEqual({ ok: true, data: '' })
  })
  it('rejects oversized and non-text edits without truncating them', () => {
    expect(validatePlotTwist('x'.repeat(PLOT_TWIST_LIMIT + 1)).ok).toBe(false)
    expect(validatePlotTwist({ text: next }).ok).toBe(false)
  })
  it('keeps old oversized text but bounds only its prompt copy', () => {
    const legacy = 'x'.repeat(PLOT_TWIST_LIMIT + 5)
    expect(savedPlotTwist(legacy)).toBe(legacy)
    expect(activePlotTwist(legacy, true)).toHaveLength(PLOT_TWIST_LIMIT)
    expect(activePlotTwist(legacy, false)).toBe('')
    expect(savedPlotTwist(undefined)).toBe('')
    expect(savedPlotTwist(42)).toBe('')
  })
  it('round trips legacy text while switched off, and resets for a different old save', () => {
    useModsStore.setState({ switches: { on: { [PLOT_TWIST_MOD]: false }, options: {} } })
    const save = stampSave(useGameStore.getState().toGameSave(), 'p1', 'autosave', 1)
    useGameStore.getState().loadSave(save, playthroughRecord({ chars: [] }), {})
    expect(useGameStore.getState().toGameSave().exPlotTwist).toBe(old)
    delete save.exPlotTwist
    useGameStore.getState().loadSave(save, playthroughRecord({ chars: [] }), {})
    expect(useGameStore.getState().exPlotTwist).toBe('')
    useGameStore.setState({ exPlotTwist: next })
    useGameStore.getState().reset()
    expect(useGameStore.getState().exPlotTwist).toBe('')
  })
})

describe('Plot Twist writes', () => {
  it('saves a landing and commits only after the backend confirms it', async () => {
    const gate = hold()
    const fn = autosave(async () => { await gate.promise; return saved })
    const pending = writePlotTwist(`  ${next}  `)
    await vi.waitFor(() => expect(fn).toHaveBeenCalledOnce())
    expect(useGameStore.getState().exPlotTwist).toBe(old)
    expect(fn.mock.calls[0][1]).toMatchObject({ scene: null, exPlotTwist: next })
    gate.release()
    expect(await pending).toEqual({ ok: true, data: null })
    expect(useGameStore.getState().exPlotTwist).toBe(next)
  })
  it('clears the autosave and the live direction together', async () => {
    const fn = autosave()
    expect((await writePlotTwist('')).ok).toBe(true)
    expect(fn.mock.calls[0][1].exPlotTwist).toBe('')
    expect(useGameStore.getState().exPlotTwist).toBe('')
  })
  it('retains the resumable current line and unread lines', async () => {
    reading()
    const fn = autosave()
    const before = useGameStore.getState().captureScene()
    expect((await writePlotTwist(next)).ok).toBe(true)
    const scene = fn.mock.calls[0][1].scene
    expect(scene?.resumeOnLine).toBe(true)
    expect(scene?.currentLine).toEqual(before?.currentLine)
    expect(scene?.pendingLines).toEqual(before?.pendingLines)
    expect(useGameStore.getState().captureScene()).toEqual(before)
  })
  it('updates a frozen status checkpoint without baking in already-awarded money twice', async () => {
    reading()
    useGameStore.setState({ sceneEnding: true, statusShown: true, money: 30 })
    loopState.statusBase = { ...useGameStore.getState().toGameSave(), money: 20 }
    const fn = autosave()
    expect((await writePlotTwist(next)).ok).toBe(true)
    expect(fn.mock.calls[0][1]).toMatchObject({ money: 20, exPlotTwist: next })
    expect(manualSaveDraft()).toMatchObject({ money: 20, exPlotTwist: next })
    expect(useGameStore.getState().money).toBe(30)
  })
  it('refuses a status sequence with no resumable base', async () => {
    reading()
    useGameStore.setState({ sceneEnding: true, statusShown: true })
    const fn = autosave()
    expect((await writePlotTwist(next)).ok).toBe(false)
    expect(fn).not.toHaveBeenCalled()
  })
  it.each(['result', 'throw'] as const)('leaves the old state intact on backend failure (%s) and allows retry', async mode => {
    const fn = autosave(async () => { if (mode === 'throw') throw Error('Disk is full.'); return failed })
    expect((await writePlotTwist(next)).ok).toBe(false)
    expect(useGameStore.getState().exPlotTwist).toBe(old)
    fn.mockResolvedValue(saved)
    expect((await writePlotTwist(next)).ok).toBe(true)
  })
  it.each(['busy', 'off', 'no-game', 'too-long', 'error', 'texting'] as const)('refuses unsafe edits: %s', async reason => {
    const fn = autosave()
    if (reason === 'busy') useGameStore.setState({ busy: true })
    if (reason === 'off') useModsStore.setState({ switches: { on: { [PLOT_TWIST_MOD]: false }, options: {} } })
    if (reason === 'no-game') useGameStore.setState({ playthroughId: null })
    if (reason === 'error') useGameStore.setState({ turnError: { code: 'FAILED', message: 'Retry the scene.' } })
    if (reason === 'texting') useBunnyboardStore.setState({ typingCharIds: ['char-1'] })
    expect((await writePlotTwist(reason === 'too-long' ? 'x'.repeat(PLOT_TWIST_LIMIT + 1) : next)).ok).toBe(false)
    expect(fn).not.toHaveBeenCalled()
    expect(useGameStore.getState().exPlotTwist).toBe(old)
  })
  it('serializes with earlier and later autosaves; later writes see the committed text', async () => {
    const gate = hold()
    const fn = autosave()
    fn.mockImplementationOnce(async () => { await gate.promise; return saved })
    const first = writeAutosave(null)
    await vi.waitFor(() => expect(fn).toHaveBeenCalledOnce())
    const edit = writePlotTwist(next)
    const later = writeAutosave(null)
    expect((await writePlotTwist('Overlapping edit')).ok).toBe(false)
    gate.release()
    await Promise.all([first, edit, later])
    expect(fn.mock.calls.map(call => call[1].exPlotTwist)).toEqual([old, next, next])
  })
  it.each(['run', 'load', 'disabled', 'busy'] as const)('rechecks queued edits after %s changes', async change => {
    const gate = hold()
    const fn = autosave(async () => { await gate.promise; return saved })
    const first = writeAutosave(null)
    await vi.waitFor(() => expect(fn).toHaveBeenCalledOnce())
    const edit = writePlotTwist(next)
    if (change === 'run') resetLoopState()
    if (change === 'load') useGameStore.setState({ loads: useGameStore.getState().loads + 1 })
    if (change === 'disabled') useModsStore.setState({ switches: { on: { [PLOT_TWIST_MOD]: false }, options: {} } })
    if (change === 'busy') useGameStore.setState({ busy: true })
    gate.release()
    await first
    expect((await edit).ok).toBe(false)
    expect(fn).toHaveBeenCalledOnce()
    expect(useGameStore.getState().exPlotTwist).toBe(old)
  })
  it('never applies an in-flight old save result to a newly loaded game', async () => {
    const gate = hold()
    const fn = autosave(async () => { await gate.promise; return saved })
    const edit = writePlotTwist(next)
    await vi.waitFor(() => expect(fn).toHaveBeenCalledOnce())
    resetLoopState()
    useGameStore.setState({ playthroughId: 'p2', exPlotTwist: 'Another story.' })
    gate.release()
    expect((await edit).ok).toBe(false)
    expect(useGameStore.getState().exPlotTwist).toBe('Another story.')
    expect(fn.mock.calls[0][0]).toBe('p1')
  })
})
