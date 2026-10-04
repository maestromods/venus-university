import { execFileSync } from 'node:child_process'
import { build } from 'esbuild'
import { zipSync } from 'fflate'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Adapted from the patcher of naudh1r's Venus University Photo Feature mod (AGPL-3.0-only),
 * https://github.com/naudh1r/venus-university.
 *
 * Builds the mod's download from two `out` folders of the game's code: the official one, taken
 * out of the shipped `app.asar`, and this mod's `electron-vite build`. Only the code files that
 * differ go into it; every art and font file is identical between the two, so the official
 * game's own copies are kept and none are shipped. Fails if the mod's build points at any file
 * the official game does not have.
 *
 *   node build.mjs --base <official out dir> --mod <mod out dir>
 *                  --game-version 0.3.0 --mod-version 0.1.0
 *
 * The download is one exe, the setup wizard (`Setup.cs`), with the patch zipped inside it,
 * compiled with Windows' own C# compiler: here when this runs on Windows, or by the
 * `build-setup.cmd` it leaves in `dist/` when it runs anywhere else.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const arg = (name) => {
  const at = process.argv.indexOf(`--${name}`)
  if (at < 0 || !process.argv[at + 1]) throw new Error(`--${name} is required`)
  return resolve(process.argv[at + 1])
}
const raw = (name) => process.argv[process.argv.indexOf(`--${name}`) + 1]

const BASE = arg('base')
const MOD = arg('mod')
const GAME_VERSION = raw('game-version')
const MOD_VERSION = raw('mod-version')
const OUT = join(HERE, 'dist')
const DIST = join(OUT, `continuing-semesters-${MOD_VERSION}`)
const SETUP = join(OUT, `Continuing-Semesters-Setup-${MOD_VERSION}.exe`)

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

/** Every file under `dir`, `/`-joined and relative to it. */
async function files(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) out.push(relative(dir, join(entry.parentPath, entry.name)).replace(/\\/g, '/'))
  }
  return out.sort()
}

const CODE = /\.(js|mjs|cjs|css|html)$/
const baseFiles = new Set(await files(BASE))
const modFiles = await files(MOD)

const code = []
for (const rel of modFiles) {
  const changed =
    !baseFiles.has(rel) ||
    sha256(await readFile(join(MOD, rel))) !== sha256(await readFile(join(BASE, rel)))
  if (!changed) continue
  if (!CODE.test(rel)) throw new Error(`${rel} differs and is not code; the mod ships no assets.`)
  code.push(rel)
}
const modSet = new Set(modFiles)
const remove = [...baseFiles].filter((rel) => !modSet.has(rel))
for (const rel of remove) {
  if (!CODE.test(rel)) throw new Error(`${rel} is gone from the mod build and is not code.`)
}

// Every base file the patch replaces or removes, with the hash the official game must have.
const base = {}
for (const rel of [...code.filter((rel) => baseFiles.has(rel)), ...remove]) {
  base[`out/${rel}`] = sha256(await readFile(join(BASE, rel)))
}

await rm(DIST, { recursive: true, force: true })
await mkdir(join(DIST, 'payload', 'code'), { recursive: true })
for (const rel of code) {
  await mkdir(dirname(join(DIST, 'payload', 'code', 'out', rel)), { recursive: true })
  await cp(join(MOD, rel), join(DIST, 'payload', 'code', 'out', rel))
}
await writeFile(
  join(DIST, 'payload', 'expected.json'),
  JSON.stringify(
    {
      mod: 'Venus University Continuing Semesters',
      modVersion: MOD_VERSION,
      gameVersion: GAME_VERSION,
      base,
      code: code.map((rel) => `out/${rel}`),
      remove: remove.map((rel) => `out/${rel}`)
    },
    null,
    2
  )
)

