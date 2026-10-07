# The Venus Whisper

An optional campus gossip newsletter, accessed from **Game menu → The Venus Whisper**.
It gives the former Journals concept one shared column and discussion, separate from
character profiles, Bunnyboard Updates, and Meanwhile's spectator conversations.

## Playing

- Enable **The Venus Whisper** in Mods. It works with every other optional mod off.
- Select **Read today's issue** at a stable scene/landing. It writes one issue for that
  in-game day from current/previous-day public material. Reading an existing issue is free.
  Skipped days are not backfilled, and nothing generates automatically in the background.
- The byline is anonymous. NPC comments use their regular names, handles and profile pictures.
- Player comments use the player's Bunnyboard profile name and a name-derived handle (for
  example, Sam Rowe becomes `@sam_rowe`). The base game has no separately editable player
  handle. Older player comments saved as `@reader` display and reach reply prompts with the
  name-derived handle; their saved IDs and reply links remain unchanged.
- Comment on the article or select **Reply** on a particular comment. Type `@handle` or use
  **Mention** to tag a known character. NPCs can answer; sometimes other students chime in.
- Direct replies retain their parent comment; comments on the main article are explicitly
  identified as article comments in the reply request. Tags and unambiguous greetings such
  as "Hi, Lili" prioritize that known person. Other commenters are told they are bystanders,
  not the recipient of a greeting meant for somebody else. First names shared by multiple
  known people require a full name or @handle to select one reliably.
- Replies appear with short pauses and typing indicators. They are already saved when their
  reveal starts, so closing the viewer does not lose completed replies.
- If a reply request fails, the player's comment stays saved. **Get replies** retries the
  unanswered comment. A successful batch is not generated twice.
- Discussions remain open today and the next day. Older issues are readable archives.
- **Delete issue**, followed by **Confirm delete issue**, deletes that issue and discussion
  from the active save. It will not be generated again that day. Earlier game saves retain
  their own copies, following the normal save/rewind rules.

Writing an issue and its initial comments uses up to two calls to the configured writer.
A player comment uses at most one reply call. There are no image-generation calls or new
remote services. A quiet day produces a short editorial rather than invented named events.

## The secret columnist

The first publication chooses one enrolled character and saves that choice **before** the
paid writing request. A failed request never rerolls her. New, unrelated games choose their
own author. Loading an earlier save restores the identity and publications in that save.

The author occasionally joins the comments under her ordinary account (a 25% inclusion roll
per batch, or when explicitly addressed). She receives the same comment-generation task as
every other participant. The comment request is never told which person is the author.
It contains the public article, a short thread window, and ordinary character profiles only.
It prohibits identity guesses, insider hints, knowing winks, and conspicuous denials; a
validator rejects several obvious self-identification patterns. Model compliance with tone
and discretion still needs playtesting: a pattern guard cannot understand every implication.

The article request receives a bounded temperament with cast names redacted, not the author's
ID, handle, biography, save memories, relationships, or private conversations. It asks for an
editorial voice without biographical clues or recognizable catchphrases.

Continuing Semesters carries the **same author**, profile snapshot, issues, comments, reply
links and deletion markers. The identity stays even if she graduates, is omitted from the
next roster, or her character file is later unavailable. A previously known columnist can
continue to comment through her saved public profile. Other known readers' public profiles
are kept too, so alumni participation does not single her out. Graduation does not put her back on
the map or change enrollment. Missing portraits fall back to an initial.

Anonymity is a story rule, not encryption: this is a local game, and a player inspecting the
save or code can discover the stored identity. No reveal mechanic is implemented.

## Evidence and roleplay

Sources are limited to up to ten snippets from known characters' recent public posts and
the game's public NPC encounter summaries. Held/pending photo posts, future posts, private
room visits, private DMs, scene transcripts, character notes, relationship memories, SQLite
recall, and Meanwhile's generated dialogue are excluded before the writing request.

The column may interpret those observations, but its speculation is not a new canonical
event. Commenters know only the public thread and their supplied personality, not private
events behind it. Player comments are public statements by the reader, not commands to
change the world's facts.

Scenes and both normal/regenerated DMs can receive at most two relevant issues from today
and yesterday, with selected recent comments. The excerpt is capped at 6,500 characters,
plus a short attribution instruction. The secret identity is never included. The prompt
labels it unreliable public gossip, permits natural reactions when relevant, and grants no
firsthand knowledge or automatic relationship changes. Publication itself does not award
affection, spirit, stats, money or Story Memory facts. Normal scene bookkeeping still applies
to what the reader subsequently does in a scene.

## Source map

