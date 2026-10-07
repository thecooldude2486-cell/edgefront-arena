import '../server/gameImports.mjs';
import assert from 'node:assert/strict';
import {
  NullEngine,
  Scene,
  UniversalCamera,
  Vector3,
  MeshBuilder,
} from '@babylonjs/core';
const { createWeapon } = await import('../game/createWeapon.ts');
const canvas = new EventTarget();
globalThis.window = new EventTarget();
window.setTimeout = setTimeout;
globalThis.document = new EventTarget();
document.pointerLockElement = canvas;
const soundParameter = {
  setValueAtTime() {},
  exponentialRampToValueAtTime() {},
};
globalThis.AudioContext = class {
  currentTime = 0;
  state = 'running';
  destination = {};
  createOscillator() {
    return {
      frequency: soundParameter,
      connect() {
        return this;
      },
      start() {},
      stop() {},
    };
  }
  createGain() {
    return {
      gain: soundParameter,
      connect() {
        return this;
      },
    };
  }
  close() {
    return Promise.resolve();
  }
};
const engine = new NullEngine(),
  scene = new Scene(engine),
  camera = new UniversalCamera('aim', new Vector3(0, 1, 0), scene);
let shot,
  impact,
  shots = 0,
  scope = false;
const weapon = createWeapon(scene, camera, canvas, {
  onAmmoChange() {},
  onHitMarker() {},
  getPrimaryWeapon: () => 'sniper',
  canUseWeapon: () => true,
  onVisualShot: (id, origin, direction) => {
    shot = { id, origin, direction };
    shots++;
  },
  onImpact: (mesh) => {
    impact = mesh;
    return 'head';
  },
  onScopeChange: (active) => {
    scope = active;
  },
});
weapon.selectWeapon('sniper');
const key = new Event('keydown');
Object.assign(key, { code: 'KeyQ', repeat: false });
window.dispatchEvent(key);
weapon.update(performance.now(), false);
assert.equal(scope, true);
// Aim changes between render frames, as it does on a fast flick followed by a click.
camera.getViewMatrix(true);
camera.rotation.set(0.11, 0.27, 0);
camera.getViewMatrix(true);
const intended = camera.getForwardRay(200);
const head = MeshBuilder.CreateSphere('test head', { diameter: 0.42 }, scene);
head.position.copyFrom(intended.origin.add(intended.direction.scale(25)));
head.computeWorldMatrix(true);
const eliminated = MeshBuilder.CreateSphere('eliminated team member', { diameter:.8 }, scene);
eliminated.position.copyFrom(intended.origin.add(intended.direction.scale(5)));
eliminated.computeWorldMatrix(true);
eliminated.setEnabled(false);
const click = new Event('mousedown');
Object.assign(click, { button: 0 });
canvas.dispatchEvent(click);
assert.equal(
  shots,
  1,
  'Scoped shot fires within the click handler, before another frame',
);
assert.equal(impact, head, 'The visible aim hits the living target before recoil and ignores eliminated team members');
assert.ok(
  Vector3.Distance(shot.direction, intended.direction) < 1e-6,
  'Online effect and bot hit ray share pre-recoil aim',
);
assert.ok(Vector3.Distance(shot.origin, intended.origin) < 1e-6);
assert.ok(
  Math.abs(camera.rotation.x - 0.11) > 1e-6,
  'Recoil still kicks the camera after the shot',
);
weapon.update(performance.now() + 2000, false);
assert.equal(
  shots,
  1,
  'Holding semi-auto cannot enqueue a delayed second shot',
);
weapon.dispose();
scene.dispose();
engine.dispose();
console.log(
  'PASS: scoped sniper click fires immediately at flick aim, online/local rays agree, recoil occurs after aim capture and no queued shot.',
);
