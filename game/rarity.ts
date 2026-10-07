export const RARITIES = {
  common: { label: 'Common', color: '#9fddb9' },
  uncommon: { label: 'Uncommon', color: '#75e5cc' },
  rare: { label: 'Rare', color: '#8ebcff' },
  epic: { label: 'Epic', color: '#c5a0f4' },
  legendary: { label: 'Legendary', color: '#edc776' },
  mythic: { label: 'Mythic', color: '#ff9991' },
} as const;
export type Rarity = keyof typeof RARITIES;
export function careerRarity(level: number): Rarity {
  if (level % 500 === 0) return 'mythic';
  if (level % 100 === 0) return 'legendary';
  if (level % 25 === 0) return 'epic';
  if (level % 5 === 0) return 'rare';
  return level % 3 === 0 ? 'rare' : level % 2 === 0 ? 'uncommon' : 'common';
}
export function shopRarity(price: number): Rarity {
  return price >= 400
    ? 'legendary'
    : price >= 300
      ? 'epic'
      : price >= 200
        ? 'rare'
        : price > 0
          ? 'uncommon'
          : 'common';
}
