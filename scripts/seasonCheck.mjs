// Lists the lines an upstream update added that may assume the first spring: a month, a
// season, a class year or a hard-coded day of the term. Run it after bringing a release in,
// as `node scripts/seasonCheck.mjs <old-ref> [<new-ref>]`, and read each hit: one that speaks
// of the calendar wants a fall wording, and a field added to the save wants a line in the
// tables at the foot of `src/shared/termCarry.ts`, which the typecheck asks for on its own.
import { execFileSync } from 'node:child_process'

const [from, to = 'HEAD'] = process.argv.slice(2)
if (!from) {
  console.error('usage: node scripts/seasonCheck.mjs <old-ref> [<new-ref>]')
  process.exit(1)
}

const WORDS =
  /\b(january|february|march|april|may \d|june|spring|summer|winter|freshm[ae]n|graduat\w*|semester runs|FINAL_DATE|GRADUATION_DATE)\b/i

const diff = execFileSync('git', ['diff', '--unified=0', `${from}..${to}`, '--', 'src'], {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024
})

let file = ''
let hits = 0
for (const line of diff.split('\n')) {
  if (line.startsWith('+++ ')) {
    file = line.slice(6)
    continue
  }
  if (!line.startsWith('+') || line.startsWith('+++')) continue
  const text = line.slice(1).trim()
  // Comments describe; only code and copy can be wrong in a fall.
  if (text.startsWith('//') || text.startsWith('*') || text.startsWith('/*')) continue
  if (!WORDS.test(text)) continue
  hits += 1
  console.log(`${file}: ${text.slice(0, 160)}`)
}
console.log(hits === 0 ? 'Nothing added that names a season.' : `${hits} line(s) to read.`)
