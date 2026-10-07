import { rm } from 'fs/promises'
import { appError, messageOf } from '@shared/errors'
import { assertSafePlaythroughId } from '@shared/saveRules'
import {
  BREAK_READ,
  BREAK_UNREADABLE,
  stampBreak,
  type BreakDraft,
  type TermBreak
} from '@shared/termBreak'
import { getBreakPath } from '../paths'
import { readValidatedJson, writeAtomicJson } from './jsonFile'

/** The break played after a finished semester, on disk in that semester's own folder. */

/** Reads and validates the break waiting in one folder; `null` where there is none. */
export async function readBreak(playthroughId: string): Promise<TermBreak | null> {
  assertSafePlaythroughId(playthroughId)
  const path = getBreakPath(playthroughId)
  let missing = false
  const read = await readValidatedJson<TermBreak>(path, {
    ...BREAK_READ,
    unreadable: BREAK_UNREADABLE,
    // Nothing is read from the stand-in: the flag is what the caller goes by.
    onMissing: () => {
      missing = true
      return {} as TermBreak
    }
  })
  return missing ? null : read
}

/** Writes the break over whatever stood there, stamping the version this build owns. */
export async function writeBreak(playthroughId: string, draft: BreakDraft): Promise<TermBreak> {
  assertSafePlaythroughId(playthroughId)
  const stamped = stampBreak(draft, Date.now())
  await writeAtomicJson(getBreakPath(playthroughId), stamped, {
    code: 'BREAK_UNWRITABLE',
    message: 'Could not write the break.'
  })
  return stamped
}

/** Removes the break from one folder; one that is not there is already removed. */
export async function removeBreak(playthroughId: string): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  try {
    await rm(getBreakPath(playthroughId), { force: true })
  } catch (err) {
    throw appError('BREAK_UNREMOVABLE', 'Could not remove the break.', messageOf(err))
  }
}
