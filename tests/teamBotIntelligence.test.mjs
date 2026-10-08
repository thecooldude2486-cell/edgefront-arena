import '../server/gameImports.mjs';
import assert from 'node:assert/strict';
import {
  NullEngine,
  Scene,
  UniversalCamera,
  MeshBuilder,
  Vector3,
} from '@babylonjs/core';
const { createBotNavigation } = await import('../game/createBotNavigation.ts');
const { createTeamBotBrain } = await import('../game/createTeamBotBrain.ts');
const { createBot } = await import('../game/createBot.ts');
const { createArena } = await import('../game/createArena.ts');
import { teamSpawn, mapsForTeams, mapScale } from '../game/teams.ts';
const engine = new NullEngine(),
  scene = new Scene(engine);
const camera = new UniversalCamera('camera', new Vector3(0, 1.8, -10), scene);
globalThis.window = new EventTarget();
window.setTimeout = () => 0;
const floor = MeshBuilder.CreateBox(
  'test ground',
  { width: 60, height: 1, depth: 60 },
  scene,
);
floor.position.y = -0.5;
floor.checkCollisions = true;
function obstacle(x, z, width = 2, depth = 2) {
  const wall = MeshBuilder.CreateBox(
    'cover',
    { width, height: 3, depth },
    scene,
  );
  wall.position.set(x, 1.5, z);
  wall.checkCollisions = true;
  wall.computeWorldMatrix(true);
  return wall;
}
const actor = (slot, x, z, target) => ({
  slot,
  alive: true,
  position: new Vector3(x, 1, z),
  target,
});
try {
  const wall = obstacle(0, 4, 4, 1),
    nav = createBotNavigation(scene, 1);
  const from = new Vector3(0, 1, 0),
    goal = new Vector3(0, 1, 10);
  assert.equal(
    nav.clear(from, goal),
    false,
    'Direct route is blocked by real cover',
  );
  const path = nav.route(from, goal);
  assert.ok(path.length > 3, 'Finds a route around the wall');
  for (let i = 1; i < path.length; i++)
    assert.ok(
      nav.clear(path[i - 1], path[i]),
      'Every route segment has floor and body clearance',
    );
  assert.equal(
    nav.walkable(new Vector3(0, 1, 25)),
    false,
    'Avoids outer void/dock routes',
  );
  const brain = createTeamBotBrain(1, 2, 1, nav, (p) =>
    nav.visible(from.add(new Vector3(0, 0.8, 0)), p),
  );
  const hidden = actor(2, 0, 8),
    exposed = actor(3, 10, 8);
  let plan = brain.plan(from, 100, [actor(0, -4, -4), hidden, exposed], 10000);
  assert.equal(
    plan.target.slot,
    3,
    'Chooses a visible enemy over the closer enemy behind a wall',
  );
  exposed.position.set(0, 1, 9);
  plan = brain.plan(from, 100, [hidden, exposed], 11000);
  assert.equal(
    plan.target,
    null,
    'Never tracks or shoots enemies through cover',
  );
  assert.equal(plan.canFire, false);
  assert.ok(
    plan.goal.x > 5,
    'Investigates the last seen position rather than following the hidden enemy',
  );
  plan = brain.plan(from, 100, [hidden, exposed], 16000);
  assert.equal(plan.target, null);
  assert.ok(
    plan.goal.x < 0,
    'Returns to its own flank route after losing contact',
  );
  wall.dispose();
  const open = createBotNavigation(scene, 1),
    enemy = actor(2, 0, 12);
  const friendlyBrain = createTeamBotBrain(1, 2, 1, open, () => true);
  assert.equal(
    friendlyBrain.plan(from, 100, [actor(0, 0, 6), enemy], 20000).canFire,
    false,
    'Does not shoot through a teammate',
  );
  assert.equal(
    friendlyBrain.plan(from, 100, [actor(0, -4, 6), enemy], 21000).canFire,
    true,
    'Resumes firing when the teammate clears the shot',
  );
  const pressureBrain = createTeamBotBrain(1, 2, 1, open, () => true);
  const alternative = actor(3, 4, 12);
  assert.equal(
    pressureBrain.plan(
      from,
      100,
      [actor(0, -4, 4, 2), enemy, alternative],
      22000,
    ).target.slot,
    3,
    'Splits pressure when a teammate already has the closest enemy covered',
  );
  alternative.alive = false;
  assert.equal(
    pressureBrain.plan(from, 100, [enemy, alternative], 22100).target.slot,
    2,
    'Immediately drops an eliminated target',
  );
  const phases = [1, 2, 3, 4].map(
    (slot) =>
      createTeamBotBrain(slot, 5, 1, open, () => true).plan(
        from,
        100,
        [actor(5, 0, 12)],
        23000,
      ).movement.x,
  );
  assert.ok(
    new Set(phases.map((x) => x.toFixed(3))).size > 1,
    'Combat strafe timing differs between bots',
  );
  const left = createTeamBotBrain(1, 3, 1, open, () => false),
    right = createTeamBotBrain(2, 3, 1, open, () => false);
  const leftPlan = left.plan(from, 100, [actor(2, 0.8, 0)], 30000),
    rightPlan = right.plan(
      new Vector3(0.8, 1, 0),
      100,
      [actor(1, 0, 0)],
      30000,
    );
  assert.ok(
    leftPlan.goal.x < 0 && rightPlan.goal.x > 0,
    'Flankers take opposite lanes',
  );
  assert.ok(
    Vector3.Dot(leftPlan.movement, rightPlan.movement) < 0.5,
    'Crowded teammates separate rather than following in formation',
  );
  const cover = obstacle(4, 4),
    coverNav = createBotNavigation(scene, 1);
  let coverEye = from.add(new Vector3(0, 0.8, 0));
  const hurtBrain = createTeamBotBrain(1, 2, 1, coverNav, (p) =>
    coverNav.visible(coverEye, p),
  );
  plan = hurtBrain.plan(from, 30, [enemy], 40000);
  assert.equal(plan.canFire, false, 'Wounded bot briefly withdraws to cover');
  assert.ok(
    plan.goal &&
      !coverNav.visible(
        plan.goal.add(new Vector3(0, 0.8, 0)),
        enemy.position.add(new Vector3(0, 0.8, 0)),
      ),
    'Retreat destination actually blocks the enemy sightline',
  );
  assert.ok(
    coverNav.route(from, plan.goal).length,
    'Cover can be reached without crossing a wall',
  );
  const retreatGoal = plan.goal.clone();
  coverEye = retreatGoal.add(new Vector3(0, 0.8, 0));
  const hiddenRetreat = hurtBrain.plan(retreatGoal, 30, [enemy], 40500);
  assert.equal(hiddenRetreat.target, null, 'Cover breaks actual visibility');
  assert.ok(
    hiddenRetreat.goal.equals(retreatGoal),
    'Breaking sight does not cancel the short cover hold',
  );
  coverEye = from.add(new Vector3(0, 0.8, 0));
  const recovered = hurtBrain.plan(from, 30, [enemy], 41400);
  assert.equal(
    recovered.canFire,
    true,
    'Re-peeks instead of hiding indefinitely',
  );
  cover.dispose();
  floor.dispose();
  for (let size = 2; size <= 5; size++) {
    for (const map of mapsForTeams(size)) {
      const arena = createArena(scene, map),
        navigation = createBotNavigation(scene, mapScale(map)),
        bots = [];
      for (let slot = 1; slot < size * 2; slot++) {
        const bot = createBot(scene, camera, {
          onHealthChange() {},
          onEliminated() {},
          isPlayerAlive: () => true,
          onPlayerHit() {},
        });
        const p = teamSpawn(slot, size, map);
        bot.setSpawn(new Vector3(p.x, 1, p.z));
        bot.setAutoRespawn(false);
        bot.configureTeam(slot, size, mapScale(map), navigation);
        bot.reset();
        // Deterministic motion exercises the same steering while checking every step against arena collision bounds.
        bot.root.moveWithCollisions = (displacement) => {
          const destination = bot.root.position.add(displacement);
          destination.y = 1;
          assert.ok(
            navigation.clear(bot.root.position, destination),
            `${size}v${size} ${map}: movement stays on safe ground`,
          );
          bot.root.position.copyFrom(destination);
        };
        bots.push({ bot, slot, target: -1 });
      }
      const origins = bots.map((u) => u.bot.root.position.clone());
      for (let frame = 0; frame < 80; frame++) {
        const actors = [
          actor(0, teamSpawn(0, size, map).x, teamSpawn(0, size, map).z),
          ...bots.map((u) => ({
            slot: u.slot,
            alive: true,
            position: u.bot.root.position,
            target: u.target,
          })),
        ];
        for (const u of bots)
          u.target = u.bot.planTeamStep(actors, 50000 + frame * 100);
        for (const u of bots) u.bot.update(0.1, 50000 + frame * 100);
      }
      const moved = bots.filter(
        (u, i) => Vector3.Distance(u.bot.root.position, origins[i]) > 1,
      );
      assert.ok(
        moved.length >= size,
        `${size}v${size} ${map}: bots make independent progress`,
      );
      const enemies = bots.filter((u) => u.slot >= size);
      assert.ok(
        Math.max(...enemies.map((u) => u.bot.root.position.x)) -
          Math.min(...enemies.map((u) => u.bot.root.position.x)) >
          3,
        `${size}v${size} ${map}: enemy team spreads across lanes ${JSON.stringify(enemies.map((u) => [u.slot, u.bot.root.position.x, u.bot.root.position.z]))}`,
      );
      bots.forEach((u) => u.bot.dispose());
      arena.dispose();
    }
  }
  console.log(
    'PASS: cover-aware targets, safe obstacle routes, last-seen memory expiry, teammate spacing/fire lanes, real retreat/re-peek and independent movement in 2v2 through 5v5 on every team map.',
  );
} finally {
  scene.dispose();
  engine.dispose();
}
