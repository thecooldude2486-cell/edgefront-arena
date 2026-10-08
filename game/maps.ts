export const ARENA_MAPS = {
  quarry: {
    name: 'Prism Quarry',
    difficulty: 'Normal',
    color: '#deba82',
    scale: 1,
    description:
      '1v1 duel through staggered stone cuts and a low central overlook.',
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },
  conduit: {
    name: 'Conduit',
    difficulty: 'Easy',
    color: '#60d8bf',
    scale: 1.25,
    description:
      '2v2 power station: paired winding lanes, short cover hops and twin overlooks.',
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },
  depot: {
    name: 'Freight Depot',
    difficulty: 'Normal',
    color: '#cca876',
    scale: 1.3,
    description:
      '2v2 cargo yard: offset container lanes and a raised loading platform.',
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },
  causeway: {
    name: 'Causeway',
    difficulty: 'Hard',
    color: '#8aafe7',
    scale: 1.35,
    description:
      '2v2 bridge approach: crossed firing lanes and two ramped side platforms.',
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },
  junction: {
    name: 'Junction',
    difficulty: 'Easy',
    color: '#84d5ab',
    scale: 1.45,
    description:
      '3v3 interchange: three connected lanes with staggered cover and a central deck.',
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },
  atrium: {
    name: 'Atrium',
    difficulty: 'Normal',
    color: '#7ad9db',
    scale: 1.45,
    description:
      '3v3 courtyard: opposing alcoves, protected outer routes and twin mezzanines.',
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },
  reactor: {
    name: 'Reactor',
    difficulty: 'Hard',
    color: '#a5d071',
    scale: 1.5,
    description:
      '3v3 energy core: a fortified centre, radial cover and broad flanking corridors.',
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },
  terraces: {
    name: 'Terraces',
    difficulty: 'Hard',
    color: '#ad9bdd',
    scale: 1.5,
    description:
      '3v3 stepped arena: separated ramped firing platforms and zigzag ground routes.',
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },
  switchback: {
    name: 'Switchback',
    difficulty: 'Extreme',
    color: '#dc9b9e',
    scale: 1.5,
    description:
      '3v3 precision arena: alternating baffles force sharp peeks and quick rotations.',
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },
  district: {
    name: 'District',
    difficulty: 'Normal',
    color: '#89bbb9',
    scale: 1.6,
    description:
      '4v4 city block: four sheltered cross routes and raised corner outposts.',
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },
  drydock: {
    name: 'Drydock',
    difficulty: 'Normal',
    color: '#b9aa88',
    scale: 1.65,
    description:
      '4v4 dock basin: split cargo stacks, a central service deck and wide side lanes.',
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },
  bastion: {
    name: 'Bastion',
    difficulty: 'Hard',
    color: '#b19bd9',
    scale: 1.65,
    description:
      '4v4 stronghold: twin fortified courts and ramped observation decks.',
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },
  reservoir: {
    name: 'Reservoir',
    difficulty: 'Hard',
    color: '#6bbedb',
    scale: 1.7,
    description:
      '4v4 waterworks: long parallel channels joined by protected crossing points.',
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },
  gauntlet: {
    name: 'Gauntlet',
    difficulty: 'Extreme',
    color: '#df997d',
    scale: 1.7,
    description:
      '4v4 assault lanes: tall alternating cover and exposed central firing platforms.',
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },
  terminal: {
    name: 'Terminal',
    difficulty: 'Normal',
    color: '#82c5c9',
    scale: 1.9,
    description:
      '5v5 transit hub: five open approaches, island cover and paired loading decks.',
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },
  refinery: {
    name: 'Refinery',
    difficulty: 'Hard',
    color: '#d4b472',
    scale: 2,
    description:
      '5v5 industrial complex: layered process walls, wide flank routes and twin gantries.',
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },
  nexus: {
    name: 'Nexus',
    difficulty: 'Extreme',
    color: '#bd9fe5',
    scale: 2.05,
    description:
      '5v5 command arena: a raised central crossing with five staggered combat lanes.',
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },

  foundry: {
    name: 'Foundry',
    difficulty: 'Normal',
    color: '#dba76d',
    description:
      'Medium team arena with staggered factory lanes and a protected central courtyard.',
    scale: 1.35,
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },
  relay: {
    name: 'Relay Station',
    difficulty: 'Hard',
    color: '#a595e4',
    description:
      'Medium team arena with twin raised control decks and cross-lane cover.',
    scale: 1.35,
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },
  harbor: {
    name: 'Sky Harbor',
    difficulty: 'Hard',
    color: '#55ced0',
    description:
      'Large team arena with cargo islands, flanking lanes and long sightlines.',
    scale: 1.75,
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },
  citadel: {
    name: 'Citadel',
    difficulty: 'Extreme',
    color: '#e68f9e',
    description:
      'Large team arena with fortified firing decks and a wide central assault lane.',
    scale: 1.75,
    patrol: [
      [-18, 12],
      [-18, -12],
      [18, -12],
      [18, 12],
    ],
  },

  switchyard: {
    name: 'Switchyard',
    difficulty: 'Easy',
    color: '#9fddb9',
    description:
      'Ground-level routes, generous cover and clear corners. Learn movement and peeking.',
    patrol: [
      [-14, 10],
      [-14, -10],
      [14, -10],
      [14, 10],
    ],
  },
  stadium: {
    name: 'Stadium',
    difficulty: 'Normal',
    color: '#35d5ea',
    description:
      'The original arena: a central ring, three lanes and elevated flanks.',
    patrol: [
      [-13, 10],
      [-16, -6],
      [14, -10],
      [16, 7],
    ],
  },
  skyline: {
    name: 'Skyline',
    difficulty: 'Hard',
    color: '#b799e3',
    description:
      'A high skybridge, lower combat deck and long ramps. Control height and watch above you.',
    patrol: [
      [-10, 12],
      [-10, -12],
      [10, -12],
      [10, 12],
    ],
  },
  crossfire: {
    name: 'Crossfire',
    difficulty: 'Extreme',
    color: '#e8878c',
    description:
      'Exposed sightlines, small cover islands and four firing decks. Precision and fast rotations matter.',
    patrol: [
      [-15, 12],
      [-15, -12],
      [15, -12],
      [15, 12],
    ],
  },
} as const;
export type ArenaMapId = keyof typeof ARENA_MAPS;
export const DEFAULT_MAP: ArenaMapId = 'stadium';
export function isArenaMapId(value: unknown): value is ArenaMapId {
  return typeof value === 'string' && Object.hasOwn(ARENA_MAPS, value);
}

// Every mode has its own five-map pool, shared by bot selection and online voting.
export const MODE_MAPS = {
  1: ['switchyard', 'stadium', 'skyline', 'crossfire', 'quarry'],
  2: ['foundry', 'relay', 'conduit', 'depot', 'causeway'],
  3: ['junction', 'atrium', 'reactor', 'terraces', 'switchback'],
  4: ['district', 'drydock', 'bastion', 'reservoir', 'gauntlet'],
  5: ['harbor', 'citadel', 'terminal', 'refinery', 'nexus'],
} as const satisfies Record<1 | 2 | 3 | 4 | 5, readonly ArenaMapId[]>;
