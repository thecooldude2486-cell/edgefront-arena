import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({
  resolve(s, c, next) {
    if (s.startsWith('@babylonjs/core/') && !s.endsWith('.js'))
      return next(s + '.js', c);
    if (s.startsWith('.') && !/\.[a-z]+$/i.test(s)) return next(s + '.ts', c);
    return next(s, c);
  },
});
const { createShotSound } = await import('../game/createWeapon.ts');
const { updateGamePreferences } = await import('../game/gamePreferences.ts');
let focused = true,
  played = 0;
const buses = [];
globalThis.document = { hidden: false, hasFocus: () => focused };
const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
globalThis.AudioContext = class {
  currentTime = 0;
  state = 'running';
  destination = {};
  createOscillator() {
    return {
      frequency: param,
      connect() {
        return this;
      },
      start() {
        played++;
      },
      stop() {},
    };
  }
  createGain() {
    const gain = {
      value: 0,
      setValueAtTime(value) {
        this.value = value;
      },
      exponentialRampToValueAtTime(value) {
        this.value = value;
      },
    };
    const node = {
      gain,
      connect(destination) {
        if (destination === thisContext.destination) buses.push(this);
        return this;
      },
    };
    const thisContext = this;
    return node;
  }
  close() {
    return Promise.resolve();
  }
};
const local = createShotSound(),
  remote = createShotSound();
try {
  local.playShot();
  assert.equal(played, 1, 'one local shot produces one sound');
  focused = false;
  remote.playShot();
  assert.equal(
    played,
    1,
    'unfocused opponent tab must not echo the local shot',
  );
  focused = true;
  document.hidden = true;
  remote.playShot();
  assert.equal(
    played,
    1,
    'hidden tabs are silent even if focus state is stale',
  );
  document.hidden = false;
  remote.playShot();
  assert.equal(
    played,
    2,
    'opponent shots remain audible in the active game tab',
  );
  assert.equal(played, 2, 'suppressed sounds are not queued for later');
  assert.equal(
    buses.length,
    2,
    'One master bus per local/remote audio context',
  );
  updateGamePreferences({ volume: 0.3 });
  for (const bus of buses)
    assert.equal(
      bus.gain.value,
      0.3,
      'Volume updates every active sound context',
    );
  local.setLaser(true);
  const soundsBeforeMute = played;
  updateGamePreferences({ volume: 0 });
  for (const bus of buses)
    assert.equal(
      bus.gain.value,
      0,
      'Mute silences an existing beam immediately',
    );
  local.playShot();
  local.playSwing();
  local.playReload();
  remote.playShot();
  assert.equal(
    played,
    soundsBeforeMute,
    'Muted effects create no new oscillators',
  );
  local.setLaser(false);
  updateGamePreferences({ volume: 0.6 });
  local.playShot();
  assert.equal(played, soundsBeforeMute + 1, 'Unmute restores sounds normally');
  local.dispose();
  remote.dispose();
  const previous = buses.map((b) => b.gain.value);
  updateGamePreferences({ volume: 0.8 });
  assert.deepEqual(
    buses.map((b) => b.gain.value),
    previous,
    'Disposed contexts unsubscribe',
  );
  delete globalThis.AudioContext;
  const silent = createShotSound();
  silent.unlock();
  silent.playShot();
  silent.playSwing();
  silent.playReload();
  silent.setLaser(true);
  silent.dispose();
  console.log(
    'PASS: active-tab audio, no duplicate sounds, live master volume, beam mute, silent effects, unmute, disposal and browsers without Web Audio.',
  );
} finally {
  updateGamePreferences({ volume: 0.7 });
}
