import { ORBS_STORAGE_KEY, readOrbBalance } from './createOrbRewards';
import {
  CHARACTER_ITEMS,
  characterItem,
  DEFAULT_CHARACTER,
  readCharacterAppearance,
  STORE_COSMETICS,
  storeCosmetic,
  calendarDay,
  DAILY_REWARDS,
  type CharacterAppearance,
  type DailyChoice,
  DAILY_SUPPLIES,
  DAILY_SUPPLY_TIERS,
  dailySupply,
} from './storeCatalog';

export const SNIPER_PRICE = 750;
export const UZI_PRICE = 300;
export const MOLOTOV_PRICE = 250;
export const ROCKET_PRICE = 500;
export const WALLET_STORAGE_KEY = 'edgefront-arena.wallet.v1';
export const ORBITER_CLICKS = 20;
type WalletState = {
  orbs: number;
  sniperOwned: boolean;
  rocketOwned: boolean;
  molotovOwned: boolean;
  uziOwned: boolean;
  orbClicks: number;
  characterOwned: string[];
  cosmeticOwned: number[];
  character: CharacterAppearance;
  dailyClaims: number;
  lastClaim: string;
  dailyOffer: { date: string; rewardId: string } | null;
};
type WalletStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type PurchaseResult =
  | 'purchased'
  | 'owned'
  | 'insufficient'
  | 'unavailable';

