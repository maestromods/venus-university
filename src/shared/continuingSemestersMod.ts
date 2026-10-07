import type { ModDef } from './mods'

/** Stable, and written to disk: it never changes. */
export const CONTINUING_SEMESTERS = 'continuing-semesters'

/**
 * Continuing Semesters as the Mods screen lists it: its text, its switch and its options. Kept
 * with the mod rather than in the build's list, which only names it. The option ids are written
 * to disk too, so they never change once shipped.
 */
export const CONTINUING_SEMESTERS_MOD: ModDef = {
  id: CONTINUING_SEMESTERS,
  name: 'Continuing Semesters',
  author: 'morrowkiln',
  version: '0.2.0',
  scope: 'anytime',
  defaultOn: true,
  blurb:
    'Carry a finished semester into the next one, with a break to play in between. Seniors graduate, everybody else moves up a year, and new girls can join.',
  offNote:
    'Off, a finished semester no longer offers the next one. Semesters and breaks already started keep working.',
  options: [
    {
      id: 'play-the-break',
      label: 'Play the break between semesters',
      hint: 'Off, the break is skipped and what everybody remembers of it is written for you.',
      default: true
    },
    {
      id: 'seniors-graduate',
      label: 'Seniors graduate',
      hint: 'Off, seniors stay on as seniors for another year, and can come back with everyone else.',
      default: true
    },
    {
      id: 'offer-in-load-game',
      label: 'Offer continuing in Load Game',
      hint: 'Off, only the ending screen offers the next semester.',
      default: true
    }
  ]
}
