# City Life source port

Two separate switches appear in Mods. **City Life locations** adds Lucky Strike Lanes,
Starlight Roller Rink, and Purr & Pour Cat Café. **City Life jobs** adds part-time work at
those venues and requires the locations switch. Locations work without jobs or any other mod.

Both choices are fixed when a playthrough is created. A pre-framework playthrough with no
mod list keeps its original world. This port does not rewrite an existing roster's haunts,
jobs, or saves. Changing the menu switches changes future playthroughs; existing ones keep
their recorded choices. Slot saves continue using native location/job IDs and schedules.

## Gameplay

The profile generator can choose the venues as recurring hobbies or fun spots, and NPC
group outings can select them. The native scheduler fits visits around classes and shifts;
not every NPC is guaranteed a visit. The map uses normal known NPC whereabouts: an empty
venue gets no extra Go button. A typed scene prompt can still take the player there.
Each location has day/night background art and lore injected when relevant, not a large
always-on context block. Visiting alone awards no automatic affection or money deductions.

| Job | Pay per shift | Minimum stat tiers |
| --- | --- | --- |
| Lane & Counter Attendant | $125 | Body 2 |
| Rink & Rental Attendant | $150 | Body 2, Heart 2 |
| Café & Cat Lounge Assistant | $140 | Brain 2, Heart 2 |

There is no application fee. Native hiring, scheduling, closure rolls, pay raises, shift
gains, boss texts, absences, and dismissal rules apply. NPC jobs use the same venue IDs, so
workers appear at their workplace through the existing timetable and scene casting.

## Code map and integration

- `src/shared/cityLifeCatalog.ts`: typed venue/job content, preserving `ex_bowling`,
  `ex_roller`, and `ex_cat_cafe` IDs from the earlier mod.
- `src/shared/cityLife.ts`: shared availability rules. Catalog definitions remain readable
  when disabled so saved references can still be displayed. Only selection paths are gated.
- `src/shared/mods.ts`: the two independent registry entries and the jobs requirement.
- `src/renderer/stores/gameStore.ts`: `playthroughMods` reads the immutable record on load.
  It is runtime context, not a second copy inside each save.
- `src/renderer/stores/modsStore.ts`: synchronizes shared availability with the current
  playthrough record, or with menu switches while creating a game.
- `src/shared/locations.ts` and `jobs.ts`: catalog integration and available openings.
- `src/renderer/prompts/profilePrompt.ts`: generation menus, schemas and validation all
  respect the switches; old IDs remain resolvable when reading existing assignments.
- `src/renderer/stores/loop/npc.ts`: filters new outing destinations.
- `src/renderer/prompts/cityLifeLore.ts`, `lorebook.ts` and `stores/gameLoop.ts`: place lore
  and switch-aware rumor selection.
- `src/renderer/stores/loop/promptState.ts`: keeps disabled venue backgrounds out of prompts.
- `src/renderer/views/JobsModal.tsx` and `mapLayout.ts`: native job board and map anchors.
- `assets/bg/interior/{bowling_alley,roller_rink,cat_cafe}_{day,night}.png`: six generated
  venue images discovered by the existing desktop/browser asset pipelines. Attribution and
  redistribution notice are in `city-life-assets.txt` beside this document.
- `test/cityLife.test.ts`: switch isolation, immutable playthrough choices, normal work
  arithmetic, schedule constraints, and map occupancy.

This PR starts from the clean `extracurriculars-core` baseline. When combining it with other
ports, retain all their registry entries and imports. No Story & Social, SQLite, Plot Twist,
Breakthrough, or custom character package is required.

Future SQLite indexing can read the same native scene history, character/job IDs, and location
IDs that already describe visits. No private database or parallel narrative history ships
here. Combined memory behavior must still be tested when Story Memory is ported.
