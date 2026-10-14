const schemaVersion = 2;
const id = "level-05";
const name = "Terminus";
const viewRadius = 3.4;
const ship = {
  spawn: {
    radius: 1.6,
    angle: 2.3
  },
  traits: [
    "inhabited"
  ],
  brief: {
    "class": "The ark",
    note: "RC NOTE: the ark, level 5. The thing over the table is what we came for. Our cue balls do nothing to it. The worlds do."
  }
};
const loadout = {
  nose: "standard",
  chamber: [
    "standard",
    "night"
  ]
};
const bodies = [
  {
    kind: "star",
    id: "star",
    name: "Terminus",
    type: "white-dwarf",
    brief: {
      "class": "White dwarf",
      diameterKm: 14e3,
      tempC: 8100,
      note: "RC NOTE: a white dwarf, small and hot. Which balls strike it, and that it is not the target this time."
    }
  },
  {
    kind: "planet",
    id: "hammer",
    name: "Hammer",
    sprite: "red",
    mass: 32e-6,
    drawR: 0.0102,
    color: "#8f7f74",
    atmosphere: "#a89a86",
    orbit: {
      around: "star",
      angle: 1.1,
      radius: 0.95
    },
    brief: {
      "class": "Terrestrial, dense",
      diameterKm: 22800,
      tempC: -44,
      note: "RC NOTE: HEAVY. The best thing we have to throw: weight and speed are what hurt it."
    }
  },
  {
    kind: "planet",
    id: "wedge",
    name: "Wedge",
    sprite: "dune",
    mass: 9e-6,
    drawR: 76e-4,
    color: "#b08858",
    atmosphere: "#d8b070",
    orbit: {
      around: "star",
      angle: 3.6,
      radius: 1.35
    },
    brief: {
      "class": "Terrestrial",
      diameterKm: 15600,
      tempC: -66,
      note: "RC NOTE: middling weight. Two of these do what one Hammer does."
    }
  },
  {
    kind: "planet",
    id: "pebble",
    name: "Pebble",
    sprite: "vera",
    mass: 9e-7,
    drawR: 44e-4,
    color: "#cfd8e8",
    orbit: {
      around: "star",
      angle: 5.4,
      radius: 1.75
    },
    brief: {
      "class": "Terrestrial, light",
      diameterKm: 6400,
      tempC: -92,
      note: "RC NOTE: light. It will not hurt the thing much, but it is easy to send where you want."
    }
  },
  {
    kind: "boss",
    id: "superearth",
    name: "Super Earth",
    sprite: "terra",
    color: "#4a7dff",
    atmosphere: "#8fc3e8",
    position: {
      radius: 4.6,
      angle: 4.712
    },
    drawR: 2.4,
    hp: 24,
    conjureEvery: 0.35,
    sigilAt: 0.3,
    brief: {
      "class": "Super-Earth, inhabited",
      diameterKm: 41e3,
      tempC: 14,
      note: "RC NOTE: the boss. It hangs over the table, throws rocks at us and opens holes on the table. Pool worlds into it. When it is weak enough, draw the five-pointed sigil on the belt with a cue ball's trail."
    }
  },
  {
    kind: "pocket",
    id: "grave",
    name: "Grave",
    color: "#b48cff",
    position: {
      radius: 2.4,
      angle: 1.9
    },
    mass: 0.5,
    reach: 0.6,
    size: 0.09,
    brief: {
      "class": "Black hole",
      note: "RC NOTE: the one pocket. Worlds are ammunition here, so think before potting one."
    }
  },
  {
    kind: "belt",
    id: "belt",
    radius: 2.4,
    sections: 60,
    halfWidth: 0.06,
    restitution: 0.9
  }
];
const level05 = {
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
  level05 as default,
  id,
  loadout,
  name,
  schemaVersion,
  ship,
  viewRadius
};
