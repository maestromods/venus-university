import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import { appError, messageOf } from '@shared/errors'
import { modOn } from '@shared/mods'
import {
  nameFromSidecar, PLAYTHROUGH_NAME_FILE, PLAYTHROUGH_NAME_VERSION,
  PLAYTHROUGH_NAMES_MOD, validatePlaythroughName
} from '@shared/playthroughNames'
import { assertSafePlaythroughId } from '@shared/saveRules'
import { getPlaythroughPath } from '../paths'
import { writeAtomicJson } from './jsonFile'
import { getModSwitches } from './modsService'

/** Reads a display name without rewriting a sidecar or touching any save. */
export async function readPlaythroughName(id: string): Promise<string | null> {
  assertSafePlaythroughId(id)
  let raw: string
  try {
    raw = await readFile(join(getPlaythroughPath(id), PLAYTHROUGH_NAME_FILE), 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw appError('PLAYTHROUGH_NAME_UNREADABLE', 'Could not read the playthrough name.', messageOf(err))
  }
  try {
    return nameFromSidecar(JSON.parse(raw))
  } catch (err) {
    console.warn('[playthrough-renaming] A saved name could not be read; using its numbered label.', err)
    return null
  }
}

/** Changes only an existing folder's display name; the switch is enforced at the disk boundary. */
export async function renamePlaythrough(id: string, value: unknown): Promise<{ playthroughId: string; label: string }> {
  assertSafePlaythroughId(id)
  if (!modOn(await getModSwitches(), PLAYTHROUGH_NAMES_MOD)) {
    throw appError('MOD_DISABLED', 'Turn on Playthrough renaming in Mods to change a name.')
  }
  const name = validatePlaythroughName(value)
  const folder = getPlaythroughPath(id)
  const exists = await stat(folder).then(info => info.isDirectory()).catch(() => false)
  if (!exists) throw appError('PLAYTHROUGH_NOT_FOUND', 'That playthrough no longer exists.')
  await writeAtomicJson(join(folder, PLAYTHROUGH_NAME_FILE), { schemaVersion: PLAYTHROUGH_NAME_VERSION, name }, {
    code: 'PLAYTHROUGH_UNWRITABLE', message: 'Could not save the playthrough name.'
  })
  return { playthroughId: id, label: name }
}
