import { yearLabel } from '@shared/classes'
import { describeReaderToPlayer, statsMaxed, type PlayerStats } from '@shared/playerStats'
import { activeSeason, activeTermIndex, readerYearOf, seasonWords } from '@shared/term'
import type { SceneLine, TimeSlot } from '@shared/types'
import { formatDatePart } from './gameDate'

/**
 * The authored opening of a playthrough: the arrival scroll and the
 * orientation scene that follows it, then the four lines that welcome him home that night. A
 * semester continued from the one before opens on a scroll, a scene and a welcome of its own.
 */

/** The playthrough's first slot — the arrival scroll and freshman orientation. */
export function isOrientationSlot(date: number, time: TimeSlot): boolean {
  return date === 0 && time === 0
}

/**
 * The playthrough's second slot — the welcome home, in place of the slot-opening narration. It
 * is the first ordinary hour of the game: four authored lines and then the landing, which is
 * the screen every slot after it opens on.
 */
export function isTutorialSlot(date: number, time: TimeSlot): boolean {
  return date === 0 && time === 1
}

/**
 * The arrival scroll, one line per click: the tram in, the walk through the city, the gates,
 * the dorm room, and back out to orientation.
 */
export function introScrollLines(stats: PlayerStats, date: number): SceneLine[] {
  return [
    {
      bg: 'train_stop',
      text: `${formatDatePart(date)}. Today is move-in day and freshman orientation at Venus University.`
    },
    {
      text: `You step off the air-conditioned tram into the crisp Veridan air. A colorful map of the Loop's route greets you, the stop for VU highlighted in bright pink.`
    },
    { text: `You decided to get off a stop early to walk around a bit.` },
    {
      text: `The weather is incredible. When you left your hometown, it was still completely frozen over there. But the air here is pleasantly cool, and the smell of blooming flowers is everywhere.`
    },
    {
      text: `You read that it may have something to do with the Silk River, which runs through the city, but you skipped the meteorologist explanation.`
    },
    {
      bg: 'downtown_street',
      text: `You pass a sign that says "Welcome to Downtown Veridan." You make your way through the narrow, weathered streets, eye on the statue of Zeus in the distance that marks the VU campus gate.`
    },
    {
      bg: 'stanchion_street',
      text: `You pass old buildings that look like they were built decades ago, still hanging onto their old charm. Behind the squat buildings, you spot skyscrapers and highway overpasses in the distance: new developments.`
    },
    {
      bg: 'campus_road',
      text: `You finally make it to the gardens that block off the campus from the city and head through the gates. The noise from the city seems to just disappear.`
    },
    {
      bg: 'quad',
      text: `You follow the Gold Road to the quad, passing several familiar locations where "Love Between Gods" was shot. The lush gardens, classical stone, and expensive glass are even more beautiful than they were on screen.`
    },
    {
      text: `Everyone around you is someone who also won the lottery draw to get in here, and they're all moving in one eager wave towards the dorms to unpack.`
    },
    {
      bg: 'lowrise_dorm_room',
      text: `You find your room. Located in number 4 out of the five Lowrise buildings, you slide the glass door open into a spacious single-occupancy unit that overlooks a courtyard garden.`
    },
    {
      text: `Your bags have already been delivered. As you see your future classmates milling about the campus, you start to feel pretty pumped.`
    },
    { text: describeReaderToPlayer(stats) },
    {
      text: statsMaxed(stats)
        ? `There's nothing left for this place to teach you. The question for you is how you'll turn this place into your personal playground.`
        : `Still, you're determined to improve yourself over the long semester.`
    },
    {
      bg: 'campus_road',
      text: `You finish unpacking and head down to find your orientation group.`
    }
  ].map((line) => ({ speaker: '', ...line }))
}

/**
 * The scroll a continued semester opens on, one line per click: the same walk in, by somebody
 * who has done it before and has been away for the length of a break.
 */
export function returnScrollLines(stats: PlayerStats, date: number): SceneLine[] {
  const fall = activeSeason() === 'fall'
  const year = yearLabel(readerYearOf(activeTermIndex())).toLowerCase()
  return [
    {
      bg: 'train_stop',
      text: `${formatDatePart(date)}. It's move-in day at Venus University again, and this time you know where you're going.`
    },
    {
      text: fall
        ? `You step off the tram into the same soft Veridan air you left behind in May. Back home it was a long, sticky summer. Here, it might as well still be spring.`
        : `You step off the tram into the same soft Veridan air you left behind in December. Back home everything is frozen solid again. Here, the flowers never noticed.`
    },
    {
      bg: 'stanchion_street',
      text: `You get off a stop early out of habit and take the long way through Stanchion. A couple of the murals are new. The lanterns are the same.`
    },
    {
      bg: 'campus_road',
      text: `Past the gardens and through the gates, the noise of the city drops away exactly the way you remember.`
    },
    {
      bg: 'quad',
      text: `The quad is full of freshmen being walked around in groups with lanyards on, staring up at the statue of Venus like you did not so long ago.`
    },
    {
      bg: 'lowrise_dorm_room',
      text: `Your room in Lowrise 4 is right where you left it. Your bags have already been delivered, and the courtyard garden hasn't changed at all.`
    },
    {
      text: fall
        ? `A whole summer away has taken some of the edge off, though.`
        : `A few weeks of doing nothing over the break have taken some of the edge off, though.`
    },
    { text: describeReaderToPlayer(stats) },
    {
      text: `Still, you're a ${year} now, and everything you left here is waiting for you to pick it back up.`
    },
    {
      bg: 'campus_road',
      text: `You finish unpacking and head back out. The SEB can always use another pair of hands on move-in day.`
    }
  ].map((line) => ({ speaker: '', ...line }))
}

