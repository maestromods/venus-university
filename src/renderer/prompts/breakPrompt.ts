import { FINAL_DATE } from '@shared/classes'
import type { PlayerStats } from '@shared/playerStats'
import { storedMemoryDesc } from '@shared/readerVoice'
import {
  affectionFor,
  dedupedMemoriesFor,
  dispositionOf,
  type Disposition
} from '@shared/relationship'
import { activeSeason, daysToNextTerm, seasonWords, type Season } from '@shared/term'
import type { BreakMemory } from '@shared/termCarry'
import {
  charKeyOf,
  fullNameOf,
  MEMORY_TYPES,
  type Character,
  type CharState,
  type MemoryType,
  type StructuredRequest
} from '@shared/types'
import { relationshipLines } from './relationship'
import { objectSchema } from './schema'
import { memoryLines, profileLines } from './scenePrompt'

/**
 * The one-shot request a continued semester adds to New Game's three: what each returning
 * character still remembers of the break between the two semesters; pure, no IO.
 */

/**
 * How many memories of the break a character comes back with, by how she felt about the reader
 * when the semester ended: the closer the two of them were, the more of the break had him in it.
 */
const BREAK_MEMORIES: Record<Disposition, number> = {
  devoted: 5,
  trusted: 4,
  friendly: 3,
  neutral: 2,
  annoyed: 2,
  hostile: 2
}

/** The most any of them is asked for. */
const MAX_BREAK_MEMORIES = Math.max(...Object.values(BREAK_MEMORIES))

/** How many of her older memories the call is shown. */
const SHOWN_MEMORIES = 10

/** One returning character: who she is, and her moving half as it was carried over the break. */
export interface BreakCharInput {
  character: Character
  state: CharState
}

/** Everything the call reads. */
export interface BreakPromptInput {
  /** Whoever is coming back and has already met the reader. */
  returning: readonly BreakCharInput[]
  /** The reader's own block, as every scene prompt carries it. */
  reader: string
  /** His stats as the last semester ended, which is what she last knew of him. */
  stats: PlayerStats
}

/** The reply as the model returns it: one record per character, each naming its charKey. */
export interface BreakGenReply {
  characters: Array<{ key: string; memories: Array<{ type: string; desc: string }> }>
}

/** The season that has just ended, off the one being enrolled for. */
function endedSeason(): Season {
  return activeSeason() === 'spring' ? 'fall' : 'spring'
}

/**
 * The last day of the semester that ended, as a date of the one being enrolled for: where her
 * carried memories are weighed from, so she is described as she was when they said goodbye.
 */
function lastDayBefore(): number {
  return FINAL_DATE - daysToNextTerm(endedSeason())
}

