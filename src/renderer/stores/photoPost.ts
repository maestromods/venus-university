import { allowedPostTier, settlePhoto } from '@shared/photoGate'
import { useGameStore } from './gameStore'
import { canSendPhotos, savePhotoState, setFeedPostPhoto } from './photoStore'
import { noNsfwImagesOf, useSettingsStore } from './settingsStore'

/**
 * The picture on a post on her feed.
 *
 * The same two moves the thread makes, with one difference: what a post may show is flat. A post
 * is public — there is no relationship to read, no one reader it is for, and nothing she has been
 * through with anybody changes what her whole year gets to see. `allowedPostTier` says so: a
 * swimsuit is ordinary on a feed, and nothing past it is.
 *
 * The post is appended by the caller and the picture arrives on it afterwards, rather than the
 * post being held back until the render lands. A feed is read long after the slot opened, so a
 * post that shows up without its photograph still reads — and holding it back would put a render
 * in front of the teaser and nudge logic that runs as each post lands.
 */
export async function startPostPhoto(
  charId: string,
  postId: string,
  image: string | undefined
): Promise<void> {
  const scene = image?.trim()
  if (!scene || !canSendPhotos()) return

  const verdict = settlePhoto({
    sendPhoto: true,
    photoPrompt: scene,
    allowed: allowedPostTier(noNsfwImagesOf(useSettingsStore.getState()))
  })
  if (!verdict.send) {
    if (verdict.note) console.log(`[feed] no picture on a post: ${verdict.note}`)
    return
  }

  const game = useGameStore.getState()
  const character = game.characters[charId]
  const playthroughId = game.playthroughId
  if (!character || !playthroughId) return

  // The name before the picture, so the post carries it into the save whatever the render does
  // next — the one thing `settlePendingPhotos` has to look for.
  const named = await window.api.photo.reserveName(playthroughId, character, 'bunnyboard')
  if (!named.ok) {
    console.warn(`[feed] no name for a post's picture: ${named.error.code}`, named.error.message)
    return
  }
  const file = named.data
  setFeedPostPhoto(charId, postId, { tier: verdict.tier, scene, file, pending: true })
  savePhotoState()

  const result = await window.api.photo.generate(
    playthroughId,
    character,
    verdict.tier,
    scene,
    file
  )
  // The save may have moved on under a render: a picture from a playthrough the player has left
  // belongs to nothing, and neither does the post that was waiting on it.
  if (useGameStore.getState().playthroughId !== playthroughId) return
  if (!result.ok) {
    console.warn(`[feed] a post's picture failed: ${result.error.code}`, result.error.message)
    setFeedPostPhoto(charId, postId, { tier: verdict.tier, scene, file, failed: true })
    savePhotoState()
    return
  }
  setFeedPostPhoto(charId, postId, { tier: verdict.tier, scene, file })
  savePhotoState()
  console.log(`[feed] ${character.firstName} posted ${file}`)
}
