> [!IMPORTANT]
> **This is an unofficial, modified version of Venus University.** It is not made, endorsed or
> supported by Venus Dev. The official game is on itch.io, linked below.
>
> - **Please do not report problems with this version to Venus Dev** — neither by email nor in the
>   game's community. Anything you find here may have been caused by the changes below.
> - **Modified by morrowkiln, October 2026**, from Venus Dev's public mirror at commit `ec8f7ce`
>   (0.3.0). The full list of changes is this branch's commit history.
> - **What it adds: semesters that continue.** A finished semester can be carried into the next
>   one, from the ending's own modal or from that save in Load Game. Spring is followed by a
>   Fall with a calendar of its own, then Spring again, until the spring the reader graduates
>   in. Seniors who graduated are gone and everybody else moves up a year; you drop and add
>   until the roster is twelve. The reader keeps his money, inventory, phone and reputation,
>   loses his job, and his stats slip a tier. Returning characters keep their memories,
>   milestones, gifts, feed and your notes on them, and each gets new memories of the break.
> - **It stands on its own.** It is built directly on Venus Dev's version and needs no other
>   mod.
> - **Licences are unchanged.** The code, including these changes, is AGPL-3.0-only (`LICENSE`).
>   Images, audio and video remain © Venus Dev, all rights reserved (`LICENSE-ASSETS.md`); they
>   are here only so the game builds from source.
> - **Reuse is welcome.** Everything I wrote for this mod may be used by other mods under the
>   game's AGPL licence, with or without asking. Venus Dev may additionally use any of it in the
>   official game on whatever terms he chooses, with no credit needed. This does not cover the
>   setup in `patcher/`, which is adapted from naudh1r's and stays under their terms.
>
> ### Installing this version
>
> **With the download (recommended, Windows).** You need the official Venus University 0.3.0 from
> itch.io and nothing else.
>
> 1. Back up your saves (the `data` folder next to `Venus University.exe`) and close the game.
> 2. Download `Continuing-Semesters-<version>-no-exe.zip` from
>    [Releases](https://github.com/morrowkiln/venus-university/releases) and extract it inside
>    your game folder.
> 3. Double-click `Install.cmd` in the extracted folder.
>
> Double-click `Uninstall.cmd` to put the official game back exactly as it was. The download has
> no exe in it: two small scripts start the patch on the game's own exe, and everything in the
> zip is text you can read first. It carries only code, none of the game's images, music or
> characters, and refuses a game that is not the official 0.3.0 or that has a mod in it other
> than the one named below. If you accept an official update in the game, it replaces the mod.
> The patch is adapted from [naudh1r](https://github.com/naudh1r/venus-university)'s Photo
> Feature mod; its source is in `patcher/`, which can also build a setup exe. That exe is
> unsigned and antivirus tools flag it, so the zip is the one to use.
>
> **With naudh1r's Photo Feature as well.** The same download also goes on top of a game that
> already has Photo Feature: `Install.cmd` tells which game it is given. Install Photo Feature
> with its own setup first, then this. Two mods cannot be stacked as they are, since both
> replace the same few code files, so for that case the download carries the differences that
> turn the files Photo Feature installed into a build of both mods together, made from the
> [`semester-0.3-photo`](https://github.com/morrowkiln/venus-university/tree/semester-0.3-photo)
> branch, and none of Photo Feature's own code. It needs exactly the Photo Feature version the
> release names. `Uninstall.cmd` then puts the game back to Photo Feature alone; take this mod
> out first, before uninstalling or updating Photo Feature.
>
> **From source (any platform; needs Git and Node 22).** Starting fresh:
>
> ```
> git clone -b semester-0.3 https://github.com/morrowkiln/venus-university.git
> ```
>
> Already have Venus Dev's version cloned? Add this one beside it and switch to it — your unzipped
> characters and your saves stay where they are. Commit or stash any changes of your own first.
>
> ```
> git remote add morrowkiln https://github.com/morrowkiln/venus-university.git
> git fetch morrowkiln
> git checkout -b semester-0.3 morrowkiln/semester-0.3
> ```
>
> Then set it up as Venus Dev's instructions below describe. `git checkout main` takes you back
> to his version. If `npm run dev` stops on "Electron uninstall", run
> `node node_modules/electron/install.js` once.
>
> **Saves.** A save made on Venus Dev's own version loads here, a finished one included.
> A semester started by continuing is a playthrough only this version understands: do not expect
> it to load in Venus Dev's own build.
>
> **This version follows Venus Dev's releases by hand, not automatically.** It is built on 0.3.0
> and keeps working as it is when he publishes something newer; it just does not have his new
> changes until they are merged in here.
>
> Venus Dev's own README follows, unedited.

# Venus University

Venus University is a single-player AI-driven dating sim available for web and desktop (via Electron).

The supported way to play is the itch.io page:
**https://venus-dev.itch.io/venus-university**

This is a read-only snapshot mirror of my private development repository. I am not accepting PRs or issues at the moment, if you have feedback or suggestions, please send me an email (listed on the itch.io page above) or make a bug report in the community.

## What's missing

- `assets/characters` — default characters are zipped so you can\'t preview their NSFW images on GitHub. Unzip them before use.
- `assets/sound/music` and `assets/sound/ambient_music` — check `assets/sound/README.md` on how to obtain
- `.github/` — the private repository's CI configuration.
- `build/itch-page/` — the store page's pictures.
- `private/` — the supporters ledger.

and probably some other things. If they're not here, I probably excluded them for some reason or other.

## Running from this repo

- Unzip the cast first. Every zip unpacks to `assets/characters/<id>/`, so from `assets/characters`:
  `for z in *.zip; do unzip -q "$z"; done` (or extract each one in place with your archiver).
- `npm run dev` then starts with the backgrounds, the sound effects and the pre-generated characters; only the music
  tracks are missing. Character generation should work: the pose manifest and openpose skeletons under `assets/pose`
  are included.
- An external API is required to play. API keys are stored in `data/settings.json`, encrypted at rest
  with Windows DPAPI (Electron's `safeStorage`); where DPAPI is unavailable it falls back to
  storing the key as plain text in the same file.
- The browser build (`npm run build:web`) is untested from this repo.

## Building

Requires Node 22.

```
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

## Verifying a release

Releases are Windows zips distributed on itch.io. To compare a release against this source:

1. Extract the shipped app: `npx @electron/asar extract app.asar out-shipped` (from inside the
   release zip's `resources` folder).
2. Build the matching tagged snapshot from this repository:
   `git checkout vX.Y.Z && npm ci && npm run build`.
3. Compare the built `out/main` and `out/preload` (which bundle no art) with the shipped copies.

The two builds won't be byte identical since it's missing the music.

## Licence

- Code is licensed under AGPL-3.0-only — see `LICENSE`.
- Image, audio and video files are all rights reserved — see `LICENSE-ASSETS.md`.
- If you spot security issues, please read `SECURITY.md` before reporting
