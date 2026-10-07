import type { Occasion } from '@shared/types'

/**
 * The fall semester's fixed calendar, August 17 to December 18, and everything about it that
 * differs from the spring's. It holds the semester's own milestones — orientation, add/drop,
 * the exam weeks, the week off, the wind-down and the last day — on the same day of the term
 * as the spring does, so every date the loop tests is one constant in both.
 */

/** Real-world holidays and Veridan's own, August to December. */
const FALL_HOLIDAYS: readonly Occasion[] = [
  {
    id: 'oktoberfest',
    title: 'Oktoberfest',
    description:
      'Oktoberfest weekend. The Stalestein rolls its taps out onto Stanchion Street, the lanterns under the overpasses are swapped for blue-and-white bunting, and Eastern Buffet runs a pretzel-eating showdown that nobody asked for and everybody enters.',
    startDate: 33, // Saturday, September 19
    endDate: 34, // Sunday, September 20
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  },
  {
    id: 'halloween',
    title: 'Halloween',
    description:
      'On Halloween, Pier 44 turns its boardwalk into a haunted midway, half of VU is in costume before noon, and every porch light in Elysium Village is on. The SEB holds its costume ball in the Quad, which runs until the fire pits go out.',
    startDate: 75, // Saturday, October 31
    endDate: 75,
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  },
  {
    id: 'dia-de-muertos',
    title: 'Día de los Muertos',
    description:
      'On Día de los Muertos, Lotterdale Market fills up with marigolds and sugar skulls, the Lowrise kitchens bake pan de muerto, and CAPC builds an altar beside the Concord Fountain where anybody can leave a photograph.',
    startDate: 77, // Monday, November 2
    endDate: 77,
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  },
  {
    id: 'lantern-festival',
    title: 'Silk River Lantern Festival',
    description:
      'The Silk River Lantern Festival is three nights of paper lanterns set loose on the water, a mill-era custom that the Promenade has since wrapped in food stalls, stages and a drone show. The banks are packed shoulder to shoulder from Pier 44 down to Selkie Beach, and the whole town is full of travellers.',
    startDate: 88, // Friday, November 13
    endDate: 90, // Sunday, November 15
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  },
  {
    id: 'winter-lights',
    title: 'Winter Lights',
    description:
      'Veridan never gets a winter, so on Winter Lights night the Promenade fakes one: every tower is strung with white lights at dusk, a snow machine runs over the Riverside Mall terrace, and CAPC wraps a scarf around the Venus statue.',
    startDate: 110, // Saturday, December 5
    endDate: 110,
    time: null,
    cancelsClasses: false,
    kind: 'holiday'
  }
]

