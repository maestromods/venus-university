import { useSyncExternalStore } from 'react'
import {
  explicitPhotosAllowed,
  photoSwitches,
  photosVisible,
  subscribePhotoSwitches,
  type PhotoSwitches
} from '@shared/photoSwitches'
import { noNsfwImagesOf, useSettingsStore } from './settingsStore'

/** Photo Feature's switches in a component, which redraws when one moves. */
export function usePhotoSwitches(): PhotoSwitches {
  return useSyncExternalStore(subscribePhotoSwitches, photoSwitches, photoSwitches)
}

/** Whether what the mod has already made is on screen: always while it is on. */
export function usePhotosVisible(): boolean {
  return photosVisible(usePhotoSwitches())
}

/**
 * Whether an undressed photo is shut away: the game's "No NSFW images" or the mod's own option.
 * A photo she has already sent stays covered, and cannot be uncovered, while it is.
 */
export function useExplicitBlocked(): boolean {
  const noNsfw = useSettingsStore(noNsfwImagesOf)
  return !explicitPhotosAllowed(noNsfw, usePhotoSwitches())
}
