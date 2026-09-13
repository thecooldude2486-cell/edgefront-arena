import { Engine, Scene, Color3, Color4, UniversalCamera, Vector3, TransformNode, HemisphericLight, Mesh } from '@babylonjs/core';
import { populateWeaponModels } from './createWeapon';
import { populateSniperModel } from './createSniperModel';
import { populateLauncherModel } from './createRockets';
import { populateSwordModel } from './createSwordModel';
import { populateOrbiterModel } from './createOrbiterModel';
import type { WeaponId } from './weaponDefinitions';

// Display-only scene. No input listeners, ammo, or combat logic are created here.
export function createShopPreview(canvas: HTMLCanvasElement, weaponId: WeaponId) {
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0);
  const camera = new UniversalCamera('shop camera', new Vector3(2.6, 0.8, 1.6), scene);
  camera.setTarget(new Vector3(0, -0.04, 0.18));
  camera.fov = 0.64;
  new HemisphericLight('shop light', new Vector3(0, 1, 0), scene).intensity = 0.8;
  const rifle = new TransformNode('shop rifle', scene);
  const pistol = new TransformNode('shop pistol', scene);
  const sniper = new TransformNode('shop sniper', scene);
  const launcher = new TransformNode('shop launcher', scene);
  populateLauncherModel(scene, launcher); launcher.setEnabled(weaponId === 'rocketLauncher');
  const sword = new TransformNode('shop sword', scene);
  populateSwordModel(scene, sword);
  sword.setEnabled(weaponId === 'sword');
  const orbiter = new TransformNode('shop orbiter', scene);
  populateOrbiterModel(scene, orbiter);
  orbiter.setEnabled(weaponId === 'orbiter');
  if (weaponId === 'orbiter' || weaponId === 'sword') { camera.position.set(1.1, .5, -3.4); camera.setTarget(new Vector3(0, .16, 0)); }
  populateWeaponModels(scene, rifle, pistol);
  populateSniperModel(scene, sniper);
  rifle.setEnabled(weaponId === 'assaultRifle');
  pistol.setEnabled(weaponId === 'pistol');
  sniper.setEnabled(weaponId === 'sniper');
  if (weaponId === 'sniper') camera.position.scaleInPlace(1.3);
  if (weaponId === 'pistol') camera.position.scaleInPlace(0.64);
  // Show each weapon's actual Edgefront materials, including AR and pistol.
  for (const mesh of scene.meshes) {
    if (mesh instanceof Mesh) {
      mesh.renderOutline = true;
      mesh.outlineColor = Color3.FromHexString('#4de7ff');
      mesh.outlineWidth = 0.006;
    }
  }
  const resize = new ResizeObserver(() => engine.resize());
  resize.observe(canvas);
  engine.runRenderLoop(() => scene.render());
  return () => { resize.disconnect(); scene.dispose(); engine.dispose(); };
}
