import { STAT_KEYS, type StatKey } from '@shared/playerStats'
import type { Season } from '@shared/term'

/**
 * The stat-raising actions the break suggests for a slot he spends on himself: what the
 * semester's own suggestions are, moved home. Pure data, sent as though he had typed it.
 */

/** What fits either break. */
const ANY_BREAK: Record<StatKey, readonly string[]> = {
  brain: [
    'Improve Brain by working through the stack of books you never got to this year.',
    'Improve Brain by taking a free online course on something you know nothing about.',
    'Improve Brain by doing the crossword at the kitchen table every morning.',
    'Improve Brain by spending the afternoons at the town library.',
    'Improve Brain by teaching yourself a few chords on an old guitar.',
    "Improve Brain by reading ahead for next semester's classes.",
    'Improve Brain by watching documentaries late into the night.',
    'Improve Brain by taking the family computer apart and putting it back together.'
  ],
  body: [
    'Improve Body by running the same loop around town every morning.',
    'Improve Body by lifting in the garage until your arms give out.',
    'Improve Body by doing pushups on the back porch before breakfast.',
    'Improve Body by playing pickup basketball at the rec center.',
    'Improve Body by helping a neighbour move house.',
    'Improve Body by picking up shifts hauling boxes at a warehouse.',
    'Improve Body by walking everywhere instead of borrowing the car.',
    'Improve Body by signing up for a week of boxing classes downtown.'
  ],
  heart: [
    'Improve Heart by catching up with old friends at the diner.',
    'Improve Heart by volunteering at the community center.',
    'Improve Heart by chatting with the regulars at the corner cafe.',
    'Improve Heart by going to a house party full of people from high school.',
    'Improve Heart by singing karaoke at the bar downtown.',
    'Improve Heart by working the counter at a part-time job.',
    'Improve Heart by calling the relatives you never call, and actually listening.',
    'Improve Heart by striking up conversations with strangers on the bus.'
  ]
}

/** What only one of them has the weather for, by the season of the semester it follows. */
const IN_SEASON: Record<Season, Record<StatKey, readonly string[]>> = {
  spring: {
    brain: [
      'Improve Brain by reading in the shade at the park until the light goes.',
      'Improve Brain by playing chess against the old-timers in the town square.'
    ],
    body: [
      'Improve Body by swimming laps at the town pool.',
      'Improve Body by mowing lawns up and down your street.',
      'Improve Body by biking out to the lake and back.'
    ],
    heart: [
      'Improve Heart by helping run a booth at the county fair.',
      'Improve Heart by coaching the neighbourhood kids at the park.'
    ]
  },
  fall: {
    brain: [
      'Improve Brain by playing board games by the fire with whoever is home.',
      'Improve Brain by finally learning to cook something that is not instant.'
    ],
    body: [
      'Improve Body by shovelling every driveway on your street.',
      'Improve Body by skating at the outdoor rink until your legs burn.',
      'Improve Body by taking the long way through the snow every day.'
    ],
    heart: [
      'Improve Heart by helping host the holiday dinner.',
      'Improve Heart by going door to door with the carollers.'
    ]
  }
}

/**
 * The suggestion for `stat` on break slot `slot`: one sentence, the same every time that slot
 * is asked about and a different one from slot to slot, so the row neither reshuffles under the
 * player nor repeats itself week on week.
 */
export function breakStatAction(stat: StatKey, slot: number, ended: Season): string {
  const pool = [...ANY_BREAK[stat], ...IN_SEASON[ended][stat]]
  // A stride coprime with every pool's length walks the whole pool before it comes round again.
  const at = (slot * 7 + STAT_KEYS.indexOf(stat) * 3) % pool.length
  return pool[at]!
}
