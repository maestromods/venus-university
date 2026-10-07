# Plot Twist source port

Plot Twist is an independent, default-on `anytime` mod (`plot-twist`). Its only dependency is
the shared mod framework. It does not need Story Memory, SQLite, or another community feature.

## Player behavior

Turn it on in **Mods**, then open **Game menu → Plot Twist** during a playthrough. Write one
ongoing direction, up to 10,000 JavaScript string characters, and choose **Apply twist**. New
scene requests include that direction until it is replaced, cleared, or the mod is switched
off. Applying or clearing writes an autosave, including the current native scene checkpoint.
It does not replace manual saves or older boundary saves. Loading an older save restores that
save's own twist. **Back**, Escape, and the veil discard unapplied edits.

The editor waits while the game cannot safely save (including generation, pending text
messages, error/retry states, and status editing). It cannot change an already-generated reply.
Previously established events remain in the story after clearing or disabling the direction.
The model is asked to introduce secrets through plausible discoveries and preserve established
facts; this is narrative guidance, not guaranteed obedience or a direct mechanical mutation.

## Code map

| File | Responsibility |
| --- | --- |
| `src/shared/plotTwists.ts` | Registry definition, limit, validation, legacy reading, bounded active text, optional save type |
| `src/shared/mods.ts` | Registers the independent switch; no `requires` |
| `src/shared/saveRules.ts` | Keeps `exPlotTwist` optional for older saves |
| `src/renderer/stores/gameStore.ts` | Initializes, loads, resets, and serializes `exPlotTwist` |
| `src/renderer/stores/loop/saves.ts` | `writePlotTwist`, native save gating, serialization, failure handling and run/load fencing |
| `src/renderer/stores/loop/promptState.ts` | Reads the switch when building request state |
| `src/renderer/prompts/plotTwist.ts` | Pure story-direction prompt block |
| `src/renderer/prompts/scenePrompt.ts` | Cast opening, continuation and closing; solo-scene hook |
| `src/renderer/views/GameMenuModal.tsx` | Optional native animated menu entry |
| `src/renderer/views/GameView.tsx` | Mounts the editor as a blocking panel, preventing scene input underneath |
| `src/renderer/views/PlotTwistModal.tsx` | Draft editing, counter, apply/clear, pending/error feedback |
| `src/renderer/vu_styles/PlotTwist.css` | Native day/night colors, text-well scrolling and fixed actions |
| `test/plotTwist.test.ts` | Legacy data, save checkpoints, write ordering, failures, and stale completions |
| `test/plotTwistPrompt.test.ts` | On/off routing into actual scene builders and immutable captured requests |

## Save compatibility and transaction

The old compiled mod already used `exPlotTwist`. This port keeps that field and schema 12.
Missing/non-string legacy values become an empty string; valid strings load verbatim. An
oversized legacy string survives round trips, but only the first 10,000 characters of its
trimmed copy go to scene prompts. New edits over the limit are rejected, never silently cut.
Native save services stamp and serialize the optional field with the rest of the save, on
desktop and in the browser. No separate database, sidecar, IPC channel or migration is added.

The write action validates first, takes the existing manual-save lock, and joins the loop's
write queue. At its turn it rechecks the mod switch, safe-save gate, playthrough ID, load
counter, and run token. It derives a native `manualSaveDraft`; only a true scene-less landing
may fall back to `toGameSave()` with `scene: null`. The new twist overlays that draft, then the
native autosave bridge writes it. Only a successful response in the same loaded run commits
the live value. A queued stale operation performs no write. A write already sent may finish
in the old playthrough, but its result never changes the newly loaded game.

During status playback, the native checkpoint can be `loopState.statusBase`, captured before
status rewards were applied. Updating both its twist and the live twist after success avoids
losing the edit at the next save; its money, ledger and playback position remain untouched.
Disk/IndexedDB failure keeps the previous live value and the UI draft for retry. The modal
cannot be dismissed during its own write, so the player cannot advance underneath it.

## Prompt scope and cost

The active text is included once in the `user` portion of cast opening, continuation and
closing requests and solo-scene requests. The system message, schema and cache key are
unchanged. It is not directly added to classifiers, ledgers, slot introductions, text
messages, character generation, or unrelated prompts. Native summaries can naturally carry
events that result from a twist after they happen in a scene. It does not grant stats, flags,
inventory or calendar events directly, and is not a replacement for persistent memory.

Each supported scene request pays for the active text again; short directions cost less.
Turning the mod off omits the direction from newly built requests but preserves saved text.
Already captured, prefetched, or retried requests retain their original contents. This is
deliberate: changing the switch does not rewrite a request already in flight.

## Extending or porting again

Keep the data field and mod ID stable. Move hooks to the new source equivalents rather than
reintroducing compiled-bundle string replacement. Reuse the new version's save queue and
checkpoint logic; do not write a mid-scene save from a plain UI snapshot. If that game changes
save schemas, use its official migration before loading older saves. This port alone is not
a general 0.2.0-to-0.3.0 save converter.

Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run build:web`. Check the editor
and menu in both themes, with a long twist, during an unsafe save point, after a failed write,
and after turning the switch off and back on. Check that queued reply lines survive reload.
Use synthetic saves; no personal save data is needed for any of these checks.
