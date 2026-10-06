import { FINAL_DATE } from '@shared/classes'
import type { LedgerStats, PlayerStats } from '@shared/playerStats'
import { storedMemoryDesc } from '@shared/readerVoice'
import { affectionFor, dedupedMemoriesFor } from '@shared/relationship'
import { daysToNextTerm, seasonWords, type Season } from '@shared/term'
import {
  breakClock,
  breakWeeks,
  TALK_TURNS,
  talkTurns,
  type BreakAlone,
  type BreakCard,
  type BreakLine,
  type BreakPromise,
  type ReachBeat,
  type BreakTalk,
  type BreakVerdict,
  type TalkJudgement
} from '@shared/termBreak'
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
import { memoryLines, personaFor, profileLines } from './scenePrompt'
import { TEXTING_PERSONA } from './textingPrompt'

/**
 * The requests a played break sends: the card every returning girl carries through it, her
 * side of one conversation, the judgement of that conversation once it is over, and a slot he
 * spends on himself. Pure,
 * no IO. Every one of them reads a girl's moving half as it is carried over the break, so the
 * term being enrolled for is already the active one.
 */

/** How many of her older memories a call is shown. */
const SHOWN_MEMORIES = 10

/** One returning character: who she is, and her moving half as it was carried over the break. */
export interface BreakGirl {
  character: Character
  state: CharState
}

/** What every call is told about the break itself. */
export interface BreakSetting {
  /** The season of the semester the break follows. */
  ended: Season
  /** The reader's own block, as every scene prompt carries it. */
  reader: string
  /** His stats as the last semester ended, which is what she last knew of him. */
  stats: PlayerStats
}

/** The last day of the semester that ended, as a date of the one being enrolled for. */
function lastDayOf(ended: Season): number {
  return FINAL_DATE - daysToNextTerm(ended)
}

/** One girl as a call reads her: who she is, where the two of them stand, what she remembers. */
function girlLines({ character, state }: BreakGirl, setting: BreakSetting): string[] {
  const affection = affectionFor(state, lastDayOf(setting.ended), character)
  return [
    ...profileLines(character, state.flags),
    ...relationshipLines(character, state.flags, state.nameKnown, affection, setting.stats, {
      texting: true,
      texted: true
    }),
    ...memoryLines(
      character,
      dedupedMemoriesFor(state).slice(-SHOWN_MEMORIES),
      state.textMemory
    )
  ]
}

/** Her card as a call reads it. */
function cardLines(name: string, card: BreakCard): string[] {
  return [
    `Where ${name} is and what with: ${card.where}`,
    `What ${name} wants out of the break: ${card.wants}`,
    `What ${name} expects of the reader over it: ${card.expects}`,
    `What would hurt ${name}: ${card.hurts}`,
    `What would delight ${name}: ${card.delights}`
  ]
}

/** One conversation's texts, oldest first, each under who sent it. */
function transcriptLines(lines: readonly BreakLine[], name: string): string[] {
  return lines.map((line) => `${line.sender === 'player' ? 'Reader' : name}: ${line.text}`)
}

/** What the earlier conversations with her came to, what he still owes her, and what he ignored. */
function historyLines(
  name: string,
  earlier: readonly BreakTalk[],
  promises: readonly BreakPromise[],
  ended: Season,
  ignored = 0
): string[] {
  const lines: string[] = []
  if (ignored > 0) {
    lines.push(
      `${name} has texted the reader ${ignored === 1 ? 'once' : `${ignored} times`} this break that he has not answered yet. Everybody is busy over a break and she knows it: a late answer is still an answer, and she does not hold the wait against him.`,
      ''
    )
  }
  if (earlier.length > 0) {
    lines.push('EARLIER THIS BREAK')
    for (const talk of earlier) {
      const { week } = breakClock(talk.slot, ended)
      lines.push(`- Week ${week}: ${talk.summary ?? 'They texted.'}`)
    }
    lines.push('')
  }
  const open = promises.filter((promise) => promise.state === 'open')
  if (open.length > 0) {
    lines.push(`WHAT THE READER HAS PROMISED ${name.toUpperCase()} AND NOT YET DONE`)
    open.forEach((promise, index) => lines.push(`${index}: the reader promised to ${promise.text}`))
    lines.push('')
  }
  return lines
}

/** The reply as the card call returns it: one record per character, each naming its charKey. */
export interface BreakCardsReply {
  characters: Array<{ key: string } & Partial<BreakCard>>
}