/** Builds the break request for a roster with somebody returning in it. */
export function buildBreakPrompt(input: BreakPromptInput): StructuredRequest {
  const coming = seasonWords()
  const ended = seasonWords(endedSeason())
  const keys = input.returning.map(({ character }) =>
    charKeyOf(character.firstName, character.lastName)
  )
  const then = lastDayBefore()

  const system = [
    'You keep the continuity of a visual novel set at a university, between one semester and the next.',
    'You return a single JSON object matching the provided schema exactly.'
  ].join(' ')

  const preamble = [
    'THE BREAK',
    `The ${ended.name.toLowerCase()} semester at Venus University is over, ${coming.priorBreak} has come and gone, and the ${coming.name.toLowerCase()} semester starts in a few days.`,
    'Everybody went home for it. Nobody below saw the reader in person during the break: all there was between them is texting, calls, and what each of them posted.',
    '',
    'FOR EACH CHARACTER',
    'Decide how the break went between her and the reader, going by where the two of them stood when the semester ended and by who she is. Then write what she still remembers of it now that she is back.',
    '"memories" holds as many memories as her entry below asks for, oldest first.',
    'Each desc completes the sentence "<Name> <type> that ...", in the past tense, e.g. "the reader called her every Sunday over the break".',
    'Call the reader "the reader" every time, never "you", "he" or "him".',
    '"type" is how she feels about it, and it is read back later as her feeling. Match it to the desc:',
    '- liked: it was good, in an ordinary way',
    '- loved: it was one of the best things anybody has done for her',
    '- disliked: it put her off, in an ordinary way',
    '- hated: it was one of the worst things anybody has done to her',
    'Mostly the break keeps what was already there. Somebody close to him stayed in touch and comes back as close as she left, somebody who only knew him a little has one small thing to remember or nothing at all, and somebody who was put off by him did not warm up without a reason. Let her personality decide the rest: who texts first, who goes quiet, who minds.',
    'Somebody who had nothing to do with him all break may be given fewer than her entry asks for, or none.',
    'Nothing here changes what the two of them are to each other. Nobody got together, broke up, kissed, slept together or met in person over the break.',
    '---',
    ''
  ].join('\n')

  const rest = [
    'characters holds one entry per character below, its key exactly as written before her name, in the order listed.',
    '',
    'THE READER',
    input.reader,
    '',
    'CHARACTERS',
    ...input.returning.flatMap(({ character, state }, index) => {
      const affection = affectionFor(state, then, character)
      return [
        `${keys[index]} — ${fullNameOf(character)}`,
        ...profileLines(character, state.flags),
        ...relationshipLines(character, state.flags, state.nameKnown, affection, input.stats),
        ...memoryLines(
          character,
          dedupedMemoriesFor(state).slice(-SHOWN_MEMORIES),
          state.textMemory
        ),
        `Memories of the break to write for ${character.firstName}: ${BREAK_MEMORIES[dispositionOf(affection)]}.`,
        ''
      ]
    })
  ].join('\n')

  const schema = objectSchema('break_memories', ['characters'], {
    characters: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'memories'],
        properties: {
          key: { type: 'string', enum: keys },
          memories: {
            type: 'array',
            maxItems: MAX_BREAK_MEMORIES,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['type', 'desc'],
              properties: {
                type: { type: 'string', enum: [...MEMORY_TYPES] },
                desc: { type: 'string' }
              }
            }
          }
        }
      }
    }
  })

  // The roster is in the prompt, so this caches only across retries of the same start.
  return {
    system,
    user: `${preamble}\n${rest}`,
    schema,
    cacheKey: 'venus-university-break-generation',
    logFrom: preamble.length + 1
  }
}

/**
 * What the reply is worth, keyed by charId: an entry naming nobody who was asked about, a
 * memory of no known type and a blank desc are each dropped with a warning, and a character
 * the reply left out simply remembers nothing of the break.
 */
export function normalizeBreakReply(
  reply: BreakGenReply,
  returning: readonly BreakCharInput[]
): Record<string, BreakMemory[]> {
  const idByKey = new Map(
    returning.map(({ character }) => [
      charKeyOf(character.firstName, character.lastName),
      character.charId
    ])
  )
  const list: unknown = reply?.characters
  const kept: Record<string, BreakMemory[]> = {}
  for (const raw of Array.isArray(list) ? list : []) {
    if (typeof raw !== 'object' || raw === null) continue
    const entry = raw as { key?: unknown; memories?: unknown }
    const charId = typeof entry.key === 'string' ? idByKey.get(entry.key.trim()) : undefined
    if (!charId) {
      console.warn(`[break] an entry named the unknown key "${String(entry.key)}"; skipping it.`)
      continue
    }
    if (kept[charId]) continue
    const memories: BreakMemory[] = []
    for (const item of Array.isArray(entry.memories) ? entry.memories : []) {
      const memory = item as { type?: unknown; desc?: unknown } | null
      const desc = typeof memory?.desc === 'string' ? memory.desc.trim() : ''
      if (!MEMORY_TYPES.includes(memory?.type as MemoryType) || desc === '') {
        console.warn('[break] a memory had no usable type or description; dropping it.')
        continue
      }
      if (memories.length < MAX_BREAK_MEMORIES) {
        memories.push({ type: memory?.type as MemoryType, desc: storedMemoryDesc(desc) })
      }
    }
    kept[charId] = memories
  }
  return kept
}
