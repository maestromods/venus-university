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
>
> ### Installing this version
>
> Starting fresh:
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
> to his version.
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
