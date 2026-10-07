# Text Regeneration

An independent, anytime mod. In a character's Bunnyboard thread, **Regenerate whole reply**
replaces every bubble in the latest completed reply in the current day/time slot. It uses
the configured texting model plus the normal hangout classifier, so it incurs AI calls.
There is no three-message limit: the validated replacement accepts 1–12 messages.

The original remains visible until generation, validation, the plan check, and the autosave
write succeed. Failure keeps the original. It does not regenerate invitations, blocked
threads, failed/in-progress turns, earlier time slots, or exchanges already entering a scene
or hangout. A replacement proposing an immediate hangout or a block is rejected because those
actions have consequences outside the message list. Send a new message to make plans.

## Implementation map

- `src/shared/textRegeneration.ts`: identifies a whole response, rejects unsafe targets,
  restores its input context, validates output, and creates a replacement without mutation.
- `src/shared/types.ts`: optional `ChatMessage.exReplyTo` and `Conversation.exTextBase`
  retain response grouping and the summary before the reply. These legacy-compatible nested
  fields survive the native save serializer; no new database or save schema is required.
- `src/renderer/stores/textingLoop.ts`: normal replies record the checkpoint; regeneration
  uses the existing text busy/cancellation lifecycle and checks playthrough, load, clock,
  scene, mod switch, and conversation identity after asynchronous calls.
- `src/renderer/stores/loop/saves.ts`: writes in the native serialized save lane before
  replacing live data. Unrelated threads and read receipts are preserved.
- `src/renderer/components/TextRegenerate.tsx` and `vu_styles/TextRegenerate.css`: an inline
  thread control using the game's quiet-button hover motion and theme roles.
- `test/textRegeneration.test.ts`: multi-bubble replacement, input checkpoint, restrictions,
  failure recovery, save ordering, and stale-response coverage.

## Context and future Story Memory / SQLite integration

New replies use the summary from **before** the rejected reply. Older saves without that
checkpoint omit the contaminated summary and use at most 160 earlier messages; normal
texting keeps its original history cap. This fallback cannot recover context already lost
before the saved thread began.

The native conversation is authoritative. A future memory index must reconcile the final
message IDs and updated summary after the save succeeds, removing entries for replaced
message IDs. It must not index the private generation result or reuse the rejected summary.
No SQLite API is called here, and combined SQLite behavior still needs integration tests
when that feature is ported. Turning this mod off hides regeneration and stops new grouping
metadata; existing messages and checkpoints remain in saves.

This source port is independent of Plot Twist, Breakthrough, City Life, and Story & Social.
It adds only its own entry to `MODS`. When combining source PRs, retain each registry entry
and each feature's imports at shared integration points.
