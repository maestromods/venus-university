import * as asar from '@electron/asar'
import { applyDelta } from 'fossil-delta'
import { createHash } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

/**
 * Adapted from the patcher of naudh1r's Venus University Photo Feature mod (AGPL-3.0-only),
 * https://github.com/naudh1r/venus-university.
 *
 * Installs Continuing Semesters into an official Venus University folder, and takes it out again.
 * A download built with `--over` also goes into a game that already has one other mod, and
 * tells by itself which of the two it was given. For that game it carries no code file, only
 * deltas that turn the other mod's files into a build of both mods together: see `editions`.
 *
 * The game's code lives in `resources/app.asar`. Installing swaps the few code files the mod
 * changes for its own. Nothing else in the game is touched: the art,
 * fonts, music, characters and the player's `data` folder stay exactly as they are, and none of
 * them are in this download. Uninstalling puts the original `app.asar` back from the copy made
 * at install time.
 */

// Run by the game's own exe (ELECTRON_RUN_AS_NODE), Electron's `fs` would read `app.asar` as a
// folder; this makes it the plain file it is, so the backup is a byte copy.
process.noAsar = true

const HERE = dirname(fileURLToPath(import.meta.url))
const PAYLOAD = join(HERE, 'payload')
const EXE = 'Venus University.exe'
/** Files the packed app keeps outside `app.asar`, as electron-builder was told to. */
const UNPACK = '**/node_modules/7zip-bin/**'

const expected = JSON.parse(await readFile(join(PAYLOAD, 'expected.json'), 'utf8'))

/**
 * The other mods this download can go on top of, each `{ key, name, version, marker, base,
 * patch, remove }`. None of their code is in the payload: for a game that has one, the files
 * installed are a build of both mods together, made here from that mod's own files and the
 * deltas under `payload/over/<key>`.
 */
const editions = expected.over ?? []

/**
 * What to do to this game. One that has a mod this download knows, told by the marker that
 * mod's setup leaves, gets that mod's deltas; any other is held to the official game and gets
 * the whole files.
 */
function planFor(p) {
  const over = editions.find((edition) => existsSync(join(p.res, edition.marker)))
  if (!over) return { base: expected.base, code: expected.code, patch: [], remove: expected.remove }
  return {
    over,
    label: `${over.name} ${over.version}`,
    base: over.base,
    code: [],
    patch: over.patch,
    remove: over.remove,
    deltas: join(PAYLOAD, 'over', over.key)
  }
}

const paths = (game) => {
  const res = join(game, 'resources')
  return {
    res,
    asar: join(res, 'app.asar'),
    unpacked: join(res, 'app.asar.unpacked'),
    backup: join(res, 'app.asar.semesters-mod-backup'),
    backupUnpacked: join(res, 'app.asar.unpacked.semesters-mod-backup'),
    marker: join(res, 'continuing-semesters-mod.json'),
    manifest: join(res, 'build-manifest.json')
  }
}

/** A `/`-joined path inside the archive, in the form the archive reader looks it up by. */
const native = (rel) => rel.split('/').join(sep)

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

