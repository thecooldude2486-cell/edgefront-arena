import '../server/gameImports.mjs';
import assert from 'node:assert/strict';
import {
  NullEngine,
  Scene,
  UniversalCamera,
  Vector3,
  Color3,
  Matrix,
  Viewport,
} from '@babylonjs/core';
const { createCharacterModel } =
  await import('../game/createCharacterModel.ts');
const { createCharacterHands } =
  await import('../game/createCharacterHands.ts');
const { createRemotePlayer } = await import('../game/createRemotePlayer.ts');
const { createCharacterPreview } =
  await import('../game/createCharacterPreview.ts');
const { characterItem, DEFAULT_CHARACTER, CHARACTER_ITEMS } =
  await import('../game/storeCatalog.ts');
const engine = new NullEngine(),
  scene = new Scene(engine),
  camera = new UniversalCamera('first person', Vector3.Zero(), scene);
const model = createCharacterModel(scene),
  hands = createCharacterHands(scene, camera),
  remote = createRemotePlayer(scene);
const look = { suit: 'prism', visor: 'violet', gear: 'halo' };
model.apply(look);
hands.apply(look);
remote.setCharacterAppearance(look);
remote.show({ x: 0, y: 0.9, z: 10, yaw: Math.PI, pitch: 0.2 });
assert.equal(
  scene.getMaterialByName('character glove suit').diffuseColor.toHexString(),
  Color3.FromHexString(characterItem('prism').color).toHexString(),
);
for (const root of [
  model.root,
  scene.getTransformNodeByName('online remote player'),
]) {
  assert.equal(
    root
      .getChildMeshes()
      .find((mesh) => mesh.name === 'online body')
      .material.diffuseColor.toHexString(),
    Color3.FromHexString(characterItem('prism').color).toHexString(),
  );
  assert.equal(
    root
      .getChildMeshes()
      .find((mesh) => mesh.name === 'character visor face')
      .material.diffuseColor.toHexString(),
    Color3.FromHexString(characterItem('violet').color).toHexString(),
  );
  assert.equal(
    root
      .getChildMeshes()
      .find((mesh) => mesh.name === 'character orbital headpiece')
      .isEnabled(),
    true,
  );
  assert.equal(
    root
      .getChildMeshes()
      .find((mesh) => mesh.name === 'character signal antenna')
      .isEnabled(),
    false,
  );
}
assert.deepEqual(
  remote.projectileTargets.map((mesh) => mesh.name),
  ['online body', 'online head'],
  'Armour leaves combat hitboxes unchanged',
);
assert.ok(
  model.root
    .getChildMeshes()
    .every((mesh) => !mesh.isPickable && !mesh.checkCollisions),
  'Cosmetic gear does not block attacks',
);
model.dispose();
hands.dispose();
remote.dispose();
assert.equal(scene.meshes.length, 0);
assert.equal(
  scene.materials.filter((material) => material.name.startsWith('character '))
    .length,
  0,
);
scene.dispose();
engine.dispose();
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
};
const canvas = new EventTarget();
canvas.setPointerCapture = () => {};
let previewEngine,
  frame,
  appearance = DEFAULT_CHARACTER;
const dispose = createCharacterPreview(
  canvas,
  () => appearance,
  () => {
    previewEngine = new NullEngine({ renderWidth: 600, renderHeight: 650 });
    previewEngine.runRenderLoop = (callback) => {
      frame = callback;
    };
    return previewEngine;
  },
);
const previewScene = previewEngine.scenes[0];
for (const gear of ['none', 'signal', 'crest', 'halo']) {
  appearance = { suit: 'solar', visor: 'ice', gear };
  frame();
  for (const mesh of previewScene.meshes.filter((mesh) => mesh.isEnabled()))
    for (const point of mesh.getBoundingInfo().boundingBox.vectorsWorld) {
      const pixel = Vector3.Project(
        point,
        Matrix.Identity(),
        previewScene.getTransformMatrix(),
        new Viewport(0, 0, 600, 650),
      );
      assert.ok(
        pixel.z > 0 &&
          pixel.z < 1 &&
          pixel.x > 0 &&
          pixel.x < 600 &&
          pixel.y > 0 &&
          pixel.y < 650,
        'Whole character/accessory fits the preview',
      );
    }
}
assert.equal(CHARACTER_ITEMS.length, 15);
dispose();
assert.equal(previewEngine.scenes.length, 0);
console.log(
  'PASS: actual preview frames all accessories, character/remote/glove materials agree, hitboxes unchanged, cosmetic geometry cannot obstruct damage, complete resource disposal.',
);