/** Builds the card request for everybody coming back who has met the reader. */
export function buildBreakCardsPrompt(
  girls: readonly BreakGirl[],
  setting: BreakSetting
): StructuredRequest {
  const words = seasonWords(setting.ended)
  const keys = girls.map(({ character }) => charKeyOf(character.firstName, character.lastName))

  const system = [
    'You keep the continuity of a visual novel set at a university, between one semester and the next.',
    'You return a single JSON object matching the provided schema exactly.'
  ].join(' ')

  const preamble = [
    'THE BREAK',
    `The ${words.name.toLowerCase()} semester at Venus University is over and everybody has gone home for ${words.endBreak}, ${breakWeeks(setting.ended)} weeks of it. Nobody below will see the reader in person: all there is between them is texting.`,
    '',
    'FOR EACH CHARACTER',
    'Decide what her break is, going by who she is, and write the five lines the rest of the break is played against. They are never shown to the reader, so be concrete rather than coy.',
    '"where": where she is spending it and what with — a place, the people, a job or a plan — in one sentence.',
    '"wants": what she wants out of these weeks, for herself.',
    '"expects": what she expects of the reader while they are apart, going by where the two of them stood when the semester ended. Somebody close to him expects to hear from him; somebody who barely knows him expects nothing.',
    '"hurts": the one thing he could say or do over text that would hurt or put her off, specific to her and to her break.',
    '"delights": the one thing he could say or do over text that would delight her, specific to her and to her break.',
    'Each is one plain sentence in the third person, naming her. Call the reader "the reader".',
    '---',
    ''
  ].join('\n')

  const rest = [
    'characters holds one entry per character below, its key exactly as written before her name, in the order listed.',
    '',
    'THE READER',
    setting.reader,
    '',
    'CHARACTERS',
    ...girls.flatMap((girl, index) => [
      `${keys[index]} — ${fullNameOf(girl.character)}`,
      ...girlLines(girl, setting),
      ''
    ])
  ].join('\n')

  const text = { type: 'string' }
  return {
    system,
    user: `${preamble}\n${rest}`,
    schema: objectSchema('break_cards', ['characters'], {
      characters: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['key', 'where', 'wants', 'expects', 'hurts', 'delights'],
          properties: {
            key: { type: 'string', enum: keys },
            where: text,
            wants: text,
            expects: text,
            hurts: text,
            delights: text
          }
        }
      }
    }),
    cacheKey: 'venus-university-break-cards',
    logFrom: preamble.length + 1
  }
}

/**
 * What the card reply is worth, keyed by charId: an entry naming nobody who was asked about, or
 * missing one of its five lines, is dropped with a warning.
 */
export function normalizeBreakCards(
  reply: BreakCardsReply,
  girls: readonly BreakGirl[]
): Record<string, BreakCard> {
  const idByKey = new Map(
    girls.map(({ character }) => [
      charKeyOf(character.firstName, character.lastName),
      character.charId
    ])
  )
  const line = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
  const list: unknown = reply?.characters
  const cards: Record<string, BreakCard> = {}
  for (const raw of Array.isArray(list) ? list : []) {
    if (typeof raw !== 'object' || raw === null) continue
    const entry = raw as Record<string, unknown>
    const charId = typeof entry.key === 'string' ? idByKey.get(entry.key.trim()) : undefined
    if (!charId || cards[charId]) continue
    const card: BreakCard = {
      where: line(entry.where),
      wants: line(entry.wants),
      expects: line(entry.expects),
      hurts: line(entry.hurts),
      delights: line(entry.delights)
    }
    if (Object.values(card).some((value) => value === '')) {
      console.warn(`[break] the card for "${String(entry.key)}" is missing a line; dropping it.`)
      continue
    }
    cards[charId] = card
  }
  return cards
}

/** One girl who writes this week, and what the call reads to write her texts. */
export interface BreakReachGirl {
  girl: BreakGirl
  card: BreakCard
  /** What has her writing: an ordinary week, the middle of the summer, or the last week. */
  beat: ReachBeat | 'plain'
  /** The conversations with her already judged, oldest first. */
  earlier: readonly BreakTalk[]
  promises: readonly BreakPromise[]
  /** How many times she has already written this break and had nothing back. */
  ignored: number
}

/** The reply as the reach-out call returns it: one record per character, each naming its charKey. */
export interface BreakReachReply {
  characters: Array<{ key: string; messages?: string[] }>
}

