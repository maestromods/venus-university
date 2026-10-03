import { activeSeason, seasonWords } from '@shared/term'
import type { SceneLine } from '@shared/types'
import { formatDatePart, formatGameDate } from './gameDate'
import { GRADUATION_DATE } from './occasions'

/**
 * The ends of a semester the first spring does not have: a fall, which closes on the winter
 * send-off rather than a ceremony, and the reader's own last spring, where the ceremony is his.
 * Each answer here is null where the first spring's own words stand.
 */

/** What the semester's last day holds, as a sentence names it. */
export function lastDayEvent(): string {
  return activeSeason() === 'fall' ? 'the winter send-off' : 'the graduation ceremony'
}

/** What the last day itself is called, where a sentence dates something from it. */
export function lastDayName(): string {
  return activeSeason() === 'fall' ? 'the last day of the semester' : 'graduation'
}

/** `"A, B, C, and D"`, as the ceremony lists whoever crosses the stage. */
function graduateList(names: readonly string[]): string {
  if (names.length < 2) return names.join('')
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

/** The scripted last morning of a fall: no ceremony, only the send-off and a campus emptying out. */
function sendOffScrollLines(): SceneLine[] {
  return [
    {
      bg: 'lowrise_dorm_room',
      text: `${formatDatePart(GRADUATION_DATE)}. You wake up next to a half-packed suitcase. It's only a few weeks away this time, so most of the room is staying exactly where it is.`
    },
    {
      bg: 'campus_road',
      text: `Outside, the campus is already thinning out. Cars idle along the road with their trunks open, and every few minutes somebody wheels a suitcase past your window on their way to the Loop.`
    },
    {
      bg: 'quad',
      text: `You follow the Gold road to the quad, where the SEB has strung lights between the trees for the winter send-off. Veridan doesn't do winter, so the snow drifting over the fountain is coming out of a machine.`
    },
    {
      text: `There are long tables of whatever every Lowrise kitchen had left in its fridges, cocoa that nobody needs in this weather, and a small stage with a microphone on it.`
    },
    {
      text: `Thorne takes the microphone to say a few words and says considerably more than a few: something about connection, something about the lottery, and a joke about finals that lands badly with everyone who just sat one.`
    },
    {
      text: `The whole quad cheers him off anyway. After that it's all hugs, plans for the break, and promises to text, the whole shebang. You know the deal.`
    },
    {
      bg: 'campus_road',
      text: `You head home. With that, the semester is finally over. Some are leaving campus sooner, some later.`
    },
    {
      bg: 'lowrise_dorm_room',
      text: `Over the next few days, you say your goodbyes to your friends before heading home for the break yourself.`
    }
  ].map((line) => ({ speaker: '', ...line }))
}

/** The ceremony from inside a gown: the reader's own class is the one on stage. */
function ownCeremonyScrollLines(classmates: readonly string[]): SceneLine[] {
  return [
    {
      bg: 'lowrise_dorm_room',
      text: `${formatDatePart(GRADUATION_DATE)}. You wake up in an empty room, all of your stuff packed in neat little boxes.`
    },
    {
      bg: 'campus_road',
      text: `Outside, the campus is at double its usual capacity, with cars lining the streets. From your window, you see students chatting with their parents as they haul boxes into trunks.`
    },
    {
      bg: 'quad',
      text: `You follow the Gold road to the quad, which has been turned into a makeshift amphitheater overnight, filled with white folding chairs shaded by trees.`
    },
    {
      text: `This year your seat is near the front, and the black gown is yours. For hours, your class files up on stage one name at a time to get a handshake and a little piece of paper.`
    },
    {
      text:
        classmates.length > 0
          ? `You cheer when ${graduateList(classmates)} cross${classmates.length === 1 ? 'es' : ''} the stage, and then it's your name being read, and your hand being shaken, and your diploma.`
          : `Then it's your name being read, and your hand being shaken, and your diploma. It takes about four seconds. It took four years.`
    },
    {
      text: `This year's graduation speech is by some tech CEO warning that AI could end the world, followed up by Thorne cracking a few jokes in poor taste afterwards.`
    },
    {
      text: `Finally, the caps go up, and the after-ceremony begins: hugs, laughter, weeping, the whole shebang. You know the deal.`
    },
    {
      bg: 'campus_road',
      text: `You head home. With that, your last semester is over, and so is Venus University. Some are leaving campus sooner, some later.`
    },
    {
      bg: 'lowrise_dorm_room',
      text: `Over the next few days, you say your final goodbyes to your friends before heading home yourself.`
    }
  ].map((line) => ({ speaker: '', ...line }))
}

/**
 * The scripted last morning where it is not the first spring's: the send-off in a fall, the
 * reader's own ceremony in his last spring, and null otherwise.
 */
export function termEndScrollLines(
  seniors: readonly string[],
  readerGraduates: boolean
): SceneLine[] | null {
  if (activeSeason() === 'fall') return sendOffScrollLines()
  return readerGraduates ? ownCeremonyScrollLines(seniors) : null
}

/** The action a fall's goodbye scene is written from, or null in a spring. */
export function fallFarewellAction(firstName: string): string | null {
  if (activeSeason() !== 'fall') return null
  return `The reader is saying goodbye to ${firstName} some time after the last day of the semester, before they both go home for ${seasonWords().endBreak}.`
}

/** The two `NOW` lines of a fall's goodbye scene, or null in a spring. */
export function fallFarewellNowLines(firstName: string): string[] | null {
  if (activeSeason() !== 'fall') return null
  return [
    `An unspecified night a few days after ${formatGameDate(GRADUATION_DATE)}, the last day of the semester...`,
    `This is the last time the reader will be seeing ${firstName} until after ${seasonWords().endBreak}.`
  ]
}

/** What the curtain announces a fall's goodbye menu with, or null in a spring. */
export function fallGoodbyesSplash(): { word: string; meta: string } | null {
  return activeSeason() === 'fall' ? { word: 'Goodbyes', meta: 'Sometime after finals...' } : null
}
