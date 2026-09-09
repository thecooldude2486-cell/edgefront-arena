import { Engine, Scene, Color3, Color4, UniversalCamera, Vector3, TransformNode, HemisphericLight, StandardMaterial, Mesh } from '@babylonjs/core';
import { populateWeaponModels } from './createWeapon';
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
  populateWeaponModels(scene, rifle, pistol);
  rifle.setEnabled(weaponId === 'assaultRifle');
  pistol.setEnabled(weaponId === 'pistol');
  if (weaponId === 'pistol') camera.position.scaleInPlace(0.64);
  const shade = new StandardMaterial('shop graphite shade', scene);
  shade.diffuseColor = Color3.FromHexString('#122633');
  shade.emissiveColor = Color3.FromHexString('#08131c');
  shade.specularColor = Color3.FromHexString('#315866');
  for (const mesh of scene.meshes) {
    mesh.material = shade;
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
