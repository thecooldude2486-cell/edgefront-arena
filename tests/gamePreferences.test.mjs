import assert from 'node:assert/strict';
import {
  createGamePreferences,
  normalizeGamePreferences,
  renderScaling,
  applyViewPreferences,
  GAME_PREFERENCES_KEY,
} from '../game/gamePreferences.ts';

const values = new Map([
  ['career', 'keep career'],
  ['orbs', '1200'],
]);
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};
const prefs = createGamePreferences(storage, true);
assert.equal(
  prefs.state.reducedMotion,
  true,
  'Uses system motion preference on first visit',
);
let notices = 0;
const unsubscribe = prefs.subscribe(() => notices++);
prefs.update({ sensitivity: 2, volume: 0, graphics: 'performance' });
assert.equal(notices, 1);
assert.equal(prefs.state.saved, true);
assert.equal(
  createGamePreferences(storage).state.volume,
  0,
  'Mute survives reload',
);
assert.equal(createGamePreferences(storage).state.sensitivity, 2);
assert.equal(values.get('career'), 'keep career');
assert.equal(
  values.get('orbs'),
  '1200',
  'Settings never change wallet or career',
);
const detached = prefs.state;
detached.volume = 0.5;
assert.equal(prefs.state.volume, 0, 'Caller cannot mutate store snapshots');
unsubscribe();
prefs.update({ volume: 0.25 });
assert.equal(notices, 1);
values.set(
  GAME_PREFERENCES_KEY,
  JSON.stringify({
    sensitivity: 1.5,
    volume: 0.9,
    graphics: 'high',
    reducedMotion: false,
  }),
);
prefs.refresh();
assert.equal(prefs.state.volume, 0.9, 'Cross-tab refresh reads saved changes');
prefs.reset();
assert.equal(prefs.state.sensitivity, 1);
assert.equal(prefs.state.reducedMotion, true);
const broken = createGamePreferences({
  getItem() {
    throw Error('Blocked');
  },
  setItem() {
    throw Error('Blocked');
  },
});
assert.equal(broken.state.saved, false);
broken.update({ sensitivity: 1.25, volume: 0 });
assert.equal(
  broken.state.sensitivity,
  1.25,
  'Session settings work with blocked storage',
);
assert.equal(broken.state.saved, false);
values.set(GAME_PREFERENCES_KEY, '{bad json');
assert.equal(
  createGamePreferences(storage).state.volume,
  0.7,
  'Damaged saves recover defaults',
);
const safe = normalizeGamePreferences({
  sensitivity: Infinity,
  volume: 50,
  graphics: 'ultra',
  reducedMotion: 'true',
});
assert.deepEqual(safe, {
  sensitivity: 1,
  volume: 1,
  graphics: 'balanced',
  reducedMotion: false,
});
assert.equal(
  normalizeGamePreferences({ sensitivity: -1, volume: -2 }).sensitivity,
  0.25,
);
assert.equal(normalizeGamePreferences({ volume: -2 }).volume, 0);
assert.equal(renderScaling('high', 3), 0.5);
assert.equal(renderScaling('balanced', 3), 1 / 1.5);
assert.equal(renderScaling('performance', 3), 1.25);
assert.equal(renderScaling('high', NaN), 1);
const camera = {
  angularSensibility: 1350,
  position: { x: 4, y: 1.8, z: 2 },
  rotation: { yaw: 0.4 },
};
let scaling;
const engine = {
  setHardwareScalingLevel(value) {
    scaling = value;
  },
};
applyViewPreferences(
  camera,
  engine,
  { ...safe, sensitivity: 2, graphics: 'high' },
  3,
  1350,
);
assert.equal(
  camera.angularSensibility,
  675,
  'Higher setting increases mouse turn distance',
);
assert.equal(scaling, 0.5);
assert.deepEqual(camera.position, { x: 4, y: 1.8, z: 2 });
assert.deepEqual(
  camera.rotation,
  { yaw: 0.4 },
  'Settings do not alter pose or aim',
);
console.log(
  'PASS: saved settings, system motion defaults, reload and cross-tab persistence, corrupt/blocked storage, wallet isolation, reset, value bounds, retina scaling and preserved player pose.',
);
