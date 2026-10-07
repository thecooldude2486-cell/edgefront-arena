export const ARENA_MAPS = {
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
