import { assertSafePlaythroughId } from '@shared/saveRules'
import { appError } from '@shared/errors'
import { validateRecord } from '@shared/jsonValidate'
import { BREAK_READ, stampBreak, type BreakDraft, type TermBreak } from '@shared/termBreak'
import { database, storage, type PlaythroughRow } from './open'

/**
 * The break played after a finished semester, in the browser's storage: kept on the row of the
 * playthrough it follows, beside that playthrough's record.
 */

/** A playthrough's row with the break it may be carrying. */
type RowWithBreak = PlaythroughRow & { termBreak?: TermBreak }

/** The row one playthrough keeps, or nothing where there is none. */
async function rowOf(playthroughId: string): Promise<RowWithBreak | undefined> {
  return storage('read the playthrough', async () =>
    (await database()).get('playthroughs', playthroughId)
  )
}

/** Reads and validates the break on one playthrough's row; `null` where there is none. */
export async function readBreak(playthroughId: string): Promise<TermBreak | null> {
  assertSafePlaythroughId(playthroughId)
  const stored = (await rowOf(playthroughId))?.termBreak
  if (!stored) return null
  return validateRecord<TermBreak>(stored, playthroughId, BREAK_READ)
}

/** Writes the break onto its playthrough's row, over whatever stood there. */
export async function writeBreak(playthroughId: string, draft: BreakDraft): Promise<TermBreak> {
  assertSafePlaythroughId(playthroughId)
  const stamped = stampBreak(draft, Date.now())
  const row = await rowOf(playthroughId)
  if (!row) {
    throw appError('BREAK_UNWRITABLE', 'Could not write the break.', playthroughId)
  }
  const next: RowWithBreak = { ...row, termBreak: stamped }
  await storage('save the break', async () =>
    (await database()).put('playthroughs', next, playthroughId)
  )
  return stamped
}

/** Takes the break off its playthrough's row; a row without one is left as it is. */
export async function removeBreak(playthroughId: string): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  const row = await rowOf(playthroughId)
  if (!row?.termBreak) return
  const { termBreak: _termBreak, ...rest } = row
  await storage('remove the break', async () =>
    (await database()).put('playthroughs', rest, playthroughId)
  )
}
