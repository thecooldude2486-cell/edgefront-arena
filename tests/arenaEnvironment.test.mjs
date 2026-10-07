import assert from 'node:assert/strict';
import '../server/gameImports.mjs';
const { NullEngine, Scene, Vector3 } = await import('@babylonjs/core');
const { createArena } = await import('../game/createArena.ts');
const { getBlastImpulse } = await import('../game/blastJump.ts');
const { createReplayBuffer, readKillReplay } =
  await import('../game/killReplay.ts');
const { readDeathRecap, createDeathRecap } =
  await import('../game/deathRecap.ts');
const { ferryPosition } = await import('../game/arenaEnvironment.ts');
const engine = new NullEngine(),
  scene = new Scene(engine);
try {
  const arena = createArena(scene),
    env = arena.environment;
  const pos = ferryPosition(1, 0),
    standing = new Vector3(pos.x, pos.y + 0.9, pos.z);
  env.update(0.2, 0.2);
  const motion = env.carry(standing, 0.9);
  assert.ok(
    motion.length() > 0,
    'Standing riders get the moving ferry displacement',
  );
  standing.addInPlace(motion);
  const next = ferryPosition(1, 0.2);
  assert.ok(
    Vector3.Distance(standing, new Vector3(next.x, next.y + 0.9, next.z)) <
      1e-6,
  );
  assert.equal(
    env.carry(standing.add(new Vector3(0, 2, 0)), 0.9).length(),
    0,
    'Airborne players are never carried',
  );
  const impulse = getBlastImpulse(
    new Vector3(14, 1.74, 35),
    new Vector3(14, 2.5, 35),
    Math.PI / 2,
  );
  assert.ok(
    1.6 + impulse.y ** 2 / (2 * 23) > 4.8,
    'A correctly placed blast jump can reach the perch',
  );
  assert.ok(
    1.6 + 8.4 ** 2 / (2 * 23) < 4.8,
    'Ordinary jumps cannot reach the perch',
  );
  const barrel = env.barrels[0];
  let blasts = 0;
  assert.ok(env.hit(barrel, 44, () => blasts++));
  assert.equal(blasts, 0);
  assert.ok(env.hit(barrel, 1, () => blasts++));
  assert.equal(blasts, 1);
  assert.equal(barrel.isEnabled(), false);
  assert.equal(
    env.hit(barrel, 100, () => blasts++),
    false,
  );
  assert.equal(blasts, 1, 'Destroyed barrels cannot explode twice');
  env.reset();
  assert.equal(barrel.isEnabled(), true);
  arena.dispose();
  const buffer = createReplayBuffer(),
    actor = {
      pose: { x: 0, y: 0.9, z: 0, yaw: 0, pitch: 0 },
      health: 100,
      weapon: 'assaultRifle',
    };
  for (let t = 0; t <= 6000; t += 50)
    buffer.capture(
      t,
      [actor, { ...actor, pose: { ...actor.pose, z: 4 } }],
      t === 6000
        ? {
            actor: 1,
            origin: { x: 0, y: 1.5, z: 4 },
            direction: { x: 0, y: 0, z: -1 },
          }
        : undefined,
    );
  const replay = buffer.read('stadium', 1, [45, 45, 45, 45], 6);
  assert.ok(readKillReplay(replay));
  assert.ok(replay.frames.length <= 80);
  assert.equal(replay.frames.at(-1).at, 3);
  assert.ok(replay.frames.at(-1).shot);
  assert.equal(readKillReplay({ ...replay, killer: 99 }), null);
  assert.equal(
    readKillReplay({
      ...replay,
      frames: [
        { ...replay.frames[0], actors: [{ ...actor, health: NaN }, actor] },
      ],
    }),
    null,
  );
  buffer.capture(
    6001,
    [actor, { ...actor, health: 0 }],
    undefined,
    undefined,
    true,
  );
  assert.equal(
    buffer.read('stadium', 1, [45, 45, 45, 45], 6).frames.at(-1).actors[1]
      .health,
    0,
    'The lethal frame is recorded even just after a shot',
  );
  buffer.reset();
  assert.equal(buffer.read('stadium', 1, [45, 45, 45, 45], 0), null);
  const damage = createDeathRecap();
  damage.record('assaultRifle', 'body', 100, 88, 20);
  damage.record('oilBarrel', 'splash', 88, 0, 1);
  const recap = readDeathRecap({
    ...damage.read('Oil barrel', 64, 12),
    replay,
  });
  assert.ok(recap);
  assert.equal(recap.totalDamage, 100);
  assert.equal(recap.finalHit.weapon, 'oilBarrel');
  assert.ok(recap.replay);
  console.log(
    'PASS: ferry carrying and airborne exclusion, achievable item traversal, barrel health/explosion/reset, bounded authentic replay history, malformed replay rejection and mixed weapon/environment recaps.',
  );
} finally {
  scene.dispose();
  engine.dispose();
}
