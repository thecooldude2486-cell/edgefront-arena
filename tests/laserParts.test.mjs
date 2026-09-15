import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
const { LASER_PARTS, LASER_PARTS_KEY, createLaserPartsProgress } = await import('../game/laserParts.ts');
const values = new Map();
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
let progress = createLaserPartsProgress(storage);
assert.equal(progress.state.count, 0);
assert.equal(progress.collect('cell'), true);
assert.equal(progress.collect('cell'), false);
assert.equal(progress.collect('invalid'), false);
progress = createLaserPartsProgress(storage);
assert.equal(progress.state.count, 1);
for (const part of LASER_PARTS.slice(1, 4)) progress.collect(part.id);
assert.equal(progress.state.unlocked, false);
progress.collect(LASER_PARTS[4].id);
assert.equal(progress.state.unlocked, true);
assert.equal(createLaserPartsProgress(storage).state.unlocked, true);
assert.deepEqual([...values.keys()], [LASER_PARTS_KEY], 'Does not touch Orbs or weapon ownership');
assert.equal(createLaserPartsProgress({ getItem: () => 'bad data', setItem() {} }).state.count, 0);
const blocked = createLaserPartsProgress({ getItem: () => null, setItem() { throw Error('blocked'); } });
blocked.collect('cell'); assert.equal(blocked.state.saved, false);
assert.equal(createLaserPartsProgress().state.saved, false);

const { NullEngine, Scene, Vector3, Ray } = await import('@babylonjs/core');
const { createLobby, LOBBY_SPAWN } = await import('../game/createLobby.ts');
globalThis.OffscreenCanvas = class {
  constructor(width, height) { this.width = width; this.height = height; }
  getContext() { return { fillRect() {}, fillText() {}, measureText: () => ({ width: 500 }) }; }
};
const engine = new NullEngine(); const scene = new Scene(engine);
const lobby = createLobby(scene);
scene.meshes.forEach(mesh => mesh.computeWorldMatrix(true));
assert.equal(lobby.secrets.nearby(LOBBY_SPAWN), null);
for (const part of LASER_PARTS) {
  const approach = part.id === 'regulator' ? new Vector3(part.x, 1.72, part.z - 2)
    : new Vector3(part.x + (part.id === 'emitter' ? -2 : 2), 1.72, part.z);
  assert.equal(lobby.secrets.nearby(approach)?.id, part.id, 'Visible part can be collected from its shelf or table');
}
const doors = scene.meshes.filter(mesh => mesh.metadata?.secretEntrance);
assert.equal(doors.length, 3, 'Exactly three disguised room entrances');
for (const door of doors) {
  assert.equal(door.checkCollisions, false, 'False walls allow walking through');
  assert.ok(door.isVisible, 'Entrances are visually concealed');
  const side = Math.sign(door.position.x);
  const start = door.position.z === -89 ? new Vector3(14, 1.5, -90.5) : new Vector3(side * 25.5, 1.5, door.position.z);
  const direction = door.position.z === -89 ? Vector3.Forward() : new Vector3(side, 0, 0);
  assert.equal(scene.pickWithRay(new Ray(start, direction, 3), mesh => mesh.checkCollisions)?.hit, false, 'Doorway has no solid wall left behind it');
  assert.ok(scene.pickWithRay(new Ray(start, direction, 3), mesh => mesh.metadata?.secretEntrance)?.hit, 'Disguise blocks the exterior view');
  assert.ok(scene.pickWithRay(new Ray(door.position, Vector3.Down(), 2), mesh => mesh.checkCollisions)?.hit, 'Entrance has a continuous floor');
}
// Conservative navigation flood-fill: prove each hiding place has a walk-in
// route from spawn with half a metre of clearance around solid obstacles.
const obstacles = scene.meshes.filter(mesh => mesh.checkCollisions).map(mesh => mesh.getBoundingInfo().boundingBox)
  .filter(box => box.maximumWorld.y > .05 && box.minimumWorld.y < 1.8);
const key = (x, z) => `${x},${z}`;
const onFloor = (x, z) => (Math.abs(x) < 27 && z > -151 && z < -89)
  || (x > -36 && x <= -27 && z > -109 && z < -101)
  || (x >= 27 && x < 36 && z > -108 && z < -100)
  || (x > 10 && x < 18 && z >= -89 && z < -80);
const walkable = (x, z) => onFloor(x, z) && !obstacles.some(box =>
  x > box.minimumWorld.x - .5 && x < box.maximumWorld.x + .5 && z > box.minimumWorld.z - .5 && z < box.maximumWorld.z + .5);
const queue = [[0, -141]]; const reached = new Set([key(0, -141)]);
for (let i = 0; i < queue.length; i++) {
  const [x, z] = queue[i];
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, nz = z + dz, id = key(nx, nz);
    if (!reached.has(id) && walkable(nx, nz)) { reached.add(id); queue.push([nx, nz]); }
  }
}
for (const part of LASER_PARTS) assert.ok(queue.some(([x, z]) =>
  Math.hypot(x - part.x, z - part.z) <= 2.2 && lobby.secrets.nearby(new Vector3(x, 1.72, z))?.id === part.id), `${part.id} has a walk-in collection route and return path`);
lobby.secrets.setCollected(LASER_PARTS.map(part => part.id));
assert.equal(lobby.secrets.nearby(new Vector3(-10, 1.72, -113)), null);
scene.dispose(); engine.dispose();
console.log('PASS: five parts, save compatibility, unlock, two obvious parts, three enclosed rooms, walk-through doors, continuous floors and return paths.');
