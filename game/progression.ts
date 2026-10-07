import {careerRarity,type Rarity} from './rarity.ts';
import { eliminationXp, type EliminationPerformance } from './combatXp.ts';
import { SKIN_DESIGNS, SKIN_DESCRIPTIONS } from './skinDesigns.ts';
import { WRAP_NAMES, WRAP_DESCRIPTIONS } from './wrapDesign.ts';
import type { Difficulty } from './difficulty.ts';
import { storeCosmetic, STORE_COSMETICS, readCharacterAppearance, type CharacterAppearance } from './storeCatalog.ts';

export const PROGRESSION_KEY = 'edgefront-arena.progression.v1';
const PROGRESSION_VERSION = 2;
export type CosmeticKind = 'skin' | 'wrap' | 'charm';
export type Cosmetics = Record<CosmeticKind, number | null>;
export const EMPTY_COSMETICS: Cosmetics = { skin: null, wrap: null, charm: null };
export type LevelReward = { rarity:Rarity; level: number; kind: CosmeticKind; name: string; color: string; accent: string; edition: number; pattern: number; signature: boolean; description: string };
// Curated sports-tech palettes: pearl armour, graphite frames and energy accents.
const THEMES = [
  ['Aurora', '#75e5cc', '#173842'], ['Solar', '#edb16a', '#303643'],
  ['Nebula', '#b799e3', '#292d45'], ['Glacier', '#9acfe7', '#203b4d'],
  ['Crimson', '#e8878c', '#3e2834'], ['Eclipse', '#d4c7aa', '#292f3b'],
  ['Kestrel', '#e9f0f1', '#35d5ea'], ['Helion', '#b4edca', '#285d57'],
  ['Comet', '#f0ab82', '#493440'], ['Vector', '#b7d8e8', '#3b8fa8'],
  ['Flux', '#79c6dc', '#213544'], ['Orbiter', '#bca5ed', '#40305a'],
  ['Concourse', '#c6dbe2', '#427781'], ['Circuit', '#9fddb9', '#27483e'],
  ['Meridian', '#a6bbd3', '#38465c'], ['Ember', '#d9946c', '#563b34'],
  ['Titanium', '#b9c5d0', '#374554'], ['Carbon', '#778997', '#172733'],
  ['Ion', '#a3e3ea', '#326e80'], ['Saffron', '#ddc173', '#48412f'],
  ['Rose', '#dba9b6', '#463646'], ['Arctic', '#edf6f7', '#71a9b8'],
  ['Rook', '#95baa9', '#314b45'], ['Prism', '#b3b8e7', '#414b74'],
] as const;
const FINISHES = SKIN_DESIGNS;
const WRAPS = WRAP_NAMES;
const CHARMS = ['Orbiter Halo', 'Helion Cell', 'Vector Blade', 'Comet Rocket', 'Flux Chip', 'Kestrel Wing', 'Meridian Optic', 'Atrium Crest'];
export function rewardAt(level: number): LevelReward | null {
  const store = storeCosmetic(level); if (store) return store;
  if (!Number.isSafeInteger(level) || level < 2) return null;
  // Keep all existing five-level reward IDs and kinds compatible with saved loadouts.
  const signature = level % 5 === 0;
  const index = signature ? level / 5 - 1 : level - 2;
  const edition = Math.floor(index / 3) + 1;
  const kind = (['skin', 'wrap', 'charm'] as const)[index % 3];
  const themeIndex = signature ? edition - 1 : edition + 5;
  const theme = THEMES[themeIndex % THEMES.length];
  const pattern = (edition - 1 + (signature ? 0 : 3) + Math.floor(themeIndex / THEMES.length)) % 8;
  // Additional series stay within the same curated palette instead of random RGB shifts.
  const series = Math.floor(themeIndex / THEMES.length) + 1;
  const detail = (kind === 'skin' ? FINISHES : kind === 'wrap' ? WRAPS : CHARMS)[pattern];
  const description = kind === 'skin' ? SKIN_DESCRIPTIONS[pattern]
    : kind === 'wrap' ? WRAP_DESCRIPTIONS[pattern]
    : 'Miniature Edgefront hardware on a short articulated metal tether.';
  return { rarity:careerRarity(level), level, kind, edition, pattern, signature, description,
    name: `${theme[0]} ${detail} / ${signature ? 'Signature' : 'Field'} ${series}`,
    color: theme[1], accent: theme[2] };
}
// Level 1 starts at zero; each next level costs 1000 + 200 per existing level.
// Closed-form calculation avoids looping through all previous levels.
export function xpForLevel(level: number) { const n = Math.max(0, level - 1); return 100 * n * n + 900 * n; }
export function levelFromXp(xp: number) {
  let level = Math.floor((Math.sqrt(810000 + 400 * Math.max(0, xp)) - 900) / 200) + 1;
  // Correct floating-point rounding exactly on a threshold.
  if (xpForLevel(level) > xp) level--;
  if (xpForLevel(level + 1) <= xp) level++;
  return Math.max(1, level);
}
export function levelDetails(xp: number) {
  const level = levelFromXp(xp), base = xpForLevel(level), next = xpForLevel(level + 1);
  return { level, xp, earned: xp - base, required: next - base, nextReward: rewardAt(level + 1)! };
}
export function readCosmetics(value: unknown, level: number, owned: readonly number[] = []): Cosmetics {
  const source = value && typeof value === 'object' ? value as Partial<Cosmetics> : {};
  return Object.fromEntries((['skin', 'wrap', 'charm'] as const).map(kind => {
    const id = source[kind];
    return [kind, typeof id === 'number' && (id < 0 ? owned.includes(id) : id <= level) && rewardAt(id)?.kind === kind ? id : null];
  })) as Cosmetics;
}
export function readPlayerProfile(value: unknown): { level: number; cosmetics: Cosmetics; character?: CharacterAppearance } | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as { level?: unknown; cosmetics?: unknown; character?: unknown };
  if (typeof source.level !== 'number' || !Number.isSafeInteger(source.level) || source.level < 1) return null;
  // Store cosmetics and character gear are presentation data, like career rank.
  return { level: source.level, cosmetics: readCosmetics(source.cosmetics, source.level, STORE_COSMETICS.map(item=>item.level)),
    ...(source.character===undefined ? {} : {character:readCharacterAppearance(source.character)}) };
}
export function createProgression(storage?: Pick<Storage, 'getItem' | 'setItem'>, getOwned: () => readonly number[] = () => []) {
  let xp = 0, cosmetics = { ...EMPTY_COSMETICS }, saved = !!storage, migrated = false;
  try {
    const raw = storage?.getItem(PROGRESSION_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Number.isSafeInteger(data.xp) && data.xp >= 0) {
        xp = data.xp;
        if (data.version === undefined || data.version === 1) {
          // The new curve is exactly four times the old one: retain the level,
          // progress percentage and unlocked gear without awarding extra Orbs.
          xp = Math.min(Number.MAX_SAFE_INTEGER, xp * 4);
          migrated = true;
        }
      }
      cosmetics = readCosmetics(data.cosmetics, levelFromXp(xp), getOwned());
    }
  } catch { saved = false; }
  function persist() {
    try { if (!storage) throw Error('Saving unavailable'); storage.setItem(PROGRESSION_KEY, JSON.stringify({ version: PROGRESSION_VERSION, xp, cosmetics })); saved = true; }
    catch { saved = false; }
  }
  if (migrated) persist();
  return {
    get state() { return { ...levelDetails(xp), cosmetics: { ...cosmetics }, saved }; },
    award(amount: number) {
      const before = levelFromXp(xp);
      if (!Number.isSafeInteger(amount) || amount <= 0) return { before, after: before, orbs: 0 };
      xp = Math.min(Number.MAX_SAFE_INTEGER, xp + amount); persist();
      const after = levelFromXp(xp);
      return { before, after, orbs: (after - before) * 15 };
    },
    equip(kind: CosmeticKind, id: number | null) {
      if (id !== null && (rewardAt(id)?.kind !== kind || (id < 0 ? !getOwned().includes(id) : id > levelFromXp(xp)))) return false;
      cosmetics = { ...cosmetics, [kind]: id }; persist(); return true;
    },
  };
}
export const XP_MULTIPLIERS: Record<Difficulty | 'online', number> = { easy: 1, normal: 1.5, hard: 2, extreme: 2.5, nightmare: 3, online: 2 };
// One tracker per active match. Score totals, not HUD messages, determine payment.
export function createMatchXpTracker() {
  let active = false, finished = false, previous = [0, 0], bonuses: string[] = [];
  return {
    get bonuses() { return [...bonuses]; },
    begin(scores: number[] = [0, 0]) { bonuses = []; active = true; finished = false; previous = [...scores]; },
    stop() { active = false; },
    update(scores: number[], result: 'none' | 'victory' | 'defeat', mode: Difficulty | 'online', performance?: Partial<EliminationPerformance>) {
      bonuses = [];
      if (!active || finished || scores.length !== 2 || scores.some((n, i) => !Number.isInteger(n) || n < previous[i] || n > 5)) return 0;
      const won = scores[0] - previous[0], lost = scores[1] - previous[1];
      previous = [...scores];
      const elimination=eliminationXp(performance);
      let amount = won * elimination.amount + lost * (25 + (performance ? Math.round(Math.max(0, Math.min(100, Number.isFinite(performance.damageDealt) ? performance.damageDealt! : 0)) * .2) : 0));
      if (won) bonuses = elimination.bonuses;
      if (result !== 'none') {
        // A result is valid only after one side reaches the match target.
        if ((result === 'victory' && scores[0] === 5) || (result === 'defeat' && scores[1] === 5)) {
          amount += result === 'victory' ? 150 : 75; finished = true;
        }
      }
      return Math.floor(amount * XP_MULTIPLIERS[mode]);
    },
  };
}