/**
 * The orientation scene's action text, written *about* the reader rather than by him; the loop
 * does not log it as one of his lines.
 */
export const ORIENTATION_PREMISE =
  'The reader is standing with his orientation group in the Venus Quad. One of the other freshmen stands out to him. Neither of them knows anybody here yet and neither knows whether this is the start of anything at all — write the scene with that feeling: first day, everything still ahead, nothing decided.'

/** The same scene when the roster has no freshmen: she is the upperclassman leading the group. */
export function orientationLeaderPremise(firstName: string): string {
  return `The reader's orientation group is short of half its people. ${firstName}, the upperclassman leading the group, introduces herself to him, and the two of them talk while the stragglers turn up. She already knows her way around and is in no hurry; he knows nobody at all. Write the scene with that first-day feeling: an easy, unhurried conversation between two people who have just met, and the open question of whether it leads anywhere.`
}

/**
 * A continued semester's first scene when somebody on the roster is new to him: the reader is
 * the one who knows his way around this time, and she is the stranger.
 */
export function newcomerPremise(freshman: boolean): string {
  const who = freshman
    ? 'One of the new freshmen he is showing around stands out to him.'
    : 'One of the other students helping out, somebody he has somehow never crossed paths with before, stands out to him.'
  return `The reader is back at Venus University for a new semester and is helping out with move-in day and freshman orientation in the Venus Quad. ${who} The two of them have never met. Write the scene with that feeling: he knows his way around now, she is new to him, and neither knows yet whether this is the start of anything.`
}

/** The same scene when nobody on the roster is new: the first time he sees the girl he is closest to. */
export function reunionPremise(firstName: string): string {
  return `The reader is back at Venus University for a new semester. On move-in day he runs into ${firstName} in the Venus Quad, the first time the two of them have seen each other in person since ${seasonWords().priorBreak} began. Write the scene as that reunion, coloured by where the two of them stand and by what she remembers of the break.`
}

/**
 * A piece of Game View chrome an authored screen can withhold. The arrival scroll and the
 * endings keep only {@link BASE_REVEAL}; every other screen reveals all of it.
 */
export type RevealKey =
  | 'settings'
  | 'calendar'
  | 'bunnyboard'
  | 'cast'
  | 'background'
  | 'hideui'
  | 'chatlog'

/** What an authored screen leaves standing, the arrival scroll included. */
export const BASE_REVEAL: ReadonlySet<RevealKey> = new Set<RevealKey>([
  'settings',
  'cast',
  'background',
  'hideui',
  'chatlog'
])

/**
 * The epilogue's own set while its menu is up: `BASE_REVEAL` minus the eye, plus the phone —
 * the log holds the ceremony or the last goodbye, and the phone is read there, never written.
 */
export const EPILOGUE_REVEAL: ReadonlySet<RevealKey> = new Set<RevealKey>([
  'settings',
  'cast',
  'background',
  'bunnyboard',
  'chatlog'
])

/** Every key — what a slot the player holds the turn on shows, which is every slot but the first. */
export const ALL_REVEALED: ReadonlySet<RevealKey> = new Set<RevealKey>([
  'settings',
  'calendar',
  'bunnyboard',
  'cast',
  'background',
  'hideui',
  'chatlog'
])

/**
 * The welcome home: the last authored narration before the game is the player's. Four lines
 * covering what the landing can't say: the semester's length, two slots to a day, and a nudge out.
 */
function welcomeLines(): string[] {
  return [
    'You finally make it back to your room, exhausted after a lively morning.',
    "This is it... you're officially a student. Welcome to Venus University!",
    `The semester runs from ${seasonWords().months}. Each day, you'll decide how to spend your morning and evening.`,
    "Classes don't start until tomorrow, so you're free to do whatever you want tonight. Why not explore the campus or the city?"
  ]
}

/** The same four lines for a reader who has been here before. */
function welcomeBackLines(): string[] {
  return [
    'You finally make it back to your room, exhausted after a lively morning.',
    "It already feels like you never left. Welcome back to Venus University!",
    `The semester runs from ${seasonWords().months}. As before, you'll decide how to spend each morning and evening.`,
    "Classes don't start until tomorrow, so you're free to do whatever you want tonight. Why not go and see who else is back?"
  ]
}

/** The first night's lines, in order; the landing arrives as the last one is turned. */
export function tutorialLines(): string[] {
  return activeTermIndex() > 0 ? welcomeBackLines() : welcomeLines()
}