// One file, nothing to install: the archive library is bundled into it.
await build({
  entryPoints: [join(HERE, 'patch.mjs')],
  outfile: join(DIST, 'patch.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  // Only reached inside Electron; under Node the library takes plain `fs`.
  external: ['original-fs'],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'warning'
})

// The patch and what it installs, zipped in a fixed order with fixed dates, so the same inputs
// always give the same zip and the same hash.
const entries = {}
for (const rel of await files(DIST)) {
  entries[rel] = [await readFile(join(DIST, rel)), { mtime: new Date('2026-01-01T00:00:00Z') }]
}
const payload = zipSync(entries, { level: 9 })
const payloadPath = join(OUT, `payload-${MOD_VERSION}.zip`)
await writeFile(payloadPath, payload)

// The same patch without an exe: two small launchers that run it on the game's own exe, the
// patch and what it installs, all readable before anything is run. Antivirus tools flag an
// unsigned exe that unpacks a zip and rewrites another program's files, which is what the wizard
// is; this is the download for anyone who would rather not run one. Text files go out with
// Windows line endings, whatever the checkout has.
const crlf = (text) => text.replace(/\r?\n/g, '\r\n')
const NO_EXE = `Continuing-Semesters-${MOD_VERSION}`
const noExe = {}
for (const [rel, entry] of Object.entries(entries)) noExe[`${NO_EXE}/${rel}`] = entry
for (const name of ['Install.cmd', 'Uninstall.cmd']) {
  noExe[`${NO_EXE}/${name}`] = [
    Buffer.from(crlf(await readFile(join(HERE, 'files', name), 'utf8'))),
    { mtime: new Date('2026-01-01T00:00:00Z') }
  ]
}
noExe[`${NO_EXE}/README.txt`] = [
  Buffer.from(
    crlf(await readFile(join(HERE, 'files', 'README-no-exe.txt'), 'utf8'))
      .replaceAll('{{MOD_VERSION}}', MOD_VERSION)
      .replaceAll('{{GAME_VERSION}}', GAME_VERSION)
  ),
  { mtime: new Date('2026-01-01T00:00:00Z') }
]
const noExeName = `${NO_EXE}-no-exe.zip`
const noExeZip = zipSync(noExe, { level: 9 })
await writeFile(join(OUT, noExeName), noExeZip)
await writeFile(join(OUT, 'SHA256-no-exe.txt'), `${sha256(noExeZip)}  ${noExeName}\r\n`)

// The wizard, told which build it carries.
const source = (await readFile(join(HERE, 'Setup.cs'), 'utf8'))
  .replace(/ModVersion = "[^"]*"/, `ModVersion = "${MOD_VERSION}"`)
  .replace(/GameVersion = "[^"]*"/, `GameVersion = "${GAME_VERSION}"`)
  .replace(/PayloadHash = "[0-9a-f]{64}"/, `PayloadHash = "${sha256(payload)}"`)
const generated = join(OUT, 'Setup.generated.cs')
await writeFile(generated, source)

// Compiled on Windows, with Windows' own C# compiler: an exe Mono compiles elsewhere works, but
// Windows Defender blocks it. Built anywhere else, `dist/` gets `build-setup.cmd` instead, which
// finishes the job on a Windows PC with nothing installed.
const exeName = relative(OUT, SETUP)
const references = ['System.Windows.Forms.dll', 'System.Drawing.dll', 'System.IO.Compression.dll']
const cscArgs = (dir) => [
  '/nologo', '/target:winexe', '/optimize+', `/out:${dir}${exeName}`,
  ...references.map((dll) => `/reference:${dll}`),
  `/resource:${dir}payload-${MOD_VERSION}.zip,ModPayload`, `${dir}Setup.generated.cs`
]
await rm(SETUP, { force: true })
const csc = join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')
if (process.platform === 'win32' && existsSync(csc)) {
  execFileSync(csc, cscArgs(OUT + '\\'), { stdio: 'inherit' })
  await writeFile(join(OUT, 'SHA256.txt'), `${sha256(await readFile(SETUP))}  ${exeName}\n`)
} else {
  const quoted = cscArgs('%~dp0').map((arg) => (arg.includes('%~dp0') ? `"${arg}"` : arg)).join(' ')
  await writeFile(
    join(OUT, 'build-setup.cmd'),
    [
      '@echo off',
      'rem Builds the Continuing Semesters setup with the C# compiler that comes with Windows.',
      'set "CSC=%WINDIR%\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe"',
      'if not exist "%CSC%" set "CSC=%WINDIR%\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe"',
      `"%CSC%" ${quoted}`,
      'if errorlevel 1 (echo. & echo Build failed. & pause & exit /b 1)',
      // certutil prints the file's full path on its first line; only the hash is kept.
      'set "HASH="',
      `for /f "skip=1 delims=" %%h in ('certutil -hashfile "%~dp0${exeName}" SHA256') do if not defined HASH set "HASH=%%h"`,
      `> "%~dp0SHA256.txt" echo %HASH%  ${exeName}`,
      `echo. & echo Built ${exeName}`,
      'pause',
      ''
    ].join('\r\n')
  )
}
await cp(join(HERE, 'files', 'README.txt'), join(OUT, 'README.txt'))
console.log(existsSync(SETUP) ? `Built ${relative(HERE, SETUP)}` : `Ready in ${relative(HERE, OUT)}: run build-setup.cmd on Windows`)
console.log(`  no-exe zip: ${noExeName}`)
console.log(`  code files: ${code.length} (${code.join(', ')})`)
console.log(`  removed:    ${remove.length} (${remove.join(', ')})`)
