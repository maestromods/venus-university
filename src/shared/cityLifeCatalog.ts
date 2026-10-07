import type { LocationDef } from './locations'
import type { JobDef } from './jobs'

export const CITY_LIFE_LOCATIONS: readonly LocationDef[] = [
  {
    "id": "bowling_alley",
    "label": "Lucky Strike Lanes",
    "blurb": "a casual Downtown bowling alley with shoe rental, friendly games and a snack counter",
    "icon": "🎳"
  },
  {
    "id": "roller_rink",
    "label": "Starlight Roller Rink",
    "blurb": "a retro Downtown roller rink with quad-skate rental, disco lights and a snack lounge",
    "icon": "🛼"
  },
  {
    "id": "cat_cafe",
    "label": "Purr & Pour Cat Café",
    "blurb": "a cozy Downtown cat café with coffee, quiet seating and a separate cat lounge",
    "icon": "🐈"
  }
]

export const CITY_LIFE_JOBS: readonly JobDef[] = [
  {
    "id": "ex_bowling",
    "title": "Lane & Counter Attendant",
    "employer": "Lucky Strike Lanes",
    "workplaceKey": "Lucky Strike Lanes",
    "locationId": "bowling_alley",
    "boss": {
      "name": "Casey Park",
      "title": "Floor Manager, Lucky Strike Lanes",
      "emoji": "🎳"
    },
    "pay": 125,
    "requires": {
      "body": 2
    },
    "gains": [
      {
        "stats": [
          "body"
        ],
        "text": "Moving equipment and keeping the lanes running improved your stamina..."
      },
      {
        "stats": [
          "heart"
        ],
        "text": "Helping bowlers and managing the counter improved your confidence..."
      }
    ],
    "duty": "checking in bowlers, fitting rental shoes, restocking bowling balls and tidying lane seating; leave pinsetter repairs to trained staff",
    "blurb": "Friendly student shifts. Body tier 2 required; $125 per shift.",
    "hours": [
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13
    ],
    "description": "LUCKY STRIKE LANES — LANE & COUNTER ATTENDANT (PART-TIME)\n\nFriendly student shifts. Body tier 2 required; $125 per shift. No application fee. Training provided. Duties: checking in bowlers, fitting rental shoes, restocking bowling balls and tidying lane seating; leave pinsetter repairs to trained staff. Choose shifts around your classes through the normal hiring screen.",
    "messages": {
      "intro": "Welcome to the team! Your shifts are on the schedule. Come find me when you arrive and I will show you the ropes.",
      "raise": "You have been doing solid work. I have approved a raise—thanks for keeping things running smoothly.",
      "missed": "You missed a scheduled shift. Please check your calendar; this is your first strike.",
      "missed2": "That is a second missed shift. We need reliable coverage. One more strike means we will have to let you go.",
      "fired": "After three missed shifts, we have to end your employment. Take care, and good luck with university.",
      "quit": "Thanks for letting me know. Good luck with your studies—you are welcome to visit any time.",
      "shiftApproved": "Your schedule change is approved. It starts Sunday morning; cover your existing shifts until then.",
      "shiftChange": "Your new schedule is active now. Please check your updated shifts.",
      "sick1": "Rest up. I will arrange coverage for this shift.",
      "sick2": "We cannot cover another absence right now. Missing this shift will count as a strike."
    }
  },
  {
    "id": "ex_roller",
    "title": "Rink & Rental Attendant",
    "employer": "Starlight Roller Rink",
    "workplaceKey": "Starlight Roller Rink",
    "locationId": "roller_rink",
    "boss": {
      "name": "Jamie Santos",
      "title": "Rink Manager, Starlight Roller Rink",
      "emoji": "🛼"
    },
    "pay": 150,
    "requires": {
      "body": 2,
      "heart": 2
    },
    "gains": [
      {
        "stats": [
          "body"
        ],
        "text": "Patrolling the rink and handling skate rentals improved your stamina..."
      },
      {
        "stats": [
          "heart"
        ],
        "text": "Encouraging beginners and keeping the rink welcoming improved your confidence..."
      }
    ],
    "duty": "issuing and checking rental skates, helping beginners safely, monitoring rink rules and cleaning seating between sessions",
    "blurb": "Keep the good times rolling. Body and Heart tier 2 required; $150 per shift.",
    "hours": [
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13
    ],
    "description": "STARLIGHT ROLLER RINK — RINK & RENTAL ATTENDANT (PART-TIME)\n\nKeep the good times rolling. Body and Heart tier 2 required; $150 per shift. No application fee. Training provided. Duties: issuing and checking rental skates, helping beginners safely, monitoring rink rules and cleaning seating between sessions. Choose shifts around your classes through the normal hiring screen.",
    "messages": {
      "intro": "Welcome to the team! Your shifts are on the schedule. Come find me when you arrive and I will show you the ropes.",
      "raise": "You have been doing solid work. I have approved a raise—thanks for keeping things running smoothly.",
      "missed": "You missed a scheduled shift. Please check your calendar; this is your first strike.",
      "missed2": "That is a second missed shift. We need reliable coverage. One more strike means we will have to let you go.",
      "fired": "After three missed shifts, we have to end your employment. Take care, and good luck with university.",
      "quit": "Thanks for letting me know. Good luck with your studies—you are welcome to visit any time.",
      "shiftApproved": "Your schedule change is approved. It starts Sunday morning; cover your existing shifts until then.",
      "shiftChange": "Your new schedule is active now. Please check your updated shifts.",
      "sick1": "Rest up. I will arrange coverage for this shift.",
      "sick2": "We cannot cover another absence right now. Missing this shift will count as a strike."
    }
  },
  {
    "id": "ex_cat_cafe",
    "title": "Café & Cat Lounge Assistant",
    "employer": "Purr & Pour Cat Café",
    "workplaceKey": "Purr & Pour",
    "locationId": "cat_cafe",
    "boss": {
      "name": "Rowan Bell",
      "title": "Café Manager, Purr & Pour",
      "emoji": "🐈"
    },
    "pay": 140,
    "requires": {
      "brain": 2,
      "heart": 2
    },
    "gains": [
      {
        "stats": [
          "brain"
        ],
        "text": "Learning drink orders and the cats’ care routines sharpened your attention..."
      },
      {
        "stats": [
          "heart"
        ],
        "text": "Welcoming guests and patiently explaining cat-lounge rules improved your confidence..."
      }
    ],
    "duty": "taking drink orders in the separate café area, supervising respectful cat interactions and helping staff with cleaning and routine cat care; follow hygiene rules and leave medical care to professionals",
    "blurb": "Patient, attentive students wanted. Brain and Heart tier 2 required; $140 per shift.",
    "hours": [
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13
    ],
    "description": "PURR & POUR CAT CAFÉ — CAFÉ & CAT LOUNGE ASSISTANT (PART-TIME)\n\nPatient, attentive students wanted. Brain and Heart tier 2 required; $140 per shift. No application fee. Training provided. Duties: taking drink orders in the separate café area, supervising respectful cat interactions and helping staff with cleaning and routine cat care; follow hygiene rules and leave medical care to professionals. Choose shifts around your classes through the normal hiring screen.",
    "messages": {
      "intro": "Welcome to the team! Your shifts are on the schedule. Come find me when you arrive and I will show you the ropes.",
      "raise": "You have been doing solid work. I have approved a raise—thanks for keeping things running smoothly.",
      "missed": "You missed a scheduled shift. Please check your calendar; this is your first strike.",
      "missed2": "That is a second missed shift. We need reliable coverage. One more strike means we will have to let you go.",
      "fired": "After three missed shifts, we have to end your employment. Take care, and good luck with university.",
      "quit": "Thanks for letting me know. Good luck with your studies—you are welcome to visit any time.",
      "shiftApproved": "Your schedule change is approved. It starts Sunday morning; cover your existing shifts until then.",
      "shiftChange": "Your new schedule is active now. Please check your updated shifts.",
      "sick1": "Rest up. I will arrange coverage for this shift.",
      "sick2": "We cannot cover another absence right now. Missing this shift will count as a strike."
    }
  }
]
