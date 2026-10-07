import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PLAYTHROUGH_NAMES_MOD, validateBackupPlaythroughNames } from '@shared/playthroughNames'
import type { BackupFile } from '@shared/backup'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { enrollment, record } from './fixtures'

let saves: typeof import('../src/web/db/saves')
let switches: typeof import('../src/web/mods')

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory()
  const held = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => held.get(key) ?? null,
    setItem: (key: string, value: string) => held.set(key, value)
  })
  vi.resetModules()
  saves = await import('../src/web/db/saves')
  switches = await import('../src/web/mods')
})

afterEach(() => vi.unstubAllGlobals())

describe('browser playthrough names', () => {
  it('preserves a renamed enrollment when finalized and leaves saves intact when renamed later', async () => {
    const { playthroughId } = await saves.writeEnrollment(enrollment())
    await saves.renamePlaythrough(playthroughId, 'Registration name')
    const created = await saves.createPlaythrough(record(), useGameStore.getState().toGameSave(), playthroughId)
    expect((await saves.listPlaythroughs())[0].label).toBe('Registration name')
    await saves.renamePlaythrough(playthroughId, 'Played name')
    expect(await saves.loadSave(playthroughId, created.save.saveId)).toEqual(created.save)
    const { database } = await import('../src/web/db/open')
    expect((await (await database()).get('playthroughs', playthroughId))?.exName).toBe('Played name')
  })

  it('honors the switch at the storage boundary and recovers the label when enabled again', async () => {
    const { playthroughId } = await saves.writeEnrollment(enrollment())
    await saves.renamePlaythrough(playthroughId, 'Saved name')
    switches.writeModSwitches({ on: { [PLAYTHROUGH_NAMES_MOD]: false }, options: {} })
    await expect(saves.renamePlaythrough(playthroughId, 'Wrong')).rejects.toMatchObject({ code: 'MOD_DISABLED' })
    expect((await saves.listPlaythroughs())[0].label).toBe('Playthrough 1')
    switches.writeModSwitches({ on: { [PLAYTHROUGH_NAMES_MOD]: true }, options: {} })
    expect((await saves.listPlaythroughs())[0].label).toBe('Saved name')
  })

  it('does not recreate a deleted row or damage a name after invalid input', async () => {
    const { playthroughId } = await saves.writeEnrollment(enrollment())
    await saves.renamePlaythrough(playthroughId, 'Untouched')
    await expect(saves.renamePlaythrough(playthroughId, 'x'.repeat(81))).rejects.toMatchObject({ code: 'PLAYTHROUGH_NAME_INVALID' })
    expect((await saves.listPlaythroughs())[0].label).toBe('Untouched')
    await saves.deletePlaythrough(playthroughId)
    await expect(saves.renamePlaythrough(playthroughId, 'Gone')).rejects.toBeDefined()
    expect(await saves.listPlaythroughs()).toEqual([])
  })
})

describe('portable name validation', () => {
  it('accepts backups without names and refuses malformed carried names before restore', () => {
    const backup = { playthroughs: { '1': { record: null, enrollment: null, createdAt: 1 } } } as unknown as BackupFile
    expect(() => validateBackupPlaythroughNames(backup)).not.toThrow()
    backup.playthroughs['1'].exName = 'An adventure'
    expect(() => validateBackupPlaythroughNames(backup)).not.toThrow()
    backup.playthroughs['1'].exName = 'Invalid\nname'
    expect(() => validateBackupPlaythroughNames(backup)).toThrow()
  })
})