/** Venus University's own calendar, fitted to an August 17 – December 18 term. */
function fallAcademic(spring: readonly Occasion[]): Occasion[] {
  /** A spring occasion the fall calendar holds unchanged, on the same day of the term. */
  const sameAsSpring = (id: string): Occasion => {
    const occasion = spring.find((entry) => entry.id === id)
    if (!occasion) throw new Error(`missing academic occasion: ${id}`)
    return occasion
  }
  return [
    sameAsSpring('orientation'), // Monday, August 17
    {
      id: 'labor-day',
      title: 'Labor Day',
      description:
        'Labor Day. Campus is closed and there are no classes, and half the student body has taken the long weekend down to Selkie Beach before the semester gets serious.',
      startDate: 21, // Monday, September 7
      endDate: 21,
      time: null,
      cancelsClasses: true,
      kind: 'academic'
    },
    sameAsSpring('add-drop'), // Friday, September 11
    {
      id: 'midterm-week',
      title: 'Midterm Week',
      description:
        'Midterm week. All classes have exams or project showcases. Kendall Library is full to the walls, the Agora study pods are impossible to get, and everybody is running on too little sleep. Fall break starts the moment it is over, which is the only thing keeping anybody upright.',
      startDate: 42, // Monday, September 28
      endDate: 46, // Friday, October 2
      time: null,
      cancelsClasses: false,
      kind: 'academic'
    },
    {
      id: 'fall-break',
      title: 'Fall Break',
      description:
        'Fall break. No classes all week. Half the campus has gone home or somewhere exotic, and the half still here has the campus almost to itself.',
      startDate: 49, // Monday, October 5
      endDate: 53, // Friday, October 9
      time: null,
      cancelsClasses: true,
      kind: 'academic'
    },
    {
      id: 'homecoming',
      title: 'Homecoming',
      description:
        'Homecoming. VU is barely old enough to have alumni, which has never stopped it: its handful of graduating classes are back for porch parties in Elysium Village, Palaestra Stadium hosts the homecoming game, and the SEB lights every fire pit in the Quad for a rally that goes on well past midnight.',
      startDate: 67, // Friday, October 23
      endDate: 67,
      time: null,
      cancelsClasses: false,
      kind: 'academic'
    },
    {
      id: 'veterans-day',
      title: 'Veterans Day',
      description:
        'Veterans Day. The university is closed and no classes meet, a quiet midweek day off that most of campus spends asleep or Downtown.',
      startDate: 86, // Wednesday, November 11
      endDate: 86,
      time: null,
      cancelsClasses: true,
      kind: 'academic'
    },
    {
      id: 'thanksgiving-break',
      title: 'Thanksgiving Break',
      description:
        'Thanksgiving break. The university is closed from Wednesday through the weekend. Most of campus has flown home for it, the Lowrise kitchens are putting on a communal Friendsgiving dinner for everybody who stayed, and Riverside Mall is braced for Black Friday.',
      startDate: 100, // Wednesday, November 25
      endDate: 102, // Friday, November 27
      time: null,
      cancelsClasses: true,
      kind: 'academic'
    },
    sameAsSpring('last-day-of-classes'), // Thursday, December 3
    sameAsSpring('reading-day'), // Friday, December 4
    sameAsSpring('finals-week'), // Monday, December 7 to Friday, December 11
    {
      // One `cancelsClasses` entry closes the timetable, the university's employers and its haunts at once.
      id: 'winter-break',
      title: 'Winter Break',
      description:
        'Winter break, which has technically already started — finals are marked and nothing meets again. Half of campus is packing, cars are double-parked outside every Lowrise, and people are leaving a few at a time. Whoever is left is waiting on the winter send-off on Friday, December 18, and going home after it.',
      startDate: 117, // Saturday, December 12
      endDate: 122, // Thursday, December 17
      time: null,
      cancelsClasses: true,
      kind: 'academic'
    },
    {
      id: 'term-end',
      title: 'Winter Send-off',
      description:
        'The winter send-off, and the last day of the semester. The SEB has strung the Quad with lights, the Lowrise kitchens are giving away everything left in their fridges, and everyone is packing up a room they will not see again until January.',
      startDate: 123, // Friday, December 18 — FINAL_DATE
      endDate: 123,
      time: null,
      cancelsClasses: true,
      kind: 'academic'
    }
  ]
}

/**
 * The milestones the fall holds under a name of its own, each beside the spring occasion it
 * stands in for: the week off after midterms, the wind-down after finals, and the last day.
 */
export const FALL_TWINS: Readonly<Record<string, string>> = {
  'spring-break': 'fall-break',
  'summer-vacation': 'winter-break',
  graduation: 'term-end'
}

/** The fall occasions nothing leads up to, announced as their spring twins are. */
export const FALL_NO_LEAD_UP_IDS: ReadonlySet<string> = new Set(Object.values(FALL_TWINS))

/** The fall occasions somebody can ask the reader along to. */
export const FALL_OUTING_OCCASION_IDS: ReadonlySet<string> = new Set([
  'oktoberfest',
  'halloween',
  'dia-de-muertos',
  'lantern-festival',
  'winter-lights',
  'homecoming'
])

/** The fall occasions held under an open sky, which the roll never rains on. */
export const FALL_DRY_OCCASION_IDS: ReadonlySet<string> = new Set([
  'term-end',
  'lantern-festival',
  'halloween',
  'homecoming',
  'winter-lights'
])

/**
 * The fall's whole fixed calendar, in calendar order, built beside the spring's academic table:
 * the occasions the two share are the spring's own, and a milestone the two would hold on
 * different days fails here, at load.
 */
export function fallStaticOccasions(spring: readonly Occasion[]): Occasion[] {
  const academic = fallAcademic(spring)
  // The midterm week is rewritten for the fall under its own id, so it is checked beside the twins.
  const shared = [...Object.entries(FALL_TWINS), ['midterm-week', 'midterm-week']]
  for (const [springId, fallId] of shared) {
    const mine = academic.find((entry) => entry.id === fallId)
    const theirs = spring.find((entry) => entry.id === springId)
    if (!mine || !theirs) throw new Error(`missing academic occasion: ${springId}`)
    if (mine.startDate !== theirs.startDate || mine.endDate !== theirs.endDate) {
      throw new Error(`the two calendars disagree on when ${springId} is`)
    }
  }
  return [...FALL_HOLIDAYS, ...academic].sort((a, b) => a.startDate - b.startDate)
}

/** The heads-up line for the week before each of the fall's exam weeks. */
export const FALL_EXAM_LOOKAHEAD = {
  midterm:
    'Midterms are next week, starting September 28. Every class is a week out from its exam or project showcase. Fall break is the week after.',
  finals:
    'Finals are next week, starting December 7. Classes are meeting for the last time this week.'
} as const
