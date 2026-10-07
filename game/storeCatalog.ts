import { shopRarity } from './rarity.ts';
export type CharacterSlot = 'suit' | 'visor' | 'gear';
export type CharacterAppearance = Record<CharacterSlot, string>;
export const DEFAULT_CHARACTER: CharacterAppearance = {
  suit: 'standard',
  visor: 'dark',
  gear: 'none',
};
const CHARACTER_CATALOG = [
  {
    id: 'standard',
    slot: 'suit',
    name: 'Standard issue',
    price: 0,
    color: '#35d5ea',
    accent: '#e9f0f1',
  },
  {
    id: 'aurora',
    slot: 'suit',
    name: 'Aurora runner',
    price: 160,
    color: '#75e5cc',
    accent: '#e9f0f1',
  },
  {
    id: 'solar',
    slot: 'suit',
    name: 'Solar striker',
    price: 200,
    color: '#edb16a',
    accent: '#303643',
  },
  {
    id: 'carbon',
    slot: 'suit',
    name: 'Carbon scout',
    price: 180,
    color: '#778997',
    accent: '#b9c5d0',
  },
  {
    id: 'glacier',
    slot: 'suit',
    name: 'Glacier guard',
    price: 220,
    color: '#9acfe7',
    accent: '#edf6f7',
  },
  {
    id: 'eclipse',
    slot: 'suit',
    name: 'Eclipse sentinel',
    price: 220,
    color: '#d4c7aa',
    accent: '#292f3b',
  },
  {
    id: 'prism',
    slot: 'suit',
    name: 'Prism contender',
    price: 260,
    color: '#b3b8e7',
    accent: '#414b74',
  },
  {
    id: 'dark',
    slot: 'visor',
    name: 'Graphite visor',
    price: 0,
    color: '#102535',
    accent: '#35d5ea',
  },
  {
    id: 'amber',
    slot: 'visor',
    name: 'Amber visor',
    price: 80,
    color: '#dd9b40',
    accent: '#ffe4a7',
  },
  {
    id: 'ice',
    slot: 'visor',
    name: 'Ice visor',
    price: 90,
    color: '#71a9b8',
    accent: '#e1fbff',
  },
  {
    id: 'violet',
    slot: 'visor',
    name: 'Violet visor',
    price: 120,
    color: '#8c78bd',
    accent: '#dfceff',
  },
  {
    id: 'none',
    slot: 'gear',
    name: 'No accessory',
    price: 0,
    color: '#182733',
    accent: '#35d5ea',
  },
  {
    id: 'signal',
    slot: 'gear',
    name: 'Signal antenna',
    price: 140,
    color: '#e9f0f1',
    accent: '#35d5ea',
  },
  {
    id: 'crest',
    slot: 'gear',
    name: 'Atrium crest',
    price: 160,
    color: '#182733',
    accent: '#75e5cc',
  },
  {
    id: 'halo',
    slot: 'gear',
    name: 'Orbital headpiece',
    price: 240,
    color: '#b3b8e7',
    accent: '#75e5cc',
  },
] as const;
export const CHARACTER_ITEMS = CHARACTER_CATALOG.map((item) => ({
  ...item,
  rarity: shopRarity(item.price),
}));
export function characterItem(id: string) {
  return CHARACTER_ITEMS.find((item) => item.id === id);
}
export function readCharacterAppearance(
  value: unknown,
  owned?: readonly string[],
): CharacterAppearance {
  const source =
    value && typeof value === 'object'
      ? (value as Partial<CharacterAppearance>)
      : {};
  return Object.fromEntries(
    (['suit', 'visor', 'gear'] as const).map((slot) => {
      const item = CHARACTER_ITEMS.find(
        (item) => item.id === source[slot] && item.slot === slot,
      );
      return [
        slot,
        item &&
        (owned === undefined || item.price === 0 || owned.includes(item.id))
          ? item.id
          : DEFAULT_CHARACTER[slot],
      ];
    }),
  ) as CharacterAppearance;
}
const cosmetic = (
  level: number,
  kind: 'skin' | 'wrap' | 'charm',
  name: string,
  pattern: number,
  color: string,
  accent: string,
  price: number,
  description: string,
) => ({
  level,
  kind,
  name,
  pattern,
  color,
  accent,
  price,
  edition: 1,
  signature: true,
  description,
  rarity: price === 0 ? ('rare' as const) : shopRarity(price),
});
// Negative IDs are store gear; positive IDs remain the uncapped career track.
export const STORE_COSMETICS = [
  cosmetic(
    -1,
    'skin',
    'Daybreak Ceramic Aero',
    0,
    '#e9f0f1',
    '#edb16a',
    0,
    'A complete pearl chassis with gold structural accents. Day 2 reward or daily supply.',
  ),
  cosmetic(
    -2,
    'wrap',
    'Daybreak Spectral Current',
    2,
    '#75e5cc',
    '#edb16a',
    0,
    'Flowing mint, pearl and gold artwork over the entire weapon. Day 2 reward or daily supply.',
  ),
  cosmetic(
    -3,
    'charm',
    'Daybreak Orbiter Halo',
    0,
    '#edb16a',
    '#75e5cc',
    0,
    'A miniature halo with mint core and gold casing. Day 2 reward or daily supply.',
  ),
  cosmetic(
    -4,
    'skin',
    'Carbon Split Frame',
    1,
    '#778997',
    '#35d5ea',
    300,
    'Split chassis, open frame and cyan hardware. Changes the whole gun.',
  ),
  cosmetic(
    -5,
    'skin',
    'Solar Titanium Drum',
    6,
    '#edb16a',
    '#303643',
    400,
    'Sculpted receiver, reinforced barrel and drum magazine.',
  ),
  cosmetic(
    -6,
    'wrap',
    'Prism Mesh',
    6,
    '#b3b8e7',
    '#414b74',
    180,
    'Layered prism facets and fine mesh across every weapon surface.',
  ),
  cosmetic(
    -7,
    'wrap',
    'Glacier Frostglass',
    1,
    '#9acfe7',
    '#71a9b8',
    160,
    'Pearl frost, fine ice crystals and blue glass panels.',
  ),
  cosmetic(
    -8,
    'charm',
    'Meridian Optic',
    6,
    '#a6bbd3',
    '#35d5ea',
    120,
    'A miniature precision optic on an articulated tether.',
  ),
  cosmetic(
    -9,
    'charm',
    'Flux Chip',
    4,
    '#79c6dc',
    '#edb16a',
    140,
    'A graphite circuit module with cyan enamel and gold contacts.',
  ),
];
export function storeCosmetic(id: number) {
  return STORE_COSMETICS.find((item) => item.level === id);
}
export type DailyChoice = 'weapon' | 'skin' | 'wrap' | 'charm';
export const DAILY_REWARDS = [
  { day: 1, name: '50 Orbs', detail: 'Start your week', orbs: 50 },
  {
    day: 2,
    name: 'Choose your gear',
    detail: 'Flux Uzi, Daybreak skin, wrap or charm',
    orbs: 0,
  },
  { day: 3, name: '100 Orbs', detail: 'Build your collection', orbs: 100 },
  {
    day: 4,
    name: 'Ice visor',
    detail: 'Character cosmetic · 75 Orbs if already owned',
    orbs: 0,
  },
  { day: 5, name: '150 Orbs', detail: 'Save for something special', orbs: 150 },
  {
    day: 6,
    name: 'Signal antenna',
    detail: 'Character accessory · 100 Orbs if already owned',
    orbs: 0,
  },
  {
    day: 7,
    name: 'Aurora runner + 200 Orbs',
    detail: 'Character suit · Extra 125 Orbs if already owned',
    orbs: 200,
  },
] as const;
export function calendarDay(now: Date) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export type DailySupplyReward = {
  id: string;
  tier: 1 | 2 | 3;
  name: string;
  detail: string;
  orbs: number;
  character?: string;
  cosmetic?: number;
  weapon?: 'uzi';
};
// One daily supply after the starter track. Each new day begins with the same
// free reward; paid changes affect only that day's unclaimed supply.
export const DAILY_SUPPLIES: readonly DailySupplyReward[] = [
  {
    id: 'orbs100',
    tier: 1,
    name: '100 Orbs',
    detail: 'Standard daily supply',
    orbs: 100,
  },
  {
    id: 'amber',
    tier: 1,
    name: 'Amber visor',
    detail: 'Character visor · 100 Orbs if owned',
    orbs: 0,
    character: 'amber',
  },
  {
    id: 'daybreak-charm',
    tier: 1,
    name: 'Daybreak Orbiter Halo',
    detail: 'Weapon charm · 100 Orbs if owned',
    orbs: 0,
    cosmetic: -3,
  },
  {
    id: 'orbs200',
    tier: 2,
    name: '200 Orbs',
    detail: 'Enhanced daily supply',
    orbs: 200,
  },
  {
    id: 'daybreak-skin',
    tier: 2,
    name: 'Daybreak Ceramic Aero',
    detail: 'Weapon skin · 200 Orbs if owned',
    orbs: 0,
    cosmetic: -1,
  },
  {
    id: 'daybreak-wrap',
    tier: 2,
    name: 'Daybreak Spectral Current',
    detail: 'Weapon wrap · 200 Orbs if owned',
    orbs: 0,
    cosmetic: -2,
  },
  {
    id: 'optic',
    tier: 2,
    name: 'Meridian Optic',
    detail: 'Weapon charm · 200 Orbs if owned',
    orbs: 0,
    cosmetic: -8,
  },
  {
    id: 'orbs350',
    tier: 3,
    name: '350 Orbs',
    detail: 'Elite daily supply',
    orbs: 350,
  },
  {
    id: 'solar-skin',
    tier: 3,
    name: 'Solar Titanium Drum',
    detail: 'Weapon skin · 350 Orbs if owned',
    orbs: 0,
    cosmetic: -5,
  },
  {
    id: 'prism-suit',
    tier: 3,
    name: 'Prism contender',
    detail: 'Character suit · 350 Orbs if owned',
    orbs: 0,
    character: 'prism',
  },
  {
    id: 'halo',
    tier: 3,
    name: 'Orbital headpiece',
    detail: 'Character accessory · 350 Orbs if owned',
    orbs: 0,
    character: 'halo',
  },
  {
    id: 'uzi',
    tier: 3,
    name: 'Flux Uzi',
    detail: 'Weapon · 350 Orbs if owned',
    orbs: 0,
    weapon: 'uzi',
  },
];
export const DAILY_SUPPLY_TIERS = {
  1: { name: 'Standard', reroll: 25, upgrade: 75, duplicate: 100 },
  2: { name: 'Enhanced', reroll: 40, upgrade: 125, duplicate: 200 },
  3: { name: 'Elite', reroll: 60, upgrade: null, duplicate: 350 },
} as const;
export function dailySupply(id: string) {
  return DAILY_SUPPLIES.find((reward) => reward.id === id);
}
