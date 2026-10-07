/**
 * Whether Photo Feature is acting at all, and its two options, as a build that can switch mods on
 * and off has them set.
 *
 * This build has no such switches: the mod is always on, explicit photos follow only the game's
 * own "No NSFW images", and nothing is hidden, so every answer below is the one it has always
 * been. A build that carries a mods screen sets them through {@link setPhotoSwitches}, at boot and
 * whenever one moves, and every place the mod acts or shows something asks here.
 *
 * Off stops the mod acting: no new photo, no feed comments, no body details. It never deletes
 * anything: every photo, comment and body stays in the save and the character files, and comes
 * back the moment the mod is on again. Whether what already exists stays on screen while it is
 * off is the player's own option.
 *
 * A module of its own, with no imports, so main, preload-facing shared code and the renderer can
 * all read it; each process holds its own copy and the build sets each one.
 */

export interface PhotoSwitches {
  /** The mod itself. */
  on: boolean
  /** Undressed photos may be sent; the game's own "No NSFW images" can still forbid them. */
  explicit: boolean
  /** While the mod is off, photos, the gallery and comments that already exist stay visible. */
  showWhenOff: boolean
}

/** What this build answers: the mod on, nothing forbidden by the mod, nothing hidden. */
export const DEFAULT_PHOTO_SWITCHES: PhotoSwitches = {
  on: true,
  explicit: true,
  showWhenOff: false
}

let current: PhotoSwitches = DEFAULT_PHOTO_SWITCHES
const listeners = new Set<() => void>()

/** Sets the switches, and tells everything showing them. */
export function setPhotoSwitches(next: Partial<PhotoSwitches>): void {
  const merged = { ...current, ...next }
  if (
    merged.on === current.on &&
    merged.explicit === current.explicit &&
    merged.showWhenOff === current.showWhenOff
  ) {
    return
  }
  current = merged
  for (const listener of listeners) listener()
}

/** The switches as they stand; the same object until one moves. */
export function photoSwitches(): PhotoSwitches {
  return current
}

/** For a screen that redraws when a switch moves; answers how to stop listening. */
export function subscribePhotoSwitches(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Whether the mod acts: makes photos, asks for body details, writes feed comments. */
export function photoFeatureOn(): boolean {
  return current.on
}

/**
 * Whether what the mod has already made is on screen: its photos, its gallery and its feed
 * comments. Always while it is on; while it is off, only if the player asked to keep them.
 */
export function photosVisible(switches: PhotoSwitches = current): boolean {
  return switches.on || switches.showWhenOff
}

/**
 * Whether an undressed photo may be sent or uncovered: the mod's own option, and the game's
 * "No NSFW images". Either one is enough to forbid it; neither can allow what the other forbids.
 */
export function explicitPhotosAllowed(
  noNsfwImages: boolean,
  switches: PhotoSwitches = current
): boolean {
  return switches.explicit && !noNsfwImages
}

/**
 * The mod as a mods screen lists it: what a build with one needs to register it. The ids are
 * written to disk there, so they never change once shipped.
 */
export const PHOTO_FEATURE_MOD = {
  id: 'photo-feature',
  name: 'Photo Feature',
  author: 'naudh1r',
  scope: 'anytime',
  defaultOn: true,
  blurb:
    'The girls send photos in their DMs and post them on their feeds, with comments from the rest of campus. Adds a gallery to each contact and optional body details for characters. Needs local image generation.',
  offNote:
    'Off, nobody takes a new photo, posts get no new comments and body details are not used. Nothing is deleted: everything comes back when it is on again.',
  options: [
    {
      id: 'explicit',
      label: 'Explicit photos',
      hint: 'Off, nobody sends an undressed photo, and ones already sent stay covered. Settings → No NSFW images turns them off too.',
      default: true
    },
    {
      id: 'showWhenOff',
      label: 'Show existing photos while the mod is off',
      hint: 'On, photos, galleries and comments already made stay visible while the mod is off. Off, they are hidden until it is on again.',
      default: false
    }
  ]
} as const
