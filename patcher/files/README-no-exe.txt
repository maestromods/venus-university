Venus University Continuing Semesters {{MOD_VERSION}} (unofficial mod) - no-exe version
=============================================================================

This is an unofficial mod. It is not made or supported by Venus Dev.
Please don't report problems with it to Venus Dev.

This package does the same as the setup exe, without an exe. Everything in
it is plain text you can read before running it:

  Install.cmd, Uninstall.cmd   start the patch on the game's own exe
  patch.mjs                    the patch itself (bundled JavaScript)
  payload/                     the five code files it installs, and
                               expected.json: the hashes it checks first

It contains only code: none of the game's images, music or characters.
You need the official Venus University {{GAME_VERSION}} for Windows from itch.io.

Install
-------
1. Close the game.
2. Back up your saves (the "data" folder next to Venus University.exe).
3. Extract this whole zip. If you extract it inside your game folder, the
   scripts find the game by themselves.
4. Double-click Install.cmd. If it asks, paste the path of your game
   folder (the one with "Venus University.exe" in it).

It checks that your game is the official {{GAME_VERSION}} before changing anything,
keeps a backup of the original game code, and refuses a game that already
has another mod in it.

Uninstall
---------
Close the game and double-click Uninstall.cmd. It puts the original game
code back, so the game is exactly the official version again. Your saves
and characters are not touched.

A semester started by continuing is a playthrough only this mod
understands. After uninstalling, don't expect those saves to load in the
official game; saves from before you continued are unaffected.

Updates
-------
If you accept an official update in the game, it replaces the modded code
and the mod is gone. Uninstall and wait for a version of this mod made for
the new game version.

Credits
-------
Venus Dev, for the game and for publishing its source.
The patch is adapted from naudh1r's Photo Feature mod.

Source code: https://github.com/morrowkiln/venus-university
