const schemaVersion = 2;
const id = "level-04";
const name = "Janus";
const viewRadius = 4.4;
const ship = {
  spawn: {
    radius: 2.15,
    angle: 3.4
  },
  traits: [
    "inhabited"
  ],
  brief: {
    "class": "The ark",
    note: "RC NOTE: the ark, level 4. Two systems on one table and a wormhole between them. What goes in one mouth comes out the other, us included."
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
    name: "Janus",
    type: "yellow-dwarf",
    brief: {
      "class": "G-type main sequence",
      diameterKm: 1392e3,
      tempC: 5504,
      note: "RC NOTE: the near sun. Its worlds are the ones on this side."
    }
  },
  {
    kind: "star",
    id: "beta",
    name: "Janus B",
    type: "red-dwarf",
    orbit: {
      around: "star",
      angle: 0,
      radius: 2.9
    },
    brief: {
      "class": "M-type main sequence",
      diameterKm: 625328,
      tempC: 3127,
      note: "RC NOTE: the far sun, right across the table, with its own worlds. Both suns have to go in a pocket before the table is clear."
    }
  },
  {
    kind: "planet",
    id: "mercy",
    name: "Mercy",
    sprite: "terra",
    mass: 14e-7,
    drawR: 64e-4,
    color: "#6fb0d8",
    atmosphere: "#a8d8f0",
    orbit: {
      around: "star",
      angle: 2.2,
      radius: 0.62
    },
    brief: {
      "class": "Terrestrial",
      diameterKm: 12100,
      tempC: -24,
      note: "RC NOTE: near side, ordinary. Goes where it is sent."
    }
  },
  {
    kind: "planet",
    id: "tallow",
    name: "Tallow",
    sprite: "dune",
    mass: 9e-7,
    drawR: 58e-4,
    color: "#c8a060",
    atmosphere: "#e0c080",
    orbit: {
      around: "star",
      angle: 5.1,
      radius: 1.05
    },
    brief: {
      "class": "Terrestrial",
      diameterKm: 10400,
      tempC: -48,
      note: "RC NOTE: near side, outer. A long way from a pocket unless the wormhole is used."
    }
  },
  {
    kind: "planet",
    id: "vast",
    name: "Vast",
    sprite: "vera",
    mass: 6e-5,
    drawR: 0.019,
    color: "#8fa8d8",
    atmosphere: "#b8d0f0",
    orbit: {
      around: "star",
      angle: 0.7,
      radius: 1.55
    },
    traits: [
      "porous"
    ],
    brief: {
      "class": "Gas giant",
      diameterKm: 142900,
      tempC: -108,
      note: "RC NOTE: GAS ALL THE WAY DOWN. Balls and struck worlds go straight through it, and come out bent about half as much as a real hit would bend them. Use it to turn a shot on the cheap."
    }
  },
  {
    kind: "planet",
    id: "flint",
    name: "Flint",
    sprite: "red",
    mass: 11e-7,
    drawR: 56e-4,
    color: "#b07858",
    atmosphere: "#d09070",
    orbit: {
      around: "beta",
      angle: 1.4,
      radius: 0.52
    },
    brief: {
      "class": "Terrestrial",
      diameterKm: 9600,
      tempC: -61,
      note: "RC NOTE: far side. The wormhole is the short way to it."
    }
  },
  {
    kind: "planet",
    id: "tine",
    name: "Tine",
    sprite: "vera",
    mass: 5e-7,
    drawR: 42e-4,
    color: "#cfd8e8",
    orbit: {
      around: "beta",
      angle: 4.4,
      radius: 0.86
    },
    brief: {
      "class": "Terrestrial, light",
      diameterKm: 6200,
      tempC: -96,
      note: "RC NOTE: far side, light: it flies off a full shot. Mind where it goes."
    }
  },
  {
    kind: "wormhole",
    id: "gate",
    name: "The Gate",
    color: "#b48cff",
    a: {
      radius: 1.25,
      angle: 5.8
    },
    b: {
      radius: 1.75,
      angle: 0.55
    },
    radius: 0.11
  },
  {
    kind: "pocket",
    id: "near",
    name: "Nearside",
    color: "#b48cff",
    position: {
      radius: 3.1,
      angle: 2.6
    },
    mass: 0.5,
    reach: 0.7,
    size: 0.1,
    brief: {
      "class": "Black hole",
      note: "RC NOTE: the near pocket."
    }
  },
  {
    kind: "pocket",
    id: "far",
    name: "Farside",
    color: "#b48cff",
    position: {
      radius: 3.1,
      angle: 5.9
    },
    mass: 0.5,
    reach: 0.7,
    size: 0.1,
    brief: {
      "class": "Black hole",
      note: "RC NOTE: the far pocket, on the other sun's side."
    }
  },
  {
    kind: "belt",
    id: "belt",
    radius: 3.3,
    sections: 64,
    halfWidth: 0.07,
    restitution: 0.85
  }
];
const level04 = {
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
  level04 as default,
  id,
  loadout,
  name,
  schemaVersion,
  ship,
  viewRadius
};
