import { ORBS_STORAGE_KEY, readOrbBalance } from './createOrbRewards';

export const SNIPER_PRICE = 300;
export const WALLET_STORAGE_KEY = 'edgefront-arena.wallet.v1';
export const ORBITER_CLICKS = 20;
type WalletState = { orbs: number; sniperOwned: boolean; orbClicks: number };
type WalletStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type PurchaseResult = 'purchased' | 'owned' | 'insufficient' | 'unavailable';

// Device-local progress: balance and ownership are saved together, never separately.
export function createOrbWallet(storage?: WalletStorage) {
  let state: WalletState = { orbs: 0, sniperOwned: false, orbClicks: 0 };
  let saved = !!storage;
  try {
    const raw = storage?.getItem(WALLET_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { orbs: readOrbBalance(String(parsed.orbs)), sniperOwned: parsed.sniperOwned === true,
        orbClicks: Math.min(ORBITER_CLICKS, readOrbBalance(String(parsed.orbClicks))) };
    } else {
      // Keep Orbs earned before the sniper/shop purchase update.
      state.orbs = readOrbBalance(storage?.getItem(ORBS_STORAGE_KEY) ?? null);
    }
  } catch { saved = false; }

  function persist(next: WalletState) {
    try {
      if (!storage) throw new Error('Browser saving unavailable');
      storage.setItem(WALLET_STORAGE_KEY, JSON.stringify(next));
      saved = true;
      return true;
    } catch { saved = false; return false; }
  }

  return {
    get state() { return { ...state, orbiterOwned: state.orbClicks === ORBITER_CLICKS, saved }; },
    clickOrb(): 'progress' | 'unlocked' | 'owned' | 'unavailable' {
      if (state.orbClicks === ORBITER_CLICKS) return 'owned';
      const next = { ...state, orbClicks: state.orbClicks + 1 };
      if (!persist(next)) return 'unavailable';
      state = next;
      return state.orbClicks === ORBITER_CLICKS ? 'unlocked' : 'progress';
    },
    award(amount: number) {
      if (!Number.isSafeInteger(amount) || amount <= 0) return;
      state = { ...state, orbs: Math.min(Number.MAX_SAFE_INTEGER, state.orbs + amount) };
      persist(state);
    },
    buySniper(): PurchaseResult {
      if (state.sniperOwned) return 'owned';
      if (state.orbs < SNIPER_PRICE) return 'insufficient';
      const next = { ...state, orbs: state.orbs - SNIPER_PRICE, sniperOwned: true };
      // If saving fails, do not spend the player's Orbs or grant a temporary unlock.
      if (!persist(next)) return 'unavailable';
      state = next;
      return 'purchased';
    },
  };
}
