import { allowedPostTier, settlePhoto, type PhotoTier } from '@shared/photoGate'
import type { SocialPost } from '@shared/types'
import { useGameStore } from './gameStore'
import { canSendPhotos, savePhotoState } from './photoStore'
import { noNsfwImagesOf, useSettingsStore } from './settingsStore'

/**
 * The picture on a post on her feed.
 *
 * What a post may show is flat, unlike a thread's. A post is public — there is no relationship
 * to read, no one reader it is for, and nothing she has been through with anybody changes what
 * her whole year gets to see. `allowedPostTier` says so: a swimsuit is ordinary on a feed, and
 * nothing past it is.
 *
 * The other rule here is that a post she took a picture for **waits for the picture**. She
 * posted both at once or she posted nothing: an hour of text under an empty frame is not what
 * anybody wrote, and a picture that never renders leaves no evidence it was meant to. This is
 * the one place the feed and the thread part company — a bubble on a thread appears at once and
 * fills in, because her words have already landed and the reader is watching them land.
 */

/**
 * What a post's picture is allowed to be, read off the caption she wrote rather than a flag
 * beside it, and capped by the one rule a public feed has.
 */
export function settlePostPhoto(image: string | undefined): { tier: PhotoTier; scene: string } | null {
  const scene = image?.trim()
  if (!scene || !canSendPhotos()) return null

  const allowed = allowedPostTier(noNsfwImagesOf(useSettingsStore.getState()))
  const verdict = settlePhoto({ sendPhoto: true, photoPrompt: scene, allowed })
  if (!verdict.send) {
    if (verdict.note) console.log(`[feed] no picture on a post: ${verdict.note}`)
    return null
  }
  return { tier: verdict.tier, scene }
}

/** The name the post's picture will land under, settled before the post is filed. */
export async function reservePostPhotoName(charId: string): Promise<string | null> {
  const game = useGameStore.getState()
  const character = game.characters[charId]
  if (!character || !game.playthroughId) return null
  const result = await window.api.photo.reserveName(game.playthroughId, character, 'bunnyboard')
  if (result.ok) return result.data
  console.warn(`[feed] no name for a post's picture: ${result.error.code}`, result.error.message)
  return null
}

/**
 * Draws one post's picture and files the post where it landed. Never awaited: the feed is read
 * long after the slot opened, so nothing is kept waiting on a render — but the post itself does
 * not appear until the picture it was written for is on disk.
 *
 * A render that fails takes the post with it, rather than leaving text under an empty frame.
 */
export async function postWhenDrawn(
  charId: string,
  written: SocialPost,
  shot: { tier: PhotoTier; scene: string },
  file: string,
  nudge: (charId: string) => void
): Promise<void> {
  const game = useGameStore.getState()
  const character = game.characters[charId]
  const playthroughId = game.playthroughId
  if (!character || !playthroughId) return

  const result = await window.api.photo.generate(
    playthroughId,
    character,
    shot.tier,
    shot.scene,
    file
  )
  const live = useGameStore.getState()
  // The save may have moved on under a render: a picture from a playthrough the player has left
  // belongs to nothing, and neither does the post that was waiting on it.
  if (live.playthroughId !== playthroughId) return
  if (!result.ok) {
    console.warn(
      `[feed] a post's picture failed, so the post is dropped: ${result.error.code}`,
      result.error.message
    )
    return
  }

  live.appendFeedPost(charId, {
    ...written,
    photo: { tier: shot.tier, scene: shot.scene, file }
  })
  // Held back with the post, since there was nothing to be notified about until now.
  const flags = live.charInfo[charId]?.flags
  if (flags?.gaveContactInfo && !flags.blocked) nudge(charId)
  // The post reached the feed after the slot save was written, so it goes to disk on its own.
  savePhotoState()
  console.log(`[feed] ${character.firstName} posted ${file}`)
}
