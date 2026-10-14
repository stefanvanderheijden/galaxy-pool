const schemaVersion = 2;
const id = "level-03";
const name = "Corvus";
const viewRadius = 3.2;
const ship = {
  spawn: {
    radius: 1.95,
    angle: 0.9
  },
  traits: [
    "inhabited"
  ],
  brief: {
    "class": "The ark",
    note: "RC NOTE: the ark, level 3. Two suns, so the middle of the table is not where you think it is, and one of these worlds shoots at us."
  }
};
const loadout = {
  nose: "standard",
  chamber: [
    "night",
    "grav"
  ]
};
const bodies = [
  {
    kind: "star",
    id: "star",
    name: "Corvus",
    type: "yellow-dwarf",
    brief: {
      "class": "G-type main sequence",
      diameterKm: 1392e3,
      tempC: 5504,
      note: "RC NOTE: the primary of a pair. The two of them turn about their shared centre, and every world out here circles both."
    }
  },
  {
    kind: "star",
    id: "beta",
    name: "Corvus B",
    type: "red-dwarf",
    orbit: {
      around: "star",
      angle: 0,
      radius: 0.34
    },
    brief: {
      "class": "M-type main sequence",
      diameterKm: 625328,
      tempC: 3127,
      note: "RC NOTE: the companion. Cooler, smaller, and it drags the whole table round with it."
    }
  },
  {
    kind: "planet",
    id: "sentry",
    name: "Sentry",
    sprite: "terra",
    mass: 18e-7,
    drawR: 68e-4,
    color: "#5fa8d8",
    atmosphere: "#9fd0f0",
    orbit: {
      around: [
        "star",
        "beta"
      ],
      angle: 1.9,
      radius: 1.1
    },
    traits: [
      "inhabited",
      {
        defended: {
          range: 0.95,
          every: 0.05,
          speed: 9
        }
      }
    ],
    brief: {
      "class": "Terrestrial, inhabited",
      diameterKm: 12800,
      tempC: -18,
      note: "RC NOTE: INHABITED AND ARMED. They shoot at the ark inside their range. Do not sit in it."
    }
  },
  {
    kind: "planet",
    id: "bastion",
    name: "Bastion",
    sprite: "red",
    mass: 28e-6,
    drawR: 0.0102,
    color: "#8f6f5a",
    atmosphere: "#b08a6a",
    orbit: {
      around: [
        "star",
        "beta"
      ],
      angle: 5,
      radius: 1.62
    },
    brief: {
      "class": "Terrestrial, dense",
      diameterKm: 23100,
      tempC: -72,
      note: "RC NOTE: HEAVY, and it carries a satellite. It takes a beating before it moves at all."
    }
  },
  {
    kind: "planet",
    id: "watch",
    name: "Watch",
    sprite: "vera",
    mass: 25e-8,
    drawR: 34e-4,
    color: "#cfd8e8",
    orbit: {
      around: "bastion",
      angle: 4.5,
      radius: 0.095
    },
    brief: {
      "class": "Satellite",
      diameterKm: 3400,
      tempC: -80,
      note: "RC NOTE: Bastion's satellite. Light: it is the easy pot, if you can get it off."
    }
  },
  {
    kind: "planet",
    id: "ember",
    name: "Ember",
    sprite: "dune",
    mass: 8e-7,
    drawR: 58e-4,
    color: "#d98c4a",
    atmosphere: "#e8b070",
    orbit: {
      around: [
        "star",
        "beta"
      ],
      angle: 3.1,
      radius: 0.78
    },
    brief: {
      "class": "Terrestrial",
      diameterKm: 10200,
      tempC: 34,
      note: "RC NOTE: the inner world, close to both suns. Ordinary weight: it goes where it is sent."
    }
  },
  {
    kind: "pocket",
    id: "crow",
    name: "Crow",
    color: "#b48cff",
    position: {
      radius: 2.35,
      angle: 0.35
    },
    mass: 0.5,
    reach: 0.62,
    size: 0.09,
    brief: {
      "class": "Black hole",
      note: "RC NOTE: a pocket."
    }
  },
  {
    kind: "pocket",
    id: "gallows",
    name: "Gallows",
    color: "#b48cff",
    position: {
      radius: 2.35,
      angle: 3.5
    },
    mass: 0.5,
    reach: 0.62,
    size: 0.09,
    brief: {
      "class": "Black hole",
      note: "RC NOTE: the far pocket."
    }
  },
  {
    kind: "belt",
    id: "belt",
    radius: 2.35,
    sections: 52,
    halfWidth: 0.06,
    restitution: 0.85
  }
];
const level03 = {
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
  level03 as default,
  id,
  loadout,
  name,
  schemaVersion,
  ship,
  viewRadius
};
