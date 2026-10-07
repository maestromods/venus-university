import { gateBody } from '@shared/characterBody'
import type { Character } from '@shared/types'
import { modOn, PHOTO_FEATURE } from '@shared/mods'
import { getModSwitches } from './services/modsService'
import { getSettings } from './services/settingsService'

/**
 * The character a render draws, as the body switch has her. Read once per render, as it starts:
 * the switch is the player's, and a character sent to be drawn arrives with whatever body her
 * file holds, whether or not it is to be used.
 */
export async function withBodySetting(character: Character): Promise<Character> {
  // Both switches: the feature's own, and the build's for the feature as a whole.
  const on =
    (await getSettings()).bodyDetails === true && modOn(await getModSwitches(), PHOTO_FEATURE)
  return gateBody(character, on)
}
