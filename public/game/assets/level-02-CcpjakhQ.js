const schemaVersion = 2;
const id = "level-02";
const name = "Halcyon";
const viewRadius = 2.9;
const ship = {
  spawn: {
    radius: 1.95,
    angle: 2
  },
  traits: [
    "inhabited"
  ],
  brief: {
    "class": "The ark",
    note: "RC NOTE: the ark, level 2. Two worlds here crack if you hit them hard, two will not move unless you do. Same ark, same three balls."
  }
};
const loadout = {
  nose: "standard",
  chamber: [
    "standard",
    "grav"
  ]
};
const bodies = [
  {
    kind: "star",
    id: "star",
    name: "Halcyon",
    type: "yellow-dwarf",
    brief: {
      "class": "G-type main sequence",
      diameterKm: 1392e3,
      tempC: 5504,
      note: "RC NOTE: a yellow dwarf, an ordinary sun. Which balls strike it and which burn, and that the table is not clear until it is potted."
    }
  },
  {
    kind: "planet",
    id: "glass",
    name: "Glass",
    sprite: "vera",
    mass: 6e-7,
    drawR: 52e-4,
    color: "#9fd8e8",
    atmosphere: "#bfe8f5",
    integrity: 0.3,
    orbit: {
      around: "star",
      angle: 0.9,
      radius: 0.68
    },
    traits: [
      "fragile"
    ],
    brief: {
      "class": "Terrestrial, thin shell",
      diameterKm: 9800,
      tempC: -41,
      note: "RC NOTE: FRAGILE. Barely holds together: a hard shot shatters it, which is a foul. Nudge it, do not hit it."
    }
  },
  {
    kind: "planet",
    id: "porcelain",
    name: "Porcelain",
    sprite: "terra",
    mass: 9e-7,
    drawR: 62e-4,
    color: "#e8d8c0",
    atmosphere: "#f2e4cf",
    integrity: 0.35,
    orbit: {
      around: "star",
      angle: 4,
      radius: 1.32
    },
    traits: [
      "fragile"
    ],
    brief: {
      "class": "Terrestrial, thin shell",
      diameterKm: 11600,
      tempC: -63,
      note: "RC NOTE: FRAGILE, and it carries a satellite. The satellite rides it, but a hard hit shakes it loose and then there are two of them loose on the table."
    }
  },
  {
    kind: "planet",
    id: "shard",
    name: "Shard",
    sprite: "red",
    mass: 2e-7,
    drawR: 32e-4,
    color: "#c8b8a8",
    orbit: {
      around: "porcelain",
      angle: 1.2,
      radius: 0.085
    },
    brief: {
      "class": "Satellite",
      diameterKm: 3100,
      tempC: -70,
      note: "RC NOTE: the satellite. It goes where Porcelain goes until someone hits one of them hard enough."
    }
  },
  {
    kind: "planet",
    id: "anvil",
    name: "Anvil",
    sprite: "red",
    mass: 24e-6,
    drawR: 98e-4,
    color: "#8f7f74",
    atmosphere: "#a89a86",
    orbit: {
      around: "star",
      angle: 2.4,
      radius: 1.02
    },
    brief: {
      "class": "Terrestrial, dense",
      diameterKm: 21400,
      tempC: -55,
      note: "RC NOTE: HEAVY. Ten times the weight of a normal world: a full shot barely shifts it. Several, or use it as a wall to bounce off."
    }
  },
  {
    kind: "planet",
    id: "ingot",
    name: "Ingot",
    sprite: "dune",
    mass: 16e-6,
    drawR: 88e-4,
    color: "#b08858",
    atmosphere: "#d8b070",
    orbit: {
      around: "star",
      angle: 5.6,
      radius: 1.72
    },
    brief: {
      "class": "Terrestrial, dense",
      diameterKm: 19200,
      tempC: -88,
      note: "RC NOTE: HEAVY, and further out, so it is the long job. Line it up rather than fight it."
    }
  },
  {
    kind: "pocket",
    id: "cairn",
    name: "Cairn",
    color: "#b48cff",
    position: {
      radius: 2.1,
      angle: 1.05
    },
    mass: 0.5,
    reach: 0.6,
    size: 0.09,
    brief: {
      "class": "Black hole",
      note: "RC NOTE: a pocket. What touches it is potted."
    }
  },
  {
    kind: "pocket",
    id: "vault",
    name: "Vault",
    color: "#b48cff",
    position: {
      radius: 2.1,
      angle: 4.2
    },
    mass: 0.5,
    reach: 0.6,
    size: 0.09,
    brief: {
      "class": "Black hole",
      note: "RC NOTE: the second pocket, opposite."
    }
  },
  {
    kind: "belt",
    id: "belt",
    radius: 2.1,
    sections: 48,
    halfWidth: 0.06,
    restitution: 0.85
  }
];
const level02 = {
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
  level02 as default,
  id,
  loadout,
  name,
  schemaVersion,
  ship,
  viewRadius
};
