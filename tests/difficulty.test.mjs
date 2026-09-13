import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === '@babylonjs/core/Maths/math.vector') return nextResolve(`${specifier}.js`, context);
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });
const { NullEngine, Scene, UniversalCamera, Vector3, MeshBuilder } = await import('@babylonjs/core');
const { createBot } = await import('../game/createBot.ts');
const { DIFFICULTIES } = await import('../game/difficulty.ts');
globalThis.window = new EventTarget();
window.setTimeout = () => 0;
const random = Math.random;
Math.random = () => .5;
try {
  for (const [id, settings] of Object.entries(DIFFICULTIES)) {
    const engine = new NullEngine(); const scene = new Scene(engine);
    const camera = new UniversalCamera('test', new Vector3(0, 1.7, 0), scene);
    let hits = 0, visible = true;
    const bot = createBot(scene, camera, { onEliminated() {}, onHealthChange() {}, isPlayerAlive: () => visible,
      onPlayerHit(weapon, zone) { assert.equal(weapon, 'assaultRifle'); assert.equal(zone, 'head'); hits++; },
    }, () => id);
    bot.update(0, 10000);
    bot.update(0, 10000 + settings.reactionMs - 1); assert.equal(hits, 0);
    bot.update(0, 10000 + settings.reactionMs); assert.equal(hits, 1);
    bot.update(0, 10000 + settings.reactionMs + settings.shotMs - 1); assert.equal(hits, 1);
    visible = false; bot.update(0, 20000); visible = true; bot.update(0, 21000); assert.equal(hits, 1);
    assert.equal(bot.health, 100);
    for (let i = 0; i < 8; i++) bot.takeDamage('assaultRifle', 'body');
    assert.equal(bot.health, 4); assert.equal(bot.alive, true);
    bot.takeDamage('assaultRifle', 'body'); assert.equal(bot.alive, false);
    bot.reset(); assert.equal(bot.health, 100);
    // Outside normal detection range: only Hard+ should return fire after a hit.
    camera.position.set(0, 1.7, -17);
    hits = 0;
    bot.update(0, 30000); assert.equal(hits, 0);
    bot.takeDamage('assaultRifle', 'body');
    bot.update(0, 31000);
    bot.update(0, 31000 + settings.reactionMs - 1); assert.equal(hits, 0);
    bot.takeDamage('assaultRifle', 'body'); // Repeated hits must not restart reactions.
    bot.update(0, 31000 + settings.reactionMs);
    const retaliates = ['hard', 'extreme', 'nightmare'].includes(id);
    assert.equal(hits, retaliates ? 1 : 0, `${id}: correct retaliation gate`);
    if (retaliates) assert.ok(Math.abs(bot.root.rotation.y) < .001, 'faces attacker, not strafe direction');
    const wall = MeshBuilder.CreateBox('cover', {width: 10, height: 10, depth: 1}, scene);
    wall.position.set(0, 2, 0); wall.checkCollisions = true; wall.computeWorldMatrix(true);
    const previousHits = hits;
    bot.update(0, 40000); bot.update(0, 45000);
    assert.equal(hits, previousHits, 'cover prevents retaliation shots');
    wall.dispose();
    bot.reset(); bot.update(0, 50000); bot.update(0, 55000);
    assert.equal(hits, previousHits, 'respawn clears attacker awareness');
    bot.dispose(); scene.dispose(); engine.dispose();
  }
  console.log('PASS: all five difficulties, Hard+ retaliation, repeated hits, cover, facing, damage and respawn.');
} finally { Math.random = random; }