/** What has her writing, as the call is told it. */
const BEAT_LINES: Record<ReachBeat | 'plain', (name: string, backIn: string) => string> = {
  plain: (name) =>
    `${name} is writing because something in her week made her think of the reader: a bit of news, a photo she describes, a complaint, a question.`,
  mid: (name) =>
    `It is the middle of the summer and something is on where ${name} is — a festival, a family do, a trip, a heatwave — and she is writing from the thick of it.`,
  last: (name, backIn) =>
    `It is the last week before everybody goes back, and ${name} is writing about that: how her break went, and seeing him again in ${backIn}. How glad she sounds about it is how the break has gone between them.`
}

/** Builds the request for everything the girls send on their own at the top of one week. */
export function buildBreakReachPrompt(
  writing: readonly BreakReachGirl[],
  week: number,
  setting: BreakSetting
): StructuredRequest {
  const words = seasonWords(setting.ended)
  const keys = writing.map(({ girl }) =>
    charKeyOf(girl.character.firstName, girl.character.lastName)
  )

  const preamble = [
    'NOW',
    `It is week ${week} of ${breakWeeks(setting.ended)} of ${words.endBreak}. Everybody is home until ${words.backIn}, hours apart, and all there is between any of them and the reader is texting.`,
    '',
    'YOUR TURN',
    'Each character below texts the reader first this week, on her own, in a private DM. Write what each of them sends as her "messages" array: one or two text bubbles, never more.',
    'Stay in each one\'s voice and keep it text-length. It comes out of her own break and of how things stand between the two of them now, including anything said or promised earlier this break.',
    'She writes about her own side of things and may ask him something. She NEVER states what the reader did, is doing or will do, and nobody suggests meeting up.',
    'Nobody chases him or makes him feel guilty over a text he has not answered yet: everybody is busy over a break, and a late answer is fine.',
    '---',
    ''
  ].join('\n')

  const rest = [
    'characters holds one entry per character below, its key exactly as written before her name, in the order listed.',
    '',
    'THE READER',
    setting.reader,
    '',
    'CHARACTERS',
    ...writing.flatMap(({ girl, card, beat, earlier, promises, ignored }, index) => {
      const name = girl.character.firstName
      return [
        `${keys[index]} — ${fullNameOf(girl.character)}`,
        ...girlLines(girl, setting),
        ...cardLines(name, card),
        ...historyLines(name, earlier, promises, setting.ended, ignored),
        `WHY SHE WRITES: ${BEAT_LINES[beat](name, words.backIn)}`,
        ''
      ]
    })
  ].join('\n')

  return {
    system: TEXTING_PERSONA,
    user: `${preamble}\n${rest}`,
    schema: objectSchema('break_reach', ['characters'], {
      characters: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['key', 'messages'],
          properties: {
            key: { type: 'string', enum: keys },
            messages: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }),
    kind: 'texting',
    cacheKey: 'venus-university-break-reach',
    logFrom: preamble.length + 1
  }
}

/** What the reach-out reply is worth, keyed by charId: at most two texts each, blanks dropped. */
export function normalizeBreakReach(
  reply: BreakReachReply,
  writing: readonly BreakReachGirl[]
): Record<string, string[]> {
  const idByKey = new Map(
    writing.map(({ girl }) => [
      charKeyOf(girl.character.firstName, girl.character.lastName),
      girl.character.charId
    ])
  )
  const list: unknown = reply?.characters
  const texts: Record<string, string[]> = {}
  for (const raw of Array.isArray(list) ? list : []) {
    if (typeof raw !== 'object' || raw === null) continue
    const entry = raw as Record<string, unknown>
    const charId = typeof entry.key === 'string' ? idByKey.get(entry.key.trim()) : undefined
    if (!charId || texts[charId] || !Array.isArray(entry.messages)) continue
    const said = entry.messages
      .filter((text): text is string => typeof text === 'string' && text.trim() !== '')
      .map((text) => text.trim())
      .slice(0, 2)
    if (said.length > 0) texts[charId] = said
  }
  return texts
}

/** Everything one turn of a conversation reads. */
export interface BreakTalkInput {
  girl: BreakGirl
  card: BreakCard
  /** The conversation under way, his newest text its last line. */
  talk: BreakTalk
  /** The conversations with her already judged, oldest first. */
  earlier: readonly BreakTalk[]
  /** Everything he has promised her this break. */
  promises: readonly BreakPromise[]
  /** How many times she wrote this break and had nothing back. */
  ignored?: number
  setting: BreakSetting
}

/** Her reply to one text as the model returns it. */
export interface BreakTalkReply {
  messages: string[]
  leaving: boolean
}

/** Builds the request for her reply to his newest text. */
export function buildBreakTalkPrompt(input: BreakTalkInput): StructuredRequest {
  const { girl, card, talk, earlier, promises, setting } = input
  const name = girl.character.firstName
  const words = seasonWords(setting.ended)
  const { week } = breakClock(talk.slot, setting.ended)
  const turn = talkTurns(talk)
  const last = turn >= TALK_TURNS

  const user = [
    'READER',
    setting.reader,
    '',
    'CHARACTER',
    `${fullNameOf(girl.character)}.`,
    ...girlLines(girl, setting),
    '',
    'NOW',
    `It is week ${week} of ${breakWeeks(setting.ended)} of ${words.endBreak}. Everybody is home until ${words.backIn}; ${name} and the reader have not seen each other since the semester ended and will not until it is over.`,
    '',
    `${name.toUpperCase()}'S BREAK`,
    'This is hers alone. She never recites it; it is what her mood, her news and her reactions come out of.',
    ...cardLines(name, card),
    '',
    ...historyLines(name, earlier, promises, setting.ended, input.ignored),
    'THIS CONVERSATION',
    "'''",
    ...transcriptLines(talk.lines, name),
    "'''",
    '',
    'YOUR TURN',
    `${name} is texting the reader back in a private DM, from wherever her break has her.`,
    `Write ${name}'s reply to the reader's newest text, the last line of THIS CONVERSATION, as the "messages" array: each entry is one text bubble she sends.`,
    'Stay in her voice and keep it text-length: this is a phone thread, not prose. Let her have a break of her own to talk about.',
    'React to what he actually wrote. Praise with nothing in it, or the same sweet line again, lands flat on her. What would hurt her hurts, and she does not smooth it over for him.',
    'Nobody can meet up: if he suggests it, she answers as somebody who is hours away.',
    '',
    'ENDING IT',
    last
      ? `That was the last text the reader gets to send. Answer it, and in the same reply have ${name} sign off for a reason of her own — somebody calling her, somewhere to be, sleep — so the conversation ends on her words. How warmly she leaves is how it went. Set "leaving" to true.`
      : `This is text ${turn} of the ${TALK_TURNS} the reader gets. Set "leaving" to true only if ${name} ends the conversation here herself, because he has put her off, bored her or hurt her badly enough that she would rather stop than go on; her reply then reads like somebody leaving. Otherwise set it to false and leave the conversation open.`
  ].join('\n')

  return {
    system: TEXTING_PERSONA,
    user,
    schema: objectSchema('break_texting', ['messages', 'leaving'], {
      messages: { type: 'array', items: { type: 'string' } },
      // Required: an optional boolean drifts into never being considered.
      leaving: { type: 'boolean' }
    }),
    cacheKey: 'break-texting',
    kind: 'texting'
  }
}

/** The judgement as the model returns it. */
export interface BreakJudgeReply {
  verdict?: string
  reason?: string
  summary?: string
  memories?: Array<{ type?: string; desc?: string }>
  promisesMade?: string[]
  promisesKept?: number[]
  promisesBroken?: number[]
}

/** Everything the judgement of one conversation reads. */
export interface BreakJudgeInput {
  girl: BreakGirl
  card: BreakCard
  /** The conversation that has just ended. */
  talk: BreakTalk
  /** The conversations with her already judged, oldest first. */
  earlier: readonly BreakTalk[]
  /** Everything he has promised her this break. */
  promises: readonly BreakPromise[]
  /** Whether a memory of this one may be `loved` or `hated`. */
  strong: Record<Exclude<BreakVerdict, 'neutral'>, boolean>
  /** How many times she wrote this break and had nothing back. */
  ignored?: number
  setting: BreakSetting
}

const VERDICTS: readonly BreakVerdict[] = ['warmer', 'cooler', 'neutral']

/** Builds the request that judges a conversation once it is over. */
export function buildBreakJudgePrompt(input: BreakJudgeInput): StructuredRequest {
  const { girl, card, talk, earlier, promises, strong, setting } = input
  const name = girl.character.firstName
  const open = promises.filter((promise) => promise.state === 'open')
  const ending =
    talk.ended === 'her'
      ? `${name} ended the conversation herself, before the reader was done.`
      : talk.ended === 'player'
        ? 'The reader ended the conversation himself.'
        : 'The conversation ran its length and she signed off.'

  const system = [
    'You keep the continuity of a visual novel set at a university, between one semester and the next.',
    'You judge one text conversation the reader has just had with a character over the break, fairly and by what was actually said.',
    'You return a single JSON object matching the provided schema exactly.'
  ].join(' ')

  const user = [
    'THE READER',
    setting.reader,
    '',
    'THE CHARACTER',
    `${fullNameOf(girl.character)}.`,
    ...girlLines(girl, setting),
    '',
    `${name.toUpperCase()}'S BREAK`,
    ...cardLines(name, card),
    '',
    ...historyLines(name, earlier, promises, setting.ended, input.ignored),
    'THE CONVERSATION',
    "'''",
    ...transcriptLines(talk.lines, name),
    "'''",
    ending,
    '',
    'THE JUDGEMENT',
    `Decide how this one conversation left ${name} feeling about the reader, going by her card above and nothing vaguer.`,
    '"verdict" is "warmer", "cooler" or "neutral".',
    '- warmer: he engaged with her break, met what she expects of him, or did the thing that delights her.',
    '- cooler: he did the thing that hurts her, brushed off what she told him, pushed where she had not invited it, or went back on something he had promised.',
    '- neutral: small talk that changed nothing.',
    'Sweetness with nothing in it is neutral at best: a compliment that could have been sent to anybody, or the same line again, moves nobody. An apology alone does not undo a broken promise. One awkward line in an otherwise good conversation does not make it cooler.',
    `"reason" is one short sentence saying why, written to the player about what he did, e.g. "${name} cooled after you changed the subject from her audition."`,
    `"summary" is one or two sentences of what was said, in the third person, calling him "the reader", for the next conversation with her.`,
    '',
    'MEMORIES',
    `"memories" holds what ${name} will still remember of this conversation when the semester starts: at most two, and none for a neutral one unless something in it is worth keeping.`,
    'Each desc completes the sentence "<Name> <type> that ...", in the past tense, about something the reader actually said or did here, e.g. "the reader asked how her grandmother was doing".',
    'Call the reader "the reader" every time, never "you", "he" or "him".',
    `A warmer conversation leaves "liked"${strong.warmer ? ', or "loved" for something that truly moved her' : ''}; a cooler one leaves "disliked"${strong.cooler ? ', or "hated" for something that truly wounded her' : ''}.`,
    '',
    'PROMISES',
    '"promisesMade" lists anything the reader said in this conversation that he would do for her or with her later — call, write again, send something, visit — each as a phrase completing "the reader promised to ...", e.g. "call her once she is back from the lake". A vague nicety is not a promise. Empty when he promised nothing.',
    open.length > 0
      ? '"promisesKept" lists the numbers of the promises above that this conversation made good on, and "promisesBroken" the numbers of those he went back on or showed he had forgotten. A promise nothing here touched is in neither.'
      : '"promisesKept" and "promisesBroken" are empty: he owed her nothing going in.'
  ].join('\n')

  const numbers = { type: 'array', items: { type: 'integer' } }
  return {
    system,
    user,
    schema: objectSchema(
      'break_judgement',
      [
        'verdict',
        'reason',
        'summary',
        'memories',
        'promisesMade',
        'promisesKept',
        'promisesBroken'
      ],
      {
        verdict: { type: 'string', enum: [...VERDICTS] },
        reason: { type: 'string' },
        summary: { type: 'string' },
        memories: {
          type: 'array',
          maxItems: 2,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'desc'],
            properties: {
              type: { type: 'string', enum: [...MEMORY_TYPES] },
              desc: { type: 'string' }
            }
          }
        },
        promisesMade: { type: 'array', items: { type: 'string' } },
        promisesKept: numbers,
        promisesBroken: numbers
      }
    ),
    cacheKey: 'venus-university-break-judgement'
  }
}

