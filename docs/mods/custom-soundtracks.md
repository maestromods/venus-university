# Custom soundtracks source port

Custom soundtracks is a self-contained, default-on `anytime` mod, ID `custom-soundtracks`.
It needs the shared Mods framework, but does not depend on renaming, Plot Twist, Story Memory,
SQLite, City Life, or any particular character or save. This guide describes the source port
of the local-audio feature from Maestro's Community Mods 1.8.2 to game 0.3.0.

## Player behavior

Enable **Custom soundtracks** in **Mods**, then open **Settings → Custom soundtracks**.
Choose a game track and import an MP3, OGG or WAV file. Changes save immediately; the parent
Settings form's Cancel button does not undo them. Files must be nonempty, at most 50 MiB
(labelled 50 MB in the UI), and decode to at most 20 minutes. Codec support depends on the
browser/Electron build. A failed selection leaves the old assignment in place.

The ten slots are title, weekday day/night, weekend day/night, ending, and the four venue
styles (electronic, lo-fi, pop and rock). These are soundtrack cues already present in the
game, not additional location rules. Weather, other ambience and effects stay with their
existing cues. Imported title/landing/ending tracks use the Music volume; venue songs use
Ambience and the native venue treatment. Music still follows the game's scene transitions.

Replacement tracks loop by default. **Loop replacement** can instead play a track once per
cue entry. A finished track stays finished through ordinary UI/store updates and changes to
unrelated slots; leaving the cue and returning allows it to play again. Changing that slot's
file or loop setting restarts it. A custom title follows menu visits rather than the stock
title's once-per-session rule. A one-shot custom title ends quietly; it is not cut off by the
stock title's thirty-second run-out. **Current cue** identifies the requested cue even after
a play-once recording finishes, rather than claiming that sound is still playing.

Preview plays the first ten seconds (repeating a shorter recording) through the slot's native
volume group. **Stop preview**, closing the panel, changing slots, changing assignments or
toggling the mod stops it. Preview uses the native snippet path; venue previews are clear,
without the venue's in-world filtering. A currently playing game cue can overlap the preview.

**Restore original** clears that slot's assignment. **Clean up unused imports**, after
confirmation, deletes only unassigned imported copies. It never deletes the original file
the player selected, keeps files shared by another slot, and ignores unrelated filenames.
Turning the mod off restores native cue behavior and keeps all imported files and choices.
No saved playthrough is rewritten and no AI prompt or token budget is involved.

## Source map

| File | Responsibility |
| --- | --- |
| `src/shared/soundtracks.ts` | Mod definition, ten slots, bridge types, limits, legacy map parsing, backup integrity |
| `src/shared/soundtrackLibrary.ts` | Serialized mutations, temporary selection tokens, shared native/web rules |
| `src/shared/mods.ts` | Registers the independent switch, without `requires` |
| `src/main/services/soundtrackService.ts` | Native file storage, bounded reads, SHA-256 and atomic writes |
| `src/main/ipc.ts` | Native file dialog and seven typed soundtrack handlers |
| `src/preload/api.d.ts`, `src/preload/index.ts` | Typed renderer bridge |
| `src/web/soundtracks.ts`, `src/web/bridge.ts` | Browser file picker and IndexedDB storage behind the same API |
| `src/web/db/open.ts` | Database version 6: two additive soundtrack stores |
| `src/renderer/stores/soundtrackStore.ts` | Import/decode/commit actions, busy state, errors and assignment state |
| `src/renderer/stores/soundtrackAudio.ts` | Separate bounded decoded cache, stale-load fencing and fallback |
| `src/renderer/stores/audioEngine.ts` | Replacement buffer resolution, looping, one-shot completion, refresh and preview |
| `src/renderer/stores/audioStore.ts` | Watches changed assignments/mod switch and connects them to native cues |
| `src/renderer/stores/soundscape.ts` | Optional custom title behavior; stock behavior when inactive |
| `src/renderer/views/AppSettingsModal.tsx` | One animated Settings button and child panel |
| `src/renderer/views/SoundtracksModal.tsx` | Native controls, picker, preview, restore, cleanup confirmation |
| `src/renderer/vu_styles/Soundtracks.css` | Day/night panel, bounded body, fixed footer and scrollbar spacing |
| `src/shared/backup.ts`, `src/main/services/backupService.ts`, `src/web/backup.ts` | Portable soundtrack metadata and audio in native backup ZIPs |
| `test/soundtracks.test.ts` | Ownership, expiry, failure recovery, limits, cleanup and invalid backups |
| `test/soundtrackStorage.test.ts` | Real temporary files, old maps, browser migration and cross-backend snapshots |
| `test/soundtrackAudio.test.ts`, `test/soundscape.test.ts` | Playback clocks, off/on, play-once, fallback and stale loads |

## Storage and compatibility

Desktop storage deliberately retains the earlier mod's layout:

```text
data/ex-music/tracks.json
data/ex-music/<sha256>.mp3   (or .ogg / .wav)
```

`tracks.json` is a raw object keyed by one of the ten cue IDs. For example:

```ts
{
  title: { file: '<64 lowercase hex characters>.wav', name: 'my-song.wav', loop: true }
}
```

Old assignments without `loop` default to true. Existing valid maps need no conversion when
the new build uses the same data directory. The port does not search for or copy data from a
different installation. Paths always derive from the game's existing `getDataPath()`.
The map is validated before mutation: malformed JSON or unexpected slots are reported and
left alone, not silently replaced with an empty map. Hash-named files deduplicate identical
imports; assigning one recording to multiple slots does not require multiple disk copies.

