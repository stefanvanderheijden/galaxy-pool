const schemaVersion = 2;
const id = "level-01";
const name = "Solaris";
const viewRadius = 2.9;
const ship = {
  spawn: {
    radius: 1.19,
    angle: 3.927
  },
  traits: [
    "inhabited"
  ],
  brief: {
    "class": "The ark",
    note: "That is us, flying free of gravity, so mind the worlds coming round: they do not steer. One cue ball on the nose, two in the chamber. Shoot, then go and fetch it. Good hunting, captain."
  }
};
const loadout = {
  nose: "standard",
  chamber: [
    "standard",
    "standard"
  ]
};
const bodies = [
  {
    kind: "star",
    id: "star",
    name: "Solaris",
    type: "red-dwarf",
    brief: {
      "class": "M-type main sequence",
      diameterKm: 625328,
      tempC: 3126.9,
      note: "Red dwarf, captain. Cold system: every world out here is frozen. It burns any cue ball you put into it but two: the Night ball, which strikes it and comes back, and a thermonuclear, which strikes it hardest and is spent there. A gravitizer will drag it about from a distance, so long as you keep the ball off it. You will need one: the table is not clear until Solaris is in a pocket, so chamber one of them and leave the star for last."
    }
  },
  {
    kind: "planet",
    id: "smell",
    name: "Red",
    sprite: "red",
    mass: 41e-7,
    drawR: 68e-4,
    color: "#d98c4a",
    atmosphere: "#c9a84e",
    orbit: {
      around: "star",
      angle: 2.35,
      radius: 0.55
    },
    brief: {
      "class": "Terrestrial, veiled",
      diameterKm: 14661,
      tempC: -9.2,
      note: "The heavy one. Sulphur haze over a thick envelope, and it takes a thermonuclear without cracking. It will not go far on a soft shot, so lean in."
    }
  },
  {
    kind: "planet",
    id: "hearing",
    name: "Terra",
    sprite: "terra",
    mass: 155e-8,
    drawR: 52e-4,
    color: "#7fa8a0",
    atmosphere: "#7fb0e6",
    orbit: {
      around: "star",
      angle: 0.62,
      radius: 0.92
    },
    traits: [
      "fragile",
      "inhabited"
    ],
    brief: {
      "class": "Terrestrial",
      diameterKm: 10472,
      tempC: -155.2,
      note: "Somebody is home. Rock under ice, and it breaks if you put a thermonuclear on it, so don't. There is a pulse coming off it the survey cannot account for. Not our problem today."
    }
  },
  {
    kind: "planet",
    id: "touch",
    name: "Vera",
    sprite: "vera",
    mass: 42e-8,
    drawR: 38e-4,
    color: "#cfd8e3",
    orbit: {
      around: "star",
      angle: 5.583,
      radius: 1.45
    },
    traits: [
      "fragile"
    ],
    brief: {
      "class": "Terrestrial, glaciated",
      diameterKm: 7181,
      tempC: -205.2,
      note: "Light, and already nearest a pocket. This is your opening shot, young cap'n. Those arcs on the surface? No tide in this system makes those. Pool it anyway."
    }
  },
  {
    kind: "planet",
    id: "dune",
    name: "Dune",
    sprite: "dune",
    mass: 11e-7,
    drawR: 48e-4,
    color: "#d6a960",
    atmosphere: "#e6c07a",
    orbit: {
      around: "star",
      angle: 1.3,
      semiMajor: 1.2,
      eccentricity: 0.35,
      periapsisAngle: 4.79
    },
    brief: {
      "class": "Terrestrial, arid",
      diameterKm: 9400,
      tempC: -180,
      note: "RC NOTE"
    }
  },
  {
    kind: "rogue",
    id: "taste",
    name: "Sanguinus",
    sprite: "sanguinus",
    mass: 9e-9,
    drawR: 26e-4,
    color: "#5f5b76",
    arrival: {
      x: -3.195,
      y: 1.163,
      vx: 0.07009,
      vy: -1.65846
    },
    chance: 1,
    brief: {
      "class": "Rogue planetary body",
      diameterKm: 2842,
      tempC: -239.2,
      note: "RC NOTE"
    }
  },
  {
    kind: "pocket",
    id: "Styx",
    name: "Styx",
    color: "#b48cff",
    position: {
      radius: 2.085857,
      angle: 0.6013
    },
    mass: 0.6,
    reach: 0.5,
    size: 0.12,
    traits: [
      {
        "eats-belt": {
          radius: 2.3,
          years: 0.15
        }
      }
    ],
    brief: {
      "class": "Singularity",
      diameterKm: 30,
      tempC: -270,
      note: "The pocket. Pulls from every direction inside half an AU, and it takes the ship as happily as a planet. It sits close to the belt and it is eating it, so the cushions have a clock on them. And captain: the belt is rock. Fly through a gap or not at all."
    }
  },
  {
    kind: "belt",
    id: "belt",
    radius: 2.7,
    sections: 48,
    halfWidth: 0.07,
    restitution: 0.85
  }
];
const level01 = {
  schemaVersion,
  id,
  name,
  viewRadius,
  ship,
  loadout,
  bodies
};
export {
  bodies,
  level01 as default,
  id,
  loadout,
  name,
  schemaVersion,
  ship,
  viewRadius
};
