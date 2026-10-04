Venus University Continuing Semesters {{MOD_VERSION}} (unofficial mod)
for a game that already has {{OVER_NAME}} {{OVER_VERSION}}
=============================================================================

This is an unofficial mod. It is not made or supported by Venus Dev.
Please don't report problems with it to Venus Dev.

This download is for players who use naudh1r's {{OVER_NAME}} mod and want
Continuing Semesters as well. It goes on top of {{OVER_NAME}} {{OVER_VERSION}} and
keeps it working. If you don't use {{OVER_NAME}}, take the plain Continuing
Semesters download instead: this one refuses the official game.

Two mods can't simply be stacked, because both change the same few code
files. So this download holds no code files at all, only differences: what
has to change in the files {{OVER_NAME}} installed so that they hold both
mods. Install applies them to the files in your game. None of
{{OVER_NAME}}'s own code is in this zip; it stays naudh1r's to give out.

Everything in it is plain text you can read before running it:

  Install.cmd, Uninstall.cmd   start the patch on the game's own exe
  patch.mjs                    the patch itself (bundled JavaScript)
  payload/delta/               the differences it applies, one per file
  payload/expected.json        the hashes it checks before and after

It contains only code: none of the game's images, music or characters.

You need
--------
- The official Venus University {{GAME_VERSION}} for Windows from itch.io.
- {{OVER_NAME}} {{OVER_VERSION}}, installed with its own setup, and nothing else.
  Exactly that version: a newer or older {{OVER_NAME}} is refused.

Install
-------
1. Close the game.
2. Back up your saves (the "data" folder next to Venus University.exe).
3. Extract this whole zip. If you extract it inside your game folder, the
   scripts find the game by themselves.
4. Double-click Install.cmd. If it asks, paste the path of your game
   folder (the one with "Venus University.exe" in it).

It checks that your game is {{GAME_VERSION}} with {{OVER_NAME}} {{OVER_VERSION}} before changing
anything, checks every file it makes against the hash it should have, and
keeps a backup of the game code as it found it.

Uninstall
---------
Close the game and double-click Uninstall.cmd. It puts the game code back
as it was before, so you are back to {{OVER_NAME}} {{OVER_VERSION}} alone. Your
saves, characters and photos are not touched.

Take the mods out in the reverse order you put them in: this one first,
then {{OVER_NAME}} with its own uninstall. The same goes for updating
{{OVER_NAME}}: uninstall this first, and wait for a download made for the
new version.

If {{OVER_NAME}} was uninstalled or updated first, Continuing Semesters is
already gone from the game with it. Run Uninstall.cmd here once anyway: it
notices, and only clears its own leftover backup.

A semester started by continuing is a playthrough only this mod
understands. After uninstalling, don't expect those saves to load without
it; saves from before you continued are unaffected.

Updates
-------
If you accept an official update in the game, it replaces the modded code
and both mods are gone. Wait for versions made for the new game version.

Credits
-------
Venus Dev, for the game and for publishing its source.
naudh1r, for {{OVER_NAME}}, which this goes on top of, and for the patch
this one is adapted from.

Source code: https://github.com/morrowkiln/venus-university
  semester-0.3         Continuing Semesters
  semester-0.3-photo   both mods merged, which the differences are made from
{{OVER_NAME}}: https://github.com/naudh1r/venus-university