The browser uses `soundtrackMeta` (key `tracks`) and `soundtrackFiles` (filename → Blob) in the
existing IndexedDB database. Version 6 creates missing stores and preserves prior rows. A
write of the files and their assignment map is one transaction. Browser quota failures return
through the usual error bridge; the previous committed map remains usable. Browser data is
origin-specific. A desktop folder cannot automatically become browser data: use a backup.

**Browser rollback:** once an origin's database reaches version 6, an older build that opens
it explicitly at version 5 cannot open it. To turn this feature off, use its switch and keep
the additive database schema. Back up data before trying a different build. Do not solve a
version mismatch by deleting an existing database or lowering its recorded schema version.

## Import transaction and integrity

1. Native IPC opens the OS picker; the renderer never supplies a filesystem path. The browser
   uses its own local file picker. The original file is read, never moved or edited.
2. A bounded read rejects empty or oversized files. The library copies the bytes, hashes them,
   and creates a single-use random token bound to the requesting native webContents ID. Tokens
   expire after 60 seconds; cancellation or a new pick invalidates the old one.
3. The renderer decodes the selected bytes using Chromium's audio decoder and checks duration.
   It sends the slot, token and duration, not an arbitrary destination or replacement bytes.
4. The serialized commit checks the switch again, validates slot/duration/token/owner, and
   persists the imported file before the new map. Native writes use the game's atomic-write
   helpers; browser writes use one transaction. A failed native map write can leave an
   unassigned hash-named copy, which cleanup can reclaim, but preserves the old assignment.
5. Only success updates the renderer map. Revision checks keep an older list response from
   overwriting a newer successful edit. Changes are global music preferences, outside saves.

Duration validation is performed by the renderer decoder, not a native media parser. The
50 MiB bound applies before reading/decoding, and decoded duration is checked again during
playback. A SHA-256 check detects damaged or mismatched stored bytes; it is not a signature
establishing who authored a track. Codec decoding remains Chromium's responsibility.

## Playback integration

The port extends the existing Web Audio engine rather than replacing its buses or starting
an unrelated background player. `bufferFor` first asks the custom resolver for an eligible,
enabled assignment; otherwise it uses the original cache. Successfully decoded replacement
buffers are marked separately so stock fallback uses stock loop/end rules.

Changing a slot invalidates only that slot's custom cache and restarts only channels currently
requesting that slot. Switching the feature clears the custom caches and refreshes relevant
music/venue channels. Per-slot revisions reject decode completions from older assignments;
the engine's existing channel tokens reject sources belonging to older cues. A separate
snippet token prevents a preview from appearing after the player has closed its panel.

Custom cache retention is bounded to 128 MiB of decoded samples, separately from stock audio.
A recording larger than that can play but is not retained for later use. This is a cache
limit, not a hard process-memory ceiling: decoder work, active sources, fade tails, original
audio and previews also consume memory. Long stereo recordings can be much larger decoded
than their compressed file size; use short loops where practical.

If an assigned recording is missing, corrupt or undecodable, that slot falls back to original
music and the panel reports the problem. The failed assignment stays recorded so it can be
fixed. Reopening the panel reloads assignments and retries failed slots; changing an assignment
also clears error state. Original missing recordings retain the engine's existing warning and
silent-cue behavior. Disabling the mod does not delete an assignment to hide a failure.

## Backup format and restoration

The existing backup schema stays at 1 with optional `BackupFile.exMusic`, matching the older
compiled mod. Referenced recordings appear as `exMusic/<sha256>.<ext>` beside `backup.json`.
Exports include assigned recordings, not unused imports or original source paths. They do
include user filenames and user-selected audio: backups are personal data, not mod packages.

Imports validate all referenced soundtrack names, byte limits and hashes **before changing
game data**. A missing extension leaves the current music library alone; an explicit empty
map restores original music assignments. Restoring music also works with the feature off.
Browser restore includes the map and files in the same transaction as the rest of the backup,
and shares the library's mutation queue. Desktop restore uses the native backup service's
existing sequence of writes; it is not an all-files transaction. An unrelated disk failure
partway through native restore can leave a partial overall restore, as in the base service.
Always keep the original backup until a restore is verified. The app reloads after success,
so hydrated settings, cached music and other stores restart from the restored data together.

## Porting again

Keep the stable mod ID and the storage/backup keys. When the target game changes, inspect
`AUDIO_FILES` first: every `SOUNDTRACK_LABELS` key must still be a real music/venue cue. Follow
native changes in `bufferFor`, `begin`, `armEnd`, the snippet path and the audio-store
subscriptions. Preserve one-shot completion and per-slot invalidation; repeatedly resetting
the cue defeats play-once even when `source.loop` is false. Keep the title override gated.

Next check the bridge interface, native handler convention, backup entry classifier and the
current IndexedDB schema version. If the target has independently introduced version 6,
merge migrations and choose the next version rather than overwriting its schema. Keep a
separate soundtrack modal and the native gesture helpers when integrating Settings.

Run type checks, the full tests, desktop and browser builds, then UI/audio tests with a short
generated WAV. Verify a short title loops past its duration, play-once remains finished,
unrelated edits do not restart it, disabling falls back, preview stops on close, and corrupt
backups are rejected before writes. Exercise day/night at 16:9 and 4:3. See the handoff's
`VALIDATION.md` for results and remaining playtest boundaries.

No songs, generated music, game art, personal saves, conversations or credentials are included
in this source port. It adds no remote downloads, new telemetry, or AI calls.
