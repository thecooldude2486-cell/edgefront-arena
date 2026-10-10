export const GAME_PREFERENCES_KEY = 'edgefront-settings-v1';
export type GamePreferences = {
  sensitivity: number;
  volume: number;
  graphics: 'performance' | 'balanced' | 'high';
  reducedMotion: boolean;
};
export const DEFAULT_GAME_PREFERENCES: GamePreferences = {
  sensitivity: 1,
  volume: 0.7,
  graphics: 'balanced',
  reducedMotion: false,
};
export type PreferencesState = GamePreferences & { saved: boolean };
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
const bounded = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;

export function normalizeGamePreferences(
  value: unknown,
  defaults = DEFAULT_GAME_PREFERENCES,
): GamePreferences {
  const v =
    value && typeof value === 'object'
      ? (value as Partial<GamePreferences>)
      : {};
  return {
    sensitivity: bounded(v.sensitivity, defaults.sensitivity, 0.25, 2.5),
    volume: bounded(v.volume, defaults.volume, 0, 1),
    graphics:
      v.graphics === 'performance' ||
      v.graphics === 'high' ||
      v.graphics === 'balanced'
        ? v.graphics
        : defaults.graphics,
    reducedMotion:
      typeof v.reducedMotion === 'boolean'
        ? v.reducedMotion
        : defaults.reducedMotion,
  };
}

export function createGamePreferences(
  storage?: PreferenceStorage,
  reducedMotion = false,
) {
  const defaults = { ...DEFAULT_GAME_PREFERENCES, reducedMotion };
  let state = { ...defaults },
    saved = !!storage;
  const listeners = new Set<(value: PreferencesState) => void>();
  function read() {
    try {
      state = normalizeGamePreferences(
        JSON.parse(storage?.getItem(GAME_PREFERENCES_KEY) ?? 'null'),
        defaults,
      );
      saved = !!storage;
    } catch {
      state = { ...defaults };
      saved = false;
    }
  }
  read();
  const snapshot = () => ({ ...state, saved });
  const publish = () => {
    const value = snapshot();
    listeners.forEach((listener) => listener(value));
    return value;
  };
  return {
    get state() {
      return snapshot();
    },
    update(patch: Partial<GamePreferences>) {
      state = normalizeGamePreferences({ ...state, ...patch }, state);
      try {
        storage?.setItem(GAME_PREFERENCES_KEY, JSON.stringify(state));
        saved = !!storage;
      } catch {
        saved = false;
      }
      return publish();
    },
    reset() {
      return this.update(defaults);
    },
    refresh() {
      read();
      return publish();
    },
    subscribe(listener: (value: PreferencesState) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

let shared: ReturnType<typeof createGamePreferences> | undefined;
function preferences() {
  if (!shared) {
    let storage: Storage | undefined;
    try {
      if (typeof window !== 'undefined') storage = window.localStorage;
    } catch {
      /* Session settings still work. */
    }
    shared = createGamePreferences(
      storage,
      typeof window !== 'undefined' &&
        !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    );
  }
  return shared;
}
export const getGamePreferences = () => preferences().state;
export const updateGamePreferences = (patch: Partial<GamePreferences>) =>
  preferences().update(patch);
export const resetGamePreferences = () => preferences().reset();
export const refreshGamePreferences = () => preferences().refresh();
export const subscribeGamePreferences = (
  listener: (value: PreferencesState) => void,
) => preferences().subscribe(listener);

// Cap retina render cost without changing world coordinates, aim, or collisions.
export function renderScaling(
  graphics: GamePreferences['graphics'],
  pixelRatio: number,
) {
  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  return graphics === 'performance'
    ? 1.25
    : 1 / Math.min(ratio, graphics === 'high' ? 2 : 1.5);
}
export function applyViewPreferences(
  camera: { angularSensibility: number },
  engine: { setHardwareScalingLevel: (value: number) => void },
  prefs: GamePreferences,
  pixelRatio: number,
  baseSensitivity: number,
) {
  const safe = normalizeGamePreferences(prefs);
  camera.angularSensibility = baseSensitivity / safe.sensitivity;
  engine.setHardwareScalingLevel(renderScaling(safe.graphics, pixelRatio));
}
