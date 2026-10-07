import { afterEach, beforeEach, expect, it } from 'vitest'
import { PLOT_TWIST_MOD } from '@shared/plotTwists'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { buildScenePrompt, buildContinuationPrompt, buildClosingPrompt, buildSoloPrompt } from '../src/renderer/prompts/scenePrompt'
import { character, restoreApi, stubApi } from './fixtures'

stubApi({ jobs: { onProgress: () => () => {} } })
const { promptState } = await import('../src/renderer/stores/loop/promptState')

const direction = 'A comet will pass the campus tonight.'
beforeEach(() => {
  useGameStore.getState().reset()
  useGameStore.setState({ exPlotTwist: direction })
  useModsStore.setState({ switches: { on: {}, options: {} } })
})
afterEach(restoreApi)

function requests() {
  const state = { ...promptState(), seedWord: 'aspen' }
  const cast = [character()]
  return [
    buildScenePrompt(cast, 'Talk.', state, '', ''),
    buildContinuationPrompt(cast, 'Talk.', [], state, '', '', null, 1),
    buildClosingPrompt(cast, [], state, '', '', null),
    buildSoloPrompt('Study.', state, '', '')
  ]
}

it('routes the saved direction once to each scene request, leaving schema and system unchanged', () => {
  const enabled = requests()
  useModsStore.setState({ switches: { on: { [PLOT_TWIST_MOD]: false }, options: {} } })
  const disabled = requests()
  for (let i = 0; i < enabled.length; i++) {
    expect(enabled[i].user.split(direction)).toHaveLength(2)
    expect(disabled[i].user).not.toContain(direction)
    expect(enabled[i].system).toBe(disabled[i].system)
    expect(enabled[i].schema).toEqual(disabled[i].schema)
  }
  expect(useGameStore.getState().toGameSave().exPlotTwist).toBe(direction)
  useModsStore.setState({ switches: { on: {}, options: {} } })
  expect(promptState().exPlotTwist).toBe(direction)
})

it('does not mutate a captured request when the player later edits the twist', () => {
  const before = requests()[0]
  useGameStore.setState({ exPlotTwist: 'The library is closing.' })
  expect(before.user).toContain(direction)
  expect(requests()[0].user).not.toContain(direction)
})
