import type { BackupFile } from './backup'
import { appError } from './errors'

export const PLAYTHROUGH_NAMES_MOD = 'playthrough-renaming'
export const PLAYTHROUGH_NAME_FILE = '.ex-name'
export const PLAYTHROUGH_NAME_VERSION = 1
export const PLAYTHROUGH_NAME_LIMIT = 80

/** A display name, trimmed only after controls and line breaks have been refused. */
export function validatePlaythroughName(value: unknown): string {
  if (
    typeof value !== 'string' || !value.trim() ||
    value.trim().length > PLAYTHROUGH_NAME_LIMIT || /[\u0000-\u001f\u007f\u2028\u2029]/.test(value)
  ) {
    throw appError('PLAYTHROUGH_NAME_INVALID', 'Enter a playthrough name of 1–80 characters, on one line.')
  }
  return value.trim()
}

/** Reads a name sidecar, including the unversioned shape written by the archive-patch release. */
export function nameFromSidecar(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw appError('PLAYTHROUGH_NAME_INVALID', 'The saved playthrough name is malformed.')
  }
  const file = value as { schemaVersion?: unknown; name?: unknown }
  if (file.schemaVersion !== undefined && file.schemaVersion !== PLAYTHROUGH_NAME_VERSION) {
    throw appError('PLAYTHROUGH_NAME_VERSION', 'The saved playthrough name uses an unsupported version.')
  }
  return validatePlaythroughName(file.name)
}

/** Checks every carried name before a restore changes any settings or saves. */
export function validateBackupPlaythroughNames(record: BackupFile): void {
  for (const row of Object.values(record.playthroughs)) {
    if (row.exName !== undefined) validatePlaythroughName(row.exName)
  }
}

declare module './backup' {
  interface BackupPlaythrough {
    /** The playthrough's display name, kept even while its editing switch is off. */
    exName?: string
  }
}
