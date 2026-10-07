import { cleanSwitches, type ModSwitches } from '@shared/mods'

/**
 * The community mods' switches on the browser build: one small record, kept in the page's own
 * storage rather than a table of the database, which a new table would have to be migrated for.
 */
const KEY = 'vu-mods'

/** Every switch and option, or none set where nothing has been stored or it cannot be read. */
export function readModSwitches(): ModSwitches {
  try {
    return cleanSwitches(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return cleanSwitches(null)
  }
}

export function writeModSwitches(switches: ModSwitches): void {
  localStorage.setItem(KEY, JSON.stringify(cleanSwitches(switches)))
}
