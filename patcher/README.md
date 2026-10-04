# Setup wizard

Builds `Continuing-Semesters-Setup-<version>.exe`, a small setup wizard that installs the mod
into an **official** Venus University folder and uninstalls it again. It contains only code:
none of the game's images, music or characters. Players need only the official game from
itch.io and nothing else installed.

Adapted from the setup of naudh1r's Photo Feature mod
(https://github.com/naudh1r/venus-university, AGPL-3.0-only), with thanks.

## How it works

- `Setup.cs` is the wizard: one window to pick the game folder, then Install or Uninstall. It is
  plain C# for the .NET Framework that comes with Windows 10 and 11.
- `patch.mjs` does the work. It is zipped inside the exe together with the files it installs,
  and checked against a SHA-256 before it runs.
- It runs on the game's own exe. Venus University is an Electron app, and with
  `ELECTRON_RUN_AS_NODE=1` its exe is a plain Node.js, so no Node.js ships with the mod.

`Setup.exe install "<game folder>"` and `Setup.exe uninstall "<game folder>"` do the same
without the window.

## The no-exe download

The build also writes `Continuing-Semesters-<version>-no-exe.zip`: the same `patch.mjs` and
payload with two small launchers, `Install.cmd` and `Uninstall.cmd` (in `files/`), in place of
the wizard. They start the patch on the game's own exe the same way and show what it prints.

This is the download to offer. Antivirus tools flag an unsigned exe that unpacks a zip and
rewrites another program's files, which is exactly what the wizard does, and asking players to
make an exception for it is bad practice. Everything in the zip can be read before it is run.

## Going on top of Photo Feature

Two mods cannot be installed one after the other as they are: each replaces the same few
bundles (`out/main/index.js`, the renderer's one script and one stylesheet), so the second
would wipe the first. What goes on top of another mod is therefore a build of both mods'
source merged. The download does not carry that build, which would mean giving out the other
mod's code: it carries one delta per code file, and install makes each merged file from the
other mod's installed file and its delta, then checks the result's hash.

The same download does both. Given a game, the patch looks for the other mod's marker
(`resources/photo-mod.json`): with it, it applies the deltas; without it, it holds the game to
the official one and puts in the whole files. It is built with four `out` folders:

```
node build.mjs --base <official out> --mod <out of semester-0.3>
               --game-version 0.3.0 --mod-version 0.1.1
               --over photo-feature --over-version 1.1.3
               --over-base <out of a game with Photo Feature installed>
               --over-mod <out of semester-0.3-photo>
```

- `--over-base` must come from the other mod's real download: install it into a copy of the
  official game with its own setup, then extract that `app.asar`. Its hashes are what a
  player's game is checked against.
- `--over-mod` is `npx electron-vite build` on `semester-0.3-photo`, which is `semester-0.3`
  merged with naudh1r's release tag.
- The deltas go under `payload/over/photo-feature/`, in Fossil's delta format, made and applied
  with the `fossil-delta` package (BSD), which is bundled into `patch.mjs`. A bundle whose name
  carries a content hash (`index-CQ260QeK.js`) is made from the other mod's bundle of the same
  name without the hash.
- Without the `--over` arguments the download is for the official game only.

Install asks for exactly that version of the other mod, and uninstall puts back the game as
that mod left it.

It is tied to one version of the other mod. When naudh1r releases, merge the new tag into
`semester-0.3-photo` and rebuild; until then the download refuses a game with the new version,
and still installs on the official game.

## When the game changes underneath

The marker records the hash of the `app.asar` the install wrote. If the archive is no longer
that one (an official update, or the other mod uninstalled or updated while this one sat on top
of it), the mod is already gone and its backup is out of date. Uninstall, and a new install,
then delete the backup and marker instead of restoring code the game has moved on from.

## What it changes in the game folder

- `resources/app.asar`: the few code files the mod changes are swapped for the mod's.
  Everything else inside stays the official one.
- A backup of the original `app.asar` (and `app.asar.unpacked`), and
  `resources/continuing-semesters-mod.json`, which uninstall uses to put everything back.

Before changing anything, install checks the game is the official version the mod was built for:
the version in `resources/build-manifest.json`, and the hash of every code file it replaces.

## Building a new version

You need two `out` folders of the game's code:

1. **The official one**, taken out of the shipped game:
   `npx @electron/asar extract "<game>/resources/app.asar" official`, then use `official/out`.
   Its files are the hashes the setup checks a player's game against, so they must come from
   the release itself. A build of Venus Dev's source at the release's commit gives the same
   JavaScript byte for byte, but its CSS differs in line endings.
2. **This mod**, built on that same release: `npx electron-vite build` on this branch, then use
   its `out`.

Then, in this folder:

```
npm install
node build.mjs --base <official out> --mod <mod out> --game-version 0.3.0 --mod-version 0.1.0
```

The wizard is always compiled on Windows, with the C# compiler that comes with Windows. An exe
compiled elsewhere (Mono's `mcs`, for example) works, but Windows Defender blocks it.

- **On Windows**, `build.mjs` compiles it straight away.
- **Anywhere else**, it leaves `build-setup.cmd` in `dist/` with the payload and the wizard's
  source. Copy `dist/` to a Windows PC and double-click `build-setup.cmd`.

The result is the no-exe zip with `SHA256-no-exe.txt`, the setup exe, `SHA256.txt` and the player
`README.txt`. The build stops if
anything other than code differs between the two `out` folders, so no asset can end up in it.
The payload zip is reproducible: the same inputs always give the same file.

The exe is not signed, so Windows SmartScreen warns about an unknown publisher the first time.

When the official game updates, port the mod to the new release, rebuild against it and bump
`--game-version`: the setup refuses any other game version.