// Device-local progress: balance and ownership are saved together, never separately.
export function createOrbWallet(
  storage?: WalletStorage,
  testShopWeapons = false,
  clock: () => Date = () => new Date(),
  random: () => number = Math.random,
) {
  let state: WalletState = {
    orbs: 0,
    sniperOwned: false,
    rocketOwned: false,
    molotovOwned: false,
    uziOwned: false,
    orbClicks: 0,
    characterOwned: [],
    cosmeticOwned: [],
    character: { ...DEFAULT_CHARACTER },
    dailyClaims: 0,
    lastClaim: '',
    dailyOffer: null,
  };
  let saved = !!storage;
  function readState(parsed: Partial<WalletState>): WalletState {
    const characterOwned = Array.isArray(parsed.characterOwned)
      ? [
          ...new Set(
            parsed.characterOwned.filter(
              (id) =>
                typeof id === 'string' &&
                CHARACTER_ITEMS.some((item) => item.id === id),
            ),
          ),
        ]
      : [];
    const cosmeticOwned = Array.isArray(parsed.cosmeticOwned)
      ? [
          ...new Set(
            parsed.cosmeticOwned.filter((id) =>
              STORE_COSMETICS.some((item) => item.level === id),
            ),
          ),
        ]
      : [];
    return {
      orbs: readOrbBalance(String(parsed.orbs)),
      sniperOwned: parsed.sniperOwned === true,
      rocketOwned: parsed.rocketOwned === true,
      molotovOwned: parsed.molotovOwned === true,
      uziOwned: parsed.uziOwned === true,
      orbClicks: Math.min(
        ORBITER_CLICKS,
        readOrbBalance(String(parsed.orbClicks)),
      ),
      characterOwned,
      cosmeticOwned,
      character: readCharacterAppearance(parsed.character, characterOwned),
      dailyClaims:
        Number.isSafeInteger(parsed.dailyClaims) && parsed.dailyClaims! >= 0
          ? parsed.dailyClaims!
          : 0,
      lastClaim:
        typeof parsed.lastClaim === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(parsed.lastClaim)
          ? parsed.lastClaim
          : '',
      dailyOffer:
        parsed.dailyOffer &&
        /^\d{4}-\d{2}-\d{2}$/.test(parsed.dailyOffer.date) &&
        dailySupply(parsed.dailyOffer.rewardId)
          ? {
              date: parsed.dailyOffer.date,
              rewardId: parsed.dailyOffer.rewardId,
            }
          : null,
    };
  }
  function refresh() {
    try {
      const raw = storage?.getItem(WALLET_STORAGE_KEY);
      if (raw) state = readState(JSON.parse(raw));
    } catch {
      saved = false;
    }
  }
  try {
    const raw = storage?.getItem(WALLET_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = readState(parsed);
    } else {
      // Keep Orbs earned before the sniper/shop purchase update.
      state.orbs = readOrbBalance(storage?.getItem(ORBS_STORAGE_KEY) ?? null);
    }
  } catch {
    saved = false;
  }

  function persist(next: WalletState) {
    try {
      if (!storage) throw new Error('Browser saving unavailable');
      storage.setItem(WALLET_STORAGE_KEY, JSON.stringify(next));
      saved = true;
      return true;
    } catch {
      saved = false;
      return false;
    }
  }

  function currentSupply() {
    return dailySupply(
      state.dailyOffer?.date === calendarDay(clock())
        ? state.dailyOffer.rewardId
        : 'orbs100',
    )!;
  }
  function changeDaily(action: 'reroll' | 'upgrade') {
    refresh();
    if (state.dailyClaims < 7)
      return {
        result: 'unavailable',
        message: 'Complete the seven starter rewards first.',
      };
    if (calendarDay(clock()) <= state.lastClaim)
      return {
        result: 'already',
        message: 'Already claimed today. Change your next supply tomorrow.',
      };
    const current = currentSupply(),
      tier = DAILY_SUPPLY_TIERS[current.tier];
    const cost = action === 'reroll' ? tier.reroll : tier.upgrade;
    if (cost === null)
      return {
        result: 'maximum',
        message: 'Your daily supply is already Elite.',
      };
    if (state.orbs < cost)
      return {
        result: 'insufficient',
        message: `You need ${cost} Orbs to ${action}.`,
      };
    const pool = DAILY_SUPPLIES.filter(
      (reward) =>
        reward.tier ===
          (action === 'reroll' ? current.tier : current.tier + 1) &&
        reward.id !== current.id,
    );
    const roll = random(),
      index = Math.min(
        pool.length - 1,
        Math.max(
          0,
          Math.floor((Number.isFinite(roll) ? roll : 0) * pool.length),
        ),
      );
    const reward = pool[index];
    const next = {
      ...state,
      orbs: state.orbs - cost,
      dailyOffer: { date: calendarDay(clock()), rewardId: reward.id },
    };
    if (!persist(next))
      return {
        result: 'unavailable',
        message: 'Could not save. Your Orbs were not spent.',
      };
    state = next;
    return {
      result: 'changed',
      message: `${action === 'reroll' ? 'Rerolled' : 'Upgraded'} to ${reward.name} · ${cost} Orbs spent. Claim it when ready.`,
    };
  }
  return {
    get state() {
      const visible = {
        ...state,
        characterOwned: [...state.characterOwned],
        cosmeticOwned: [...state.cosmeticOwned],
        character: { ...state.character },
        dailyOffer: state.dailyOffer ? { ...state.dailyOffer } : null,
      };
      // Preview-only ownership: never write these free unlocks into the save.
      // Future paid weapons using an "Owned" flag automatically join this mode.
      if (testShopWeapons) {
        for (const key of Object.keys(visible) as (keyof WalletState)[]) {
          if (key.endsWith('Owned') && typeof visible[key] === 'boolean') {
            Object.assign(visible, { [key]: true });
          }
        }
      }
      return {
        ...visible,
        orbiterOwned: state.orbClicks === ORBITER_CLICKS,
        saved,
      };
    },
    refresh,
    dailyStatus() {
      const recurring = state.dailyClaims >= 7,
        day = Math.min(8, state.dailyClaims + 1),
        offer = recurring ? currentSupply() : null;
      return {
        day,
        recurring,
        available: calendarDay(clock()) > state.lastClaim,
        lastClaim: state.lastClaim,
        reward: offer ?? DAILY_REWARDS[day - 1],
        offer,
        tier: offer ? DAILY_SUPPLY_TIERS[offer.tier].name : null,
        rerollCost: offer ? DAILY_SUPPLY_TIERS[offer.tier].reroll : null,
        upgradeCost: offer ? DAILY_SUPPLY_TIERS[offer.tier].upgrade : null,
      };
    },
    rerollDaily: () => changeDaily('reroll'),
    upgradeDaily: () => changeDaily('upgrade'),
    claimDaily(choice: DailyChoice = 'wrap'): {
      result: 'claimed' | 'already' | 'unavailable';
      message: string;
    } {
      refresh();
      if (calendarDay(clock()) <= state.lastClaim)
        return {
          result: 'already',
          message: 'Already claimed today. Come back tomorrow.',
        };
      const recurring = state.dailyClaims >= 7,
        day = Math.min(8, state.dailyClaims + 1),
        reward = recurring ? currentSupply() : DAILY_REWARDS[day - 1];
      const next = {
        ...state,
        characterOwned: [...state.characterOwned],
        cosmeticOwned: [...state.cosmeticOwned],
        character: { ...state.character },
        dailyClaims: state.dailyClaims + 1,
        lastClaim: calendarDay(clock()),
        dailyOffer:
          recurring && state.dailyOffer ? { ...state.dailyOffer } : null,
      };
      let amount: number = reward.orbs,
        description: string = reward.name;
      if (recurring) {
        const offer = currentSupply(),
          duplicate = DAILY_SUPPLY_TIERS[offer.tier].duplicate;
        if (offer.cosmetic !== undefined) {
          if (next.cosmeticOwned.includes(offer.cosmetic)) amount = duplicate;
          else next.cosmeticOwned.push(offer.cosmetic);
        }
        if (offer.character) {
          if (next.characterOwned.includes(offer.character)) amount = duplicate;
          else next.characterOwned.push(offer.character);
        }
        if (offer.weapon === 'uzi') {
          if (next.uziOwned) amount = duplicate;
          else next.uziOwned = true;
        }
        description = amount
          ? `${amount} Orbs claimed`
          : offer.name + ' unlocked';
      }
      if (day === 2) {
        if (choice === 'weapon') {
          amount = next.uziOwned ? 150 : 0;
          next.uziOwned = true;
          description = amount
            ? '150 Orbs · Flux Uzi already owned'
            : 'Flux Uzi unlocked';
        } else {
          const item = storeCosmetic(
            choice === 'skin' ? -1 : choice === 'charm' ? -3 : -2,
          )!;
          amount = next.cosmeticOwned.includes(item.level) ? 150 : 0;
          if (!amount) next.cosmeticOwned.push(item.level);
          description = amount
            ? '150 Orbs · Cosmetic already owned'
            : item.name + ' unlocked';
        }
      }
      const character =
        day === 4 ? 'ice' : day === 6 ? 'signal' : day === 7 ? 'aurora' : null;
      if (character) {
        if (next.characterOwned.includes(character))
          amount += day === 7 ? 125 : day === 6 ? 100 : 75;
        else next.characterOwned.push(character);
      }
      next.orbs = Math.min(Number.MAX_SAFE_INTEGER, next.orbs + amount);
      if (!persist(next))
        return {
          result: 'unavailable',
          message:
            'Could not save your reward. Try again when browser saving is available.',
        };
      state = next;
      return { result: 'claimed', message: description };
    },
    buyCharacter(id: string): PurchaseResult {
      refresh();
      const item = characterItem(id);
      if (!item) return 'unavailable';
      if (item.price === 0 || state.characterOwned.includes(id)) return 'owned';
      if (state.orbs < item.price) return 'insufficient';
      const next = {
        ...state,
        orbs: state.orbs - item.price,
        characterOwned: [...state.characterOwned, id],
      };
      if (!persist(next)) return 'unavailable';
      state = next;
      return 'purchased';
    },
    equipCharacter(id: string) {
      refresh();
      const item = characterItem(id);
      if (!item || (item.price > 0 && !state.characterOwned.includes(id)))
        return false;
      const next = {
        ...state,
        character: { ...state.character, [item.slot]: id },
      };
      if (!persist(next)) return false;
      state = next;
      return true;
    },
    buyCosmetic(id: number): PurchaseResult {
      refresh();
      const item = storeCosmetic(id);
      if (!item || item.price === 0)
        return state.cosmeticOwned.includes(id) ? 'owned' : 'unavailable';
      if (state.cosmeticOwned.includes(id)) return 'owned';
      if (state.orbs < item.price) return 'insufficient';
      const next = {
        ...state,
        orbs: state.orbs - item.price,
        cosmeticOwned: [...state.cosmeticOwned, id],
      };
      if (!persist(next)) return 'unavailable';
      state = next;
      return 'purchased';
    },
    clickOrb(): 'progress' | 'unlocked' | 'owned' | 'unavailable' {
      if (state.orbClicks === ORBITER_CLICKS) return 'owned';
      const next = { ...state, orbClicks: state.orbClicks + 1 };
      if (!persist(next)) return 'unavailable';
      state = next;
      return state.orbClicks === ORBITER_CLICKS ? 'unlocked' : 'progress';
    },
    award(amount: number) {
      if (!Number.isSafeInteger(amount) || amount <= 0) return;
      state = {
        ...state,
        orbs: Math.min(Number.MAX_SAFE_INTEGER, state.orbs + amount),
      };
      persist(state);
    },
    buyUzi(): PurchaseResult {
      if (testShopWeapons || state.uziOwned) return 'owned';
      if (state.orbs < UZI_PRICE) return 'insufficient';
      const next = { ...state, orbs: state.orbs - UZI_PRICE, uziOwned: true };
      if (!persist(next)) return 'unavailable';
      state = next;
      return 'purchased';
    },
    buyMolotov(): PurchaseResult {
      if (testShopWeapons || state.molotovOwned) return 'owned';
      if (state.orbs < MOLOTOV_PRICE) return 'insufficient';
      const next = {
        ...state,
        orbs: state.orbs - MOLOTOV_PRICE,
        molotovOwned: true,
      };
      if (!persist(next)) return 'unavailable';
      state = next;
      return 'purchased';
    },
    buyRocket(): PurchaseResult {
      if (testShopWeapons || state.rocketOwned) return 'owned';
      if (state.orbs < ROCKET_PRICE) return 'insufficient';
      const next = {
        ...state,
        orbs: state.orbs - ROCKET_PRICE,
        rocketOwned: true,
      };
      if (!persist(next)) return 'unavailable';
      state = next;
      return 'purchased';
    },
    buySniper(): PurchaseResult {
      if (testShopWeapons || state.sniperOwned) return 'owned';
      if (state.orbs < SNIPER_PRICE) return 'insufficient';
      const next = {
        ...state,
        orbs: state.orbs - SNIPER_PRICE,
        sniperOwned: true,
      };
      // If saving fails, do not spend the player's Orbs or grant a temporary unlock.
      if (!persist(next)) return 'unavailable';
      state = next;
      return 'purchased';
    },
  };
}