/**
 * What the judgement reply is worth: an unknown verdict reads as neutral, a memory of no known
 * type or with nothing written is dropped, a promise is kept as the phrase after "promised to",
 * and a promise number that is not a whole number is ignored.
 */
export function normalizeBreakJudgement(reply: BreakJudgeReply): TalkJudgement {
  const verdict = VERDICTS.find((value) => value === reply?.verdict) ?? 'neutral'
  const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
  const memories: BreakMemory[] = []
  for (const item of Array.isArray(reply?.memories) ? reply.memories : []) {
    const desc = text(item?.desc)
    if (!MEMORY_TYPES.includes(item?.type as MemoryType) || desc === '') continue
    memories.push({ type: item?.type as MemoryType, desc: storedMemoryDesc(desc) })
  }
  const numbers = (value: unknown): number[] =>
    (Array.isArray(value) ? value : []).filter(
      (item): item is number => Number.isInteger(item) && item >= 0
    )
  return {
    verdict,
    reason: text(reply?.reason),
    summary: text(reply?.summary),
    memories,
    promisesMade: (Array.isArray(reply?.promisesMade) ? reply.promisesMade : [])
      .map((promise) =>
        text(promise)
          .replace(/^the reader promised to\s+/i, '')
          .replace(/[.!?…]+$/, '')
      )
      .filter((promise) => promise !== ''),
    promisesKept: numbers(reply?.promisesKept),
    promisesBroken: numbers(reply?.promisesBroken)
  }
}

