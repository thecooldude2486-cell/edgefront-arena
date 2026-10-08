import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@babylonjs/core/') && !specifier.endsWith('.js'))
      return next(specifier + '.js', context);
    if (
      context.parentURL?.includes('/game/') &&
      specifier.startsWith('.') &&
      !/\.[a-z]+$/i.test(specifier)
    )
      return next(specifier + '.ts', context);
    return next(specifier, context);
  },
});
const { NullEngine, Scene, MeshBuilder, Ray, Vector3 } =
  await import('@babylonjs/core');
const { createArena } = await import('../game/createArena.ts');
const { ARENA_MAPS, MODE_MAPS, isArenaMapId } = await import('../game/maps.ts');
const { mapScale, teamSpawn } = await import('../game/teams.ts');
const engine = new NullEngine(),
  scene = new Scene(engine),
  sentinel = MeshBuilder.CreateBox('unrelated weapon', { size: 0.1 }, scene);
sentinel.position.y = 100;
sentinel.material = scene.defaultMaterial;
const baseline = {
  meshes: scene.meshes.length,
  lights: scene.lights.length,
  materials: scene.materials.length,
};
const signatures = [];
try {
  for (const id of Object.keys(ARENA_MAPS)) {
    assert.ok(isArenaMapId(id));
    const arena = createArena(scene, id);
    assert.equal(arena.mapId, id);
    scene.meshes.forEach((mesh) => mesh.computeWorldMatrix(true));
    assert.ok(arena.meshes.some((mesh) => mesh.name === 'arena foundation'));
    assert.ok(arena.meshes.some((mesh) => mesh.name === 'north wall'));
    const covers = arena.meshes.filter((mesh) =>
      arena.cover.hit(mesh, 'laserCannon', mesh.position),
    );
    assert.ok(covers.length >= 4, 'Every map has laser-damageable cover');
    signatures.push(
      arena.meshes
        .filter((mesh) => mesh.checkCollisions)
        .map((mesh) => [
          ...mesh.position.asArray(),
          ...mesh.getBoundingInfo().boundingBox.extendSizeWorld.asArray(),
          ...mesh.rotation.asArray(),
        ])
        .flat()
        .join(','),
    );
    const size = Number(
      Object.entries(MODE_MAPS).find(([, maps]) => maps.includes(id))[0],
    );
    for (const slot of Array.from({ length: size * 2 }, (_, slot) => slot)) {
      const { x, z } = teamSpawn(slot, size, id);
      const floor = scene.pickWithRay(
        new Ray(new Vector3(x, 0.9, z), Vector3.Down(), 2),
        (mesh) => mesh.checkCollisions,
      );
      assert.ok(floor.hit, 'Both spawns have a solid floor');
      assert.ok(Math.abs(floor.pickedPoint.y) < 0.1);
      const headSpace = scene.pickWithRay(
        new Ray(new Vector3(x, 0.1, z), Vector3.Up(), 1.8),
        (mesh) => mesh.checkCollisions,
      );
      assert.equal(
        headSpace.hit,
        false,
        `All ${size}v${size} spawns fit a standing player on ${id}`,
      );
    }
    for (const [x, z] of ARENA_MAPS[id].patrol) {
      const hit = scene.pickWithRay(
        new Ray(
          new Vector3(x * mapScale(id), 1, z * mapScale(id)),
          Vector3.Down(),
          3,
        ),
        (mesh) => mesh.checkCollisions,
      );
      assert.ok(hit.hit, 'Patrol destinations have ground');
    }
    if (id === 'skyline')
      assert.ok(
        arena.meshes.some(
          (mesh) => mesh.name === 'skyline skybridge' && mesh.position.y > 4,
        ),
      );
    arena.dispose();
    assert.equal(sentinel.isDisposed(), false);
    assert.deepEqual(
      {
        meshes: scene.meshes.length,
        lights: scene.lights.length,
        materials: scene.materials.length,
      },
      baseline,
      'Switching maps fully releases arena resources',
    );
  }
  assert.equal(
    new Set(signatures).size,
    Object.keys(ARENA_MAPS).length,
    'Every map has different collision geometry',
  );
  assert.equal(isArenaMapId('unknown'), false);
  console.log(
    'PASS: 25 distinct maps, solid spawns, standing clearance, patrol ground, high bridge, destructible cover, collision differences and safe map replacement/disposal.',
  );
} finally {
  scene.dispose();
  engine.dispose();
}
