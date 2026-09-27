import { allowedPhotoTier, isPhotoTier, settlePhoto } from '@shared/photoGate'
import { affectionFor } from '@shared/relationship'
import type { Character, TextingResponse } from '@shared/types'
import { useGameStore } from './gameStore'
import { canSendPhotos, setMessagePhoto } from './photoStore'
import { noNsfwImagesOf, useSettingsStore } from './settingsStore'

/**
 * The picture attached to one reply: settled against the save, hung on her last text as a
 * placeholder, and filled in when the render lands.
 *
 * Never awaited by the turn — a thread that waited on ComfyUI would leave her mid-sentence for
 * half a minute — so everything after the render re-reads the store rather than trusting what it
 * captured before.
 */
export async function sendPhoto(
  charId: string,
  character: Character,
  data: TextingResponse
): Promise<void> {
  const game = useGameStore.getState()
  const info = game.charInfo[charId]

  const verdict = settlePhoto({
    sendPhoto: data.sendPhoto === true,
    photoPrompt: data.photoPrompt ?? '',
    // Her own reading of what she drew, which may raise the caption's but never lower it.
    stated: data.photoTier && isPhotoTier(data.photoTier) ? data.photoTier : undefined,
    allowed: allowedPhotoTier({
      flags: info?.flags,
      affection: affectionFor(info, game.date, character),
      traits: character.traits,
      noNsfwImages: noNsfwImagesOf(useSettingsStore.getState()),
      canRender: canSendPhotos()
    })
  })
  if (!verdict.send) {
    if (verdict.note) console.log(`[texting] no photo from ${character.firstName}: ${verdict.note}`)
    return
  }

  // It hangs on her last text, so the bubble it belongs to is the one she just sent.
  const messages = game.bunnyboard.conversations[charId]?.messages ?? []
  const last = [...messages].reverse().find((message) => message.sender === 'contact')
  const playthroughId = game.playthroughId
  if (!last || !playthroughId) return

  // Her own words for it, kept on the message: this is what the next turn will read back.
  const scene = (data.photoPrompt ?? '').trim()

  // The name before the picture, so the bubble carries it into the save whatever the render does
  // next. A bubble saved without one can never be told what landed, and spins for good.
  const named = await window.api.photo.reserveName(playthroughId, character, 'chat')
  if (!named.ok) {
    console.warn(`[texting] no name for her photo: ${named.error.code}`, named.error.message)
    return
  }
  const file = named.data
  setMessagePhoto(charId, last.id, { tier: verdict.tier, scene, file, pending: true })

  void window.api.photo
    .generate(playthroughId, character, verdict.tier, data.photoPrompt ?? '', file)
    .then((result) => {
      // The save may have moved on under a render: a photo from a playthrough the player has
      // left belongs to nothing.
      if (useGameStore.getState().playthroughId !== playthroughId) return
      if (result.ok) {
        setMessagePhoto(charId, last.id, { tier: verdict.tier, scene, file })
        return
      }
      console.warn(`[texting] her photo failed: ${result.error.code}`, result.error.message)
      // Kept even here: she sent it, whatever ComfyUI did about it.
      setMessagePhoto(charId, last.id, { tier: verdict.tier, scene, file, failed: true })
    })
}
