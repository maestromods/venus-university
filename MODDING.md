# Mods in this build

This branch is a proposal for how the community mods share one build: every mod's code is
always in the game, and a switch decides whether it acts. Players turn mods on and off from
**Mods** on the main menu; nothing is chosen at install time.

The frame alone, with no mods, is the `extracurriculars-core` branch: one commit on the game as
Venus Dev released it. This branch adds Continuing Semesters and Photo Feature on top as the
worked examples.
This source port adds Playthrough renaming to the framework on Venus University 0.3.0.
Its `anytime` switch controls display and editing of custom names; names stay in storage and
backups while off. The storage service also enforces the switch before writing a new name.

## The three things a mod does

**1. Register** in `MODS`, in `src/shared/mods.ts`:

```ts
{
  id: 'city-life-locations',        // written to disk: never changes once shipped
  name: 'City Life locations',
  author: 'Maestro Leeds',
  version: '1.7.1',
  scope: 'playthrough',             // or 'anytime', see below
  defaultOn: true,
  blurb: 'Three new places on the map.',
  requires: [],                     // ids of mods this one cannot act without
  options: [{ id: 'some-option', label: '…', hint: '…', default: true }]
}
```

That is all the Mods screen, the main menu's count and the log need.

Options that are one choice among several share a `group`, and the mod names the group in
`optionGroups`. One option of a group is on at a time: turning one on turns the others off, and
the one that is on stays on until another is picked. The Mods screen shows a group as one box,
with the group's label and hint once and a row for each choice. They are still plain on/off
values in `data/mods.json`.

```ts
options: [
  { id: 'loader-bunny', label: 'Bunny hop', hint: '', default: true, group: 'loader' },
  { id: 'loader-dots', label: 'Typing dots', hint: '', default: false, group: 'loader' }
],
optionGroups: [{ id: 'loader', label: 'Loading animation', hint: 'The animation shown while…' }]
```

**2. Ask before acting**, wherever the mod would do something:

```ts
// in a component
const on = useModOn('city-life-locations', record)
// anywhere else in the renderer
if (modIsOn('city-life-locations', record)) { … }
// in main or shared code, with the switches in hand
modOn(switches, 'city-life-locations', record)
```

An option is read the same way: `useModOption(modId, optionId)` or `optionOn(switches, …)`.

**3. Keep its data when it is off.** Off stops a mod acting. It never deletes what the mod
wrote, so a save always loads and switching back on finds everything where it was.

## The two kinds of switch

- **`anytime`**: read where the mod acts. The player can flip it whenever they like. Use it
  for anything a save does not depend on.
- **`playthrough`**: fixed when a playthrough starts. The playthrough's record names the mods
  it started with (`record.mods`), and `modOn(…, record)` answers from that, whatever the
  switch says later. The switch is what a *new* playthrough gets. Use it for a mod that changes
  the game's rules or adds things a save refers to.

Pass the playthrough's record whenever there is one. With none, a `playthrough` mod answers
what a new playthrough would get. A record written before this list existed names no mods, so
no `playthrough` mod is on for it.

A mod whose requirement is off is off too, and comes back when the requirement does; its own
switch is left as the player set it.

## Where it is stored

- `data/mods.json`: the player's switches and options, `{ schemaVersion, on, options }`. A mod
  or option missing from it is at its default, so adding a mod needs no migration. Ids this
  build does not know are kept.
- `playthrough.json`: `mods`, the `playthrough` mods that playthrough started with.

## Where the code is

| File | What it is |
| --- | --- |
| `src/shared/mods.ts` | The list, the switches' shape and every rule above. |
| `src/main/services/modsService.ts` | Reads and writes `data/mods.json`. |
| `src/renderer/stores/modsStore.ts` | The switches in the renderer, and the hooks. |
| `src/renderer/views/ModsModal.tsx` | The Mods screen. |
| `test/mods.test.ts` | The rules, tested against a list with every shape of mod. |

## How Continuing Semesters uses it

Its entry in `MODS` is `CONTINUING_SEMESTERS_MOD` from `src/shared/continuingSemestersMod.ts`,
so its name, text and options live with the mod and `mods.ts` only lists it. That is the
convention: each mod keeps its own entry in a file of its own.

It is `anytime`. Off, the ending screen and Load Game stop offering the next semester (two
checks: `GameView.tsx`, `LoadGameModal.tsx`). A semester or a break already started keeps
working, because the code is still there. It has three options: one skips the break between
semesters as it opens (`BreakView.tsx`), one keeps seniors from graduating, and one turns the
Load Game offer off alone.

The seniors option shows how a rule in shared code reads a switch without holding any: the
rule keeps a flag (`setSeniorsGraduate` in `shared/term.ts`), and `modsStore.ts` sets it at
boot and whenever a switch moves.

## How Photo Feature uses it

It is `anytime`, and it checks its own switch: the mod keeps its switches in
`src/shared/photoSwitches.ts` and asks there wherever it acts, so the build only hands them
over. That is three places:

- `photoSwitchesOf(switches)` in `mods.ts` turns the Mods screen's switches into the mod's own.
- `modsStore.ts` passes them to `setPhotoSwitches` at boot and whenever a switch moves.
- `modsService.ts` does the same in main, when the switches are read or written. Main keeps its
  own copy because body details are drawn there.

Its entry in `MODS` is `PHOTO_FEATURE_MOD` from `photoSwitches.ts`, with the version added, so
its name, text and options come from the mod.

Off, nobody sends a new photo, posts get no new comments, body details are not used and likes
are the game's own. Photos, galleries and comments already made are hidden, not deleted. Its
options:

- **Photo generation**: off, no new photos are made and characters are not told they can send
  one. Photos already sent stay visible.
- **Explicit photos**: off, nobody sends an undressed photo and ones already sent stay covered.
  The game's own "No NSFW images" turns them off too.
- **Loading animation**: a group of three, Bunny hop, Dot shimmer and Typing dots.

These used to be in the game's Settings. `modsService.ts` carries a player's old choice over
(`withPhotoSettingsCarried`) until the Mods screen stores its own.

Option ids are written to disk, so they never change: `photos`, `explicit`, `loader-bunny`,
`loader-shimmer`, `loader-dots`. `test/photoHooks.test.ts` fails if the handover in `modsStore.ts`
or `modsService.ts` goes missing.

## Not decided yet

- The build's name and version (`BUILD` in `mods.ts`).
- Whether `data/mods.json` goes into the game's own backup; it does not today.
- How a mod that patches the built code, rather than the source, reads its switch.
