import { activeSeason } from '@shared/term'
import type { Occasion } from '@shared/types'
import { staticOccasions, SUMMER_VACATION_ID } from './occasions'
import { FALL_TWINS } from './occasionsFall'

/**
 * The milestones a semester holds under a different name in each season, looked up by the
 * spring's id for them: the fall's twin where a fall is being played.
 */

/** The id the active season knows a spring milestone by. */
function seasonalId(springId: string): string {
  return activeSeason() === 'fall' ? (FALL_TWINS[springId] ?? springId) : springId
}

/** The active season's wind-down after finals: summer vacation, or winter break. */
export function windDownOccasion(): Occasion {
  const id = seasonalId(SUMMER_VACATION_ID)
  const occasion = staticOccasions().find((entry) => entry.id === id)
  if (!occasion) throw new Error(`missing academic occasion: ${id}`)
  return occasion
}

/** Whether a closure is that wind-down — the one a boss answers by letting him go. */
export function isWindDown(occasion: Occasion): boolean {
  return occasion.id === seasonalId(SUMMER_VACATION_ID)
}