| File | Responsibility |
| --- | --- |
| `src/shared/venusWhisper.ts` | Types, optional save augmentation, normalizer, identity selection, public sources, commenter selection, validation, carryover and bounded recall. Pure functions take randomness as an argument. |
| `src/renderer/prompts/venusWhisperPrompt.ts` | Separate editorial and unprivileged public-comment requests; bounded JSON schemas. |
| `src/renderer/stores/venusWhisper.ts` | Publication/comment actions, cancellation and stale-game checks. No component calls the writer directly. |
| `src/renderer/stores/loop/saves.ts` | `writeWhisper` uses the existing serialized autosave lane and current scene checkpoint. Visible state changes only after a successful write. |
| `src/renderer/views/VenusWhisperModal.tsx` | Archive, article, comment thread, replies, mentions, typing presentation, retry and delete. |
| `src/renderer/vu_styles/VenusWhisper.css` | Game palette/font roles, bounded panel and internal scrollers; native hover/motion presets. |
| `src/shared/mods.ts` | Independent anytime switch `venus-whisper`. |
| `src/shared/termCarry.ts`, `termTypes.ts` | Carry `exVenusWhisper` unchanged in calendar terms, including the retained author. |
| `src/renderer/stores/gameStore.ts`, `src/shared/saveRules.ts` | Default, load, reset, optional-field acceptance and save projection. |
| `src/main/ipc.ts`, `src/preload/api.d.ts`, `src/preload/index.ts`, `src/web/bridge.ts` | Cancellable `llm:completeWhisper` structured requests on desktop and browser. |
| `src/renderer/stores/loop/promptState.ts`, `prompts/scenePrompt.ts` | Scene injection of public excerpts only. |
| `src/renderer/stores/textingLoop.ts`, `prompts/textingPrompt.ts` | Same public recall for normal and regenerated texts. |
| `src/renderer/views/GameView.tsx`, `GameMenuModal.tsx` | Dedicated menu entry and modal, independent of character profiles and Updates. |
| `test/venusWhisper.test.ts` | Identity persistence, repeated term rollover, bounded imports, privacy boundaries, duplicate prevention, failed writes and stale requests. |

## Save format and integration

`GameSave.exVenusWhisper` is an optional version-1 object with `author`, `people`, `issues` and
`dismissed`. Existing saves normalize to an empty newsletter. It is declared through module
augmentation, and does not increase the required native save schema. The normalizer copies
only recognized fields, caps articles at 2,400 characters, comments at 600, discussions at
40 comments, public profiles at 128, and the archive/deletion list at 1,000 entries each. This covers the normal
four-year course with room for its daily publications; exceeding the cap retains newer entries.

Each issue's stable key is `whisper:<termIndex>:<dayIndex>`. Original zero-based semester and
day stamps stay on it across a break. They are displayed as human-readable semester/day
numbers. They do not need the date rebasing used by native memories. Comment IDs and reply
links are scoped to an issue; a normalizer drops duplicate IDs and invalid parent links.
Current/previous-day gates compare both semester and day, so an old day-zero issue cannot
become today's issue in a new semester.

Turning the mod off retains the saved identity/archive and disables its menu, generation and
extra prompt context. Semester carryover retains it even while off. Saves/backup exports
already carry optional save fields; no sidecar database or new installer is required.
This does not import legacy EX journal archives or any person's playthrough data.

The mod depends on neither Story Memory/SQLite, Breakthrough, City Life, Meanwhile, nor Photo
Feature. It respects held photo posts when that optional field exists. Story Memory remains
save-authoritative; the newsletter does not write rumors as confirmed SQLite facts.

For integration with the separate semester-carryover PR, retain both additions to
`TermCarry` and `carriedOpening`. The newsletter's carry call remains independent of
`carryModState`: its original term/day stamps deliberately are not shifted at a break.
For integration with the text-regeneration memory fix, retain both `storyMemory` and
`publicGossip` in the regeneration prompt state; they serve separate purposes.

## Validation and handoff

Automated checks cover repeated carryover when the author leaves the roster; save/load and
new-game isolation; malformed archive/thread data; private/future/held material exclusion;
ordinary author comments without privileged prompt fields; repeat publication/reply guards;
closing, loading, time changes and switching off while a response is outstanding; disk failure;
and switching off without erasing data. The native save-field inventory includes the new field.

UI checks use synthetic saves and a stubbed writer, avoiding API charges or real private saves.
Exercise day and night at 1920×1080, 2560×1440, 1280×720 and 1440×1080, including the full
Game menu. Check publication, article scrolling, tags, direct replies, pauses, the older-term
archive, and failure retry. Before release, playtest real-model editorial quality and subtlety
over several days; schema validation cannot certify believable prose or perfect discretion.
