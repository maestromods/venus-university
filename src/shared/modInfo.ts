/**
 * The unofficial mods built into this copy of the game, named where a player and anybody reading
 * a screenshot or a log can see them: this is not Venus Dev's own build, and nothing found in it
 * should be reported to him as if it were.
 *
 * A list, so a build that carries more than one mod names each.
 */
export interface ModInfo {
  name: string
  version: string
}

export const MODS: readonly ModInfo[] = [{ name: 'Continuing Semesters', version: '0.1.1' }]

/** `"Continuing Semesters 0.1.1"`, or several joined with commas. */
export function modNames(mods: readonly ModInfo[] = MODS): string {
  return mods.map((mod) => `${mod.name} ${mod.version}`).join(', ')
}

/** The line the main menu prints under the version. */
export function modLine(mods: readonly ModInfo[] = MODS): string {
  return `Modded · ${modNames(mods)} · unofficial`
}
