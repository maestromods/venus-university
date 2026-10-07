import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { basename, dirname, join, resolve } from 'path'
import { tmpdir } from 'os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PLAYTHROUGH_NAME_FILE, PLAYTHROUGH_NAMES_MOD } from '@shared/playthroughNames'
import { enrollment } from './fixtures'

let root = ''
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root },
  safeStorage: { isEncryptionAvailable: () => false }
}))
const { getPlaythroughPath, getEnrollmentPath } = await import('../src/main/paths')
const { listPlaythroughs, writeEnrollment } = await import('../src/main/services/saveService')
const { readPlaythroughName, renamePlaythrough } = await import('../src/main/services/playthroughNameService')
const { setModSwitches } = await import('../src/main/services/modsService')
const { exportBackup, importBackup } = await import('../src/main/services/backupService')

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'vu-playthrough-names-'))
})

afterEach(async () => {
  if (dirname(resolve(root)) !== resolve(tmpdir()) || !basename(root).startsWith('vu-playthrough-names-')) {
    throw Error('Unexpected test directory')
  }
  await rm(root, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('playthrough names beside desktop saves', () => {
  it('reads an archive-patch name without rewriting it, and changes only the sidecar when renamed', async () => {
    const { playthroughId } = await writeEnrollment(enrollment())
    const sidecar = join(getPlaythroughPath(playthroughId), PLAYTHROUGH_NAME_FILE)
    const legacy = JSON.stringify({ name: 'Original adventure' })
    await writeFile(sidecar, legacy)
    const before = await readFile(getEnrollmentPath(playthroughId), 'utf8')
    expect((await listPlaythroughs())[0].label).toBe('Original adventure')
    expect(await readFile(sidecar, 'utf8')).toBe(legacy)
    await renamePlaythrough(playthroughId, '  New adventure  ')
    expect((await listPlaythroughs())[0].label).toBe('New adventure')
    expect(await readFile(getEnrollmentPath(playthroughId), 'utf8')).toBe(before)
    expect(JSON.parse(await readFile(sidecar, 'utf8'))).toEqual({ schemaVersion: 1, name: 'New adventure' })
  })

  it('refuses edits while off and preserves the name through an off/on cycle', async () => {
    const { playthroughId } = await writeEnrollment(enrollment())
    await renamePlaythrough(playthroughId, 'Keep this name')
    await setModSwitches({ on: { [PLAYTHROUGH_NAMES_MOD]: false }, options: {} })
    await expect(renamePlaythrough(playthroughId, 'Overwrite')).rejects.toMatchObject({ code: 'MOD_DISABLED' })
    expect((await listPlaythroughs())[0].label).toBe('Playthrough 1')
    expect(await readPlaythroughName(playthroughId)).toBe('Keep this name')
    await setModSwitches({ on: { [PLAYTHROUGH_NAMES_MOD]: true }, options: {} })
    expect((await listPlaythroughs())[0].label).toBe('Keep this name')
  })

  it('refuses invalid names and paths without replacing the last good name or creating a folder', async () => {
    const { playthroughId } = await writeEnrollment(enrollment())
    await renamePlaythrough(playthroughId, 'Untouched')
    for (const bad of ['', '  ', 'x'.repeat(81), 'A\nB', '\nTrimmed', null, 42]) {
      await expect(renamePlaythrough(playthroughId, bad)).rejects.toMatchObject({ code: 'PLAYTHROUGH_NAME_INVALID' })
    }
    await expect(renamePlaythrough('../outside', 'Bad')).rejects.toMatchObject({ code: 'PLAYTHROUGH_ID_INVALID' })
    await expect(renamePlaythrough('1', 'Missing')).rejects.toMatchObject({ code: 'PLAYTHROUGH_NOT_FOUND' })
    expect(await readPlaythroughName(playthroughId)).toBe('Untouched')
    expect(await listPlaythroughs()).toHaveLength(1)
  })

  it('keeps a damaged sidecar intact and leaves its playthrough accessible', async () => {
    const { playthroughId } = await writeEnrollment(enrollment())
    const file = join(getPlaythroughPath(playthroughId), PLAYTHROUGH_NAME_FILE)
    await writeFile(file, '{incomplete')
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect((await listPlaythroughs())[0].label).toBe('Playthrough 1')
    expect(await readFile(file, 'utf8')).toBe('{incomplete')
    expect(warning).toHaveBeenCalled()
  })

  it('carries names through a real backup and restore even when the mod is off', async () => {
    const { playthroughId } = await writeEnrollment(enrollment())
    await renamePlaythrough(playthroughId, 'Portable name')
    await setModSwitches({ on: { [PLAYTHROUGH_NAMES_MOD]: false }, options: {} })
    const archive = join(root, 'names.zip')
    await exportBackup(archive)
    await writeFile(join(getPlaythroughPath(playthroughId), PLAYTHROUGH_NAME_FILE), JSON.stringify({ name: 'Changed locally' }))
    await importBackup(archive)
    expect(await readPlaythroughName(playthroughId)).toBe('Portable name')
    expect((await listPlaythroughs())[0].label).toBe('Playthrough 1')
  })
})