/** The hash of a file too big to want in memory: `app.asar` itself. */
async function hashFile(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

function fail(message) {
  console.error(`\n  ${message}\n`)
  process.exit(1)
}

/** The game folder: given, or the folder the mod was unpacked into, or asked for. */
async function findGame(given) {
  const candidates = [given, process.cwd(), resolve(HERE, '..')].filter(Boolean)
  for (const dir of candidates) {
    if (existsSync(join(dir, EXE))) return resolve(dir)
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await rl.question(`Path to your Venus University folder (where "${EXE}" is): `))
    .trim()
    .replace(/^"|"$/g, '')
  rl.close()
  if (!answer || !existsSync(join(answer, EXE))) fail(`"${EXE}" was not found in that folder.`)
  return resolve(answer)
}

/**
 * Refuses a folder that is not what the plan was built for: the official version, or that
 * version with exactly the release of the other mod the deltas were made from.
 */
async function checkBase(p, plan, force) {
  const manifest = JSON.parse(await readFile(p.manifest, 'utf8').catch(() => 'null'))
  if (!manifest) fail('This folder has no build-manifest.json, so it is not an official build.')
  if (manifest.version !== expected.gameVersion) {
    const message = `This mod is for Venus University ${expected.gameVersion}, but this folder is ${manifest.version}.`
    if (!force) fail(`${message} Nothing was changed.`)
    console.warn(`  warning: ${message} Continuing because of --force.`)
  }

  if (plan.over) {
    const theirs = JSON.parse(await readFile(join(p.res, plan.over.marker), 'utf8').catch(() => 'null'))
    if (theirs?.modVersion !== plan.over.version) {
      const message =
        `This folder has ${plan.over.name} ${theirs?.modVersion ?? '(unknown version)'}. ` +
        `This download goes on the official game or on top of ${plan.label}, and no other version of it.`
      if (!force) fail(`${message} Nothing was changed.`)
      console.warn(`  warning: ${message} Continuing because of --force.`)
    }
  }

  const wanted = plan.over ? `the one ${plan.label} installs` : `the official ${expected.gameVersion} one`
  const hint = plan.over ? `Is a mod other than ${plan.over.name} installed?` : 'Is another mod installed?'
  const listed = new Set(asar.listPackage(p.asar).map((f) => f.replace(/\\/g, '/').replace(/^\//, '')))
  for (const [rel, hash] of Object.entries(plan.base)) {
    const ok = listed.has(rel) && sha256(asar.extractFile(p.asar, native(rel))) === hash
    if (!ok) {
      const message = `The game's ${rel} is not ${wanted}.`
      if (!force) fail(`${message} Nothing was changed. ${hint}`)
      console.warn(`  warning: ${message} Continuing because of --force.`)
    }
  }
}

/**
 * The marker of an install that something has since undone, or null. A game update, or the
 * other mod's own setup being run underneath this one, replaces `app.asar` but leaves this
 * mod's marker and backup behind. That backup is then code the game has moved on from, and
 * restoring it would put it back over whatever is there now.
 */
async function undone(p) {
  const marker = JSON.parse(await readFile(p.marker, 'utf8').catch(() => 'null'))
  if (!marker?.asar || !existsSync(p.asar)) return null
  return (await hashFile(p.asar)) !== marker.asar ? marker : null
}

/** Deletes what an undone install left behind: its backups and its marker. */
async function clearLeftovers(p) {
  await rm(p.backup, { force: true })
  await rm(p.backupUnpacked, { recursive: true, force: true })
  await rm(p.marker, { force: true })
}

async function install(game, force) {
  const p = paths(game)
  if (!existsSync(p.asar)) fail('resources/app.asar is missing; this does not look like the game.')
  if (existsSync(p.marker)) {
    if (!(await undone(p))) fail('Continuing Semesters is already installed. Uninstall it first.')
    console.log("  The game's code was replaced after an earlier install; clearing what that left behind...")
    await clearLeftovers(p)
  }
  const plan = planFor(p)
  await checkBase(p, plan, force)

  if (plan.over) {
    console.log(`  This game has ${plan.label}: Continuing Semesters goes on top of it.`)
    console.log(`  Backing up the game code as ${plan.label} left it...`)
  } else {
    console.log('  This is the official game.')
    console.log('  Backing up the original game code...')
  }
  await cp(p.asar, p.backup)
  if (existsSync(p.unpacked)) await cp(p.unpacked, p.backupUnpacked, { recursive: true })

  const work = await mkdtemp(join(tmpdir(), 'venus-semesters-mod-'))
  try {
    console.log('  Adding Continuing Semesters...')
    asar.extractAll(p.asar, work)
    // Every delta is applied before anything is removed or written: the file one is made from
    // may be one that goes, or the very file it replaces.
    const made = []
    for (const step of plan.patch) {
      const delta = await readFile(join(plan.deltas, step.delta))
      const file = Buffer.from(applyDelta(await readFile(join(work, step.from)), delta))
      if (sha256(file) !== step.sha256) throw new Error(`${step.to} did not come out as it should.`)
      made.push([step.to, file])
    }
    for (const rel of plan.remove) await rm(join(work, rel), { force: true })
    for (const [rel, file] of made) {
      await mkdir(dirname(join(work, rel)), { recursive: true })
      await writeFile(join(work, rel), file)
    }
    for (const rel of plan.code) {
      await mkdir(dirname(join(work, rel)), { recursive: true })
      await cp(join(PAYLOAD, 'code', rel), join(work, rel))
    }
    await asar.createPackageWithOptions(work, p.asar, { unpack: UNPACK })
  } catch (error) {
    // Anything half-written goes back to the original before the error is reported.
    await cp(p.backup, p.asar)
    if (existsSync(p.backupUnpacked)) {
      await rm(p.unpacked, { recursive: true, force: true })
      await cp(p.backupUnpacked, p.unpacked, { recursive: true })
    }
    await rm(p.backup, { force: true })
    await rm(p.backupUnpacked, { recursive: true, force: true })
    fail(`Install failed and the game was put back as it was: ${error.message}`)
  } finally {
    await rm(work, { recursive: true, force: true })
  }

  await writeFile(
    p.marker,
    JSON.stringify(
      {
        mod: expected.mod,
        modVersion: expected.modVersion,
        gameVersion: expected.gameVersion,
        // What uninstall puts back is the game with this mod under it, when there is one.
        over: plan.over ? { name: plan.over.name, version: plan.over.version } : undefined,
        // The archive as this install left it: uninstall restores the backup only over this.
        asar: await hashFile(p.asar)
      },
      null,
      2
    )
  )
  const where = plan.over ? `on top of ${plan.label}, in` : 'in'
  console.log(`\n  Done. Continuing Semesters is installed ${where}:\n  ${game}\n`)
}

async function uninstall(game) {
  const p = paths(game)
  if (!existsSync(p.marker)) fail('Continuing Semesters is not installed in this folder.')
  if (await undone(p)) {
    await clearLeftovers(p)
    console.log(
      "  The game's code was replaced after Continuing Semesters was installed (a game update, or\n" +
        '  another mod installed, updated or uninstalled), so the mod is no longer in the game.\n' +
        '  Its backup is from before that change and was deleted rather than restored.\n' +
        `\n  Done. Nothing else was changed in:\n  ${game}\n`
    )
    return
  }
  if (!existsSync(p.backup)) fail('The backup of the game code is missing, so it cannot be restored.')
  const marker = JSON.parse(await readFile(p.marker, 'utf8'))

  console.log(marker.over ? `  Restoring the game code as ${marker.over.name} left it...` : '  Restoring the original game code...')
  await rm(p.asar, { force: true })
  await rename(p.backup, p.asar)
  if (existsSync(p.backupUnpacked)) {
    await rm(p.unpacked, { recursive: true, force: true })
    await rename(p.backupUnpacked, p.unpacked)
  }
  await rm(p.marker, { force: true })
  const back = marker.over ? `${marker.over.name} ${marker.over.version} alone` : 'the official version'
  console.log(`\n  Done. Venus University is back to ${back} in:\n  ${game}\n`)
}

const [command, ...rest] = process.argv.slice(2)
const force = rest.includes('--force')
const given = rest.find((arg) => !arg.startsWith('--'))

console.log(`\n  ${expected.mod} ${expected.modVersion} (for Venus University ${expected.gameVersion})`)
console.log('  Close the game before continuing.\n')

if (command === 'install') await install(await findGame(given), force)
else if (command === 'uninstall') await uninstall(await findGame(given))
else fail('Usage: node patch.mjs install|uninstall [game folder] [--force]')
