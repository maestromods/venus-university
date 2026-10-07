import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { openDB } from 'idb'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { APP_ID } from '@shared/appId'

let root = ''
vi.mock('electron', () => ({ app: { isPackaged: false, getAppPath: () => root, getPath: () => root } }))
vi.mock('../src/web/mods', () => ({ readModSwitches: () => ({ on: {}, options: {} }) }))
const bytes = new Uint8Array([1, 2, 3, 4])
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'venus-soundtracks-'))
  globalThis.indexedDB = new IDBFactory()
  vi.resetModules()
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

it('round-trips desktop storage and leaves the selected source untouched during cleanup', async () => {
  const { soundtrackLibrary: lib, pickSoundtrack, soundtrackDirectory } = await import('../src/main/services/soundtrackService')
  const source = join(root, 'original.WAV')
  await writeFile(source, bytes)
  const picked = await pickSoundtrack(source, 12)
  const map = await lib.commit('landing_night', picked.token, 5, 12)
  const file = map.landing_night!.file
  expect(new Uint8Array(await readFile(join(soundtrackDirectory(), file)))).toEqual(bytes)
  expect(await lib.read('landing_night')).toEqual(bytes)
  await lib.remove('landing_night')
  expect(await lib.cleanup()).toEqual({ count: 1 })
  expect(new Uint8Array(await readFile(source))).toEqual(bytes)
})

it('loads legacy desktop assignments and refuses to overwrite a corrupt assignment map', async () => {
  const { soundtrackLibrary: lib, soundtrackDirectory, soundtrackHash } = await import('../src/main/services/soundtrackService')
  await mkdir(soundtrackDirectory(), { recursive: true })
  const file = await soundtrackHash(bytes) + '.wav'
  const path = join(soundtrackDirectory(), 'tracks.json')
  await writeFile(join(soundtrackDirectory(), file), bytes)
  await writeFile(path, JSON.stringify({ title: { file, name: 'legacy.wav' } }))
  expect((await lib.list()).title?.loop).toBe(true)
  await writeFile(path, '{bad json')
  await expect(lib.remove('title')).rejects.toThrow()
  expect(await readFile(path, 'utf8')).toBe('{bad json')
})

it('upgrades browser storage without changing existing rows', async () => {
  const old = await openDB(APP_ID, 5, { upgrade(db) { db.createObjectStore('log') } })
  await old.put('log', 'existing data', 'log'); old.close()
  const { database } = await import('../src/web/db/open')
  const db = await database()
  expect(db.version).toBe(6)
  expect(await db.get('log', 'log')).toBe('existing data')
  expect(db.objectStoreNames.contains('soundtrackFiles')).toBe(true)
  db.close()
})

it('moves a verified desktop snapshot to browser storage and back without changing hashes', async () => {
  const native = await import('../src/main/services/soundtrackService')
  const web = await import('../src/web/soundtracks')
  const picked = await native.soundtrackLibrary.pick('song.wav', bytes, 7)
  await native.soundtrackLibrary.commit('venue_pop', picked.token, 4, 7)
  const snapshot = await native.soundtrackLibrary.snapshot()
  await web.soundtrackLibrary.restore(snapshot)
  expect(await web.soundtrackLibrary.read('venue_pop')).toEqual(bytes)
  expect(await web.soundtrackLibrary.snapshot()).toEqual(snapshot)
  await web.soundtrackLibrary.loop('venue_pop', false)
  await native.soundtrackLibrary.restore(await web.soundtrackLibrary.snapshot())
  expect((await native.soundtrackLibrary.list()).venue_pop?.loop).toBe(false)
  const { database } = await import('../src/web/db/open'); (await database()).close()
})

it('round-trips the native backup ZIP including soundtrack files', async () => {
  const { soundtrackLibrary: lib } = await import('../src/main/services/soundtrackService')
  const { exportBackup, importBackup } = await import('../src/main/services/backupService')
  const pick = await lib.pick('song.wav', bytes, 7)
  const map = await lib.commit('title', pick.token, 8, 7)
  const archive = join(root, 'backup.zip')
  await exportBackup(archive)
  await lib.remove('title'); await lib.cleanup()
  await importBackup(archive)
  expect(await lib.list()).toEqual(map)
  expect(await lib.read('title')).toEqual(bytes)
})