/** A slot spent alone as the model returns it. */
export interface BreakAloneReply {
  lines?: string[]
  stats?: { brain?: boolean; body?: boolean; heart?: boolean }
}

/** Everything a slot spent alone reads. */
export interface BreakAloneInput {
  /** What he said he would do, in his own words. */
  action: string
  /** The slot it is being spent on. */
  slot: number
  /** The slots he has already spent on himself this break, oldest first. */
  earlier: readonly BreakAlone[]
  /** Whether the playthrough is on the toned-down writer. */
  lessNsfwText: boolean
  setting: BreakSetting
}

/** Builds the request for a slot he spends on himself: how it went, and what it exercised. */
export function buildBreakAlonePrompt(input: BreakAloneInput): StructuredRequest {
  const { action, slot, earlier, lessNsfwText, setting } = input
  const words = seasonWords(setting.ended)
  const { week } = breakClock(slot, setting.ended)

  const user = [
    'READER',
    setting.reader,
    '',
    'NOW',
    `It is week ${week} of ${breakWeeks(setting.ended)} of ${words.endBreak}. The reader is home until ${words.backIn}, a long way from Venus University and from everybody he knows there.`,
    '',
    ...(earlier.length > 0
      ? [
          'WHAT HE HAS ALREADY DONE WITH HIS TIME THIS BREAK',
          ...earlier.map((spent) => `- Week ${breakClock(spent.slot, setting.ended).week}: ${spent.action}`),
          ''
        ]
      : []),
    'YOUR TURN',
    'Solo mission, RITA! The reader has a few days to himself, so write how they go, start to finish.',
    'Open by rewording what the reader decided to do in a fun narration, then play it out to the end. Nobody from the university shows up, and nobody else needs a name.',
    'Write it to him, as "you", the way a scene is narrated. Two to four short lines in the "lines" array, each one or two short sentences: a small moment, told briefly.',
    'Keep it tight. This is a slice of his break, not an epic.',
    "DON'T leave a decision point, a cliffhanger, or a question for the reader.",
    '',
    'STATS',
    "Say which of the reader's stats this actually exercised.",
    'Set Brain to true if he worked on his smarts, Body to true if he worked on his fitness, and Heart to true if he worked on his charisma or social skills.',
    'Set a stat to false if it did not exercise it. All three false is a perfectly good answer — a few days spent lazing around exercised nothing.',
    '',
    `Reader's action: ${action}`
  ].join('\n')

  const flag = { type: 'boolean' }
  return {
    system: [
      personaFor(lessNsfwText),
      '',
      'You always return a single, fully-formed JSON object matching the provided schema exactly.'
    ].join('\n'),
    user,
    schema: objectSchema('break_alone', ['lines', 'stats'], {
      lines: { type: 'array', items: { type: 'string' } },
      stats: {
        type: 'object',
        additionalProperties: false,
        required: ['brain', 'body', 'heart'],
        properties: { brain: flag, body: flag, heart: flag }
      }
    }),
    cacheKey: 'break-alone',
    // Routable, as a scene alone is during a semester.
    kind: 'solo'
  }
}

/** What the reply is worth: its lines with the blank ones dropped, and each stat only where it said true. */
export function normalizeBreakAlone(reply: BreakAloneReply): {
  lines: string[]
  exercised: LedgerStats
} {
  return {
    lines: (Array.isArray(reply?.lines) ? reply.lines : [])
      .filter((line): line is string => typeof line === 'string')
      .map((line) => line.trim())
      .filter((line) => line !== ''),
    exercised: {
      brain: reply?.stats?.brain === true,
      body: reply?.stats?.body === true,
      heart: reply?.stats?.heart === true
    }
  }
}
