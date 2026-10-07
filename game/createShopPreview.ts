import { Engine, Scene, Color3, Color4, UniversalCamera, Vector3, TransformNode, HemisphericLight, Mesh } from '@babylonjs/core';
import { populateWeaponModels } from './createWeapon';
import { populateSniperModel } from './createSniperModel';
import { populateLauncherModel } from './createRockets';
import { populateUziModel } from './createUziModel';
import { populateMolotovModel } from './createMolotov';
import { populateGrenadeModel } from './createGrenade';
import { populateSwordModel } from './createSwordModel';
import { populateOrbiterModel } from './createOrbiterModel';
import { populateLaserModel } from './createLaserModel';
import type { WeaponId } from './weaponDefinitions';

import { createWeaponCosmetics } from './createWeaponCosmetics';
import type { Cosmetics } from './progression';

// Display-only scene with inspection controls; no ammo or combat logic.
export function createShopPreview(canvas: HTMLCanvasElement, weaponId: WeaponId, getCosmetics?: () => Cosmetics, getCharmFocus: () => boolean = () => false, makeEngine: (canvas: HTMLCanvasElement) => Engine = value => new Engine(value,true)) {
  const engine = makeEngine(canvas);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0);
  const camera = new UniversalCamera('shop camera', new Vector3(-1.9, 0.55, -1.15), scene);
  camera.setTarget(new Vector3(0, -0.04, 0.18));
  camera.fov = 0.64;
  camera.minZ = 0.01;camera.maxZ=100;
  new HemisphericLight('shop light', new Vector3(0, 1, 0), scene).intensity = 0.8;
  const rifle = new TransformNode('shop rifle', scene);
  const laser = new TransformNode('shop laser', scene);
  populateLaserModel(scene, laser); laser.setEnabled(weaponId === 'laserCannon');
  const uzi = new TransformNode('shop Uzi', scene);
  populateUziModel(scene, uzi); uzi.setEnabled(weaponId === 'uzi');
  if (weaponId === 'uzi') { camera.position.set(-1.1, .5, -1.1); camera.setTarget(new Vector3(0, -.1, .15)); }
  const molotov = new TransformNode('shop Molotov', scene);
  populateMolotovModel(scene, molotov); molotov.setEnabled(weaponId === 'molotov');
  const grenade = new TransformNode('shop grenade', scene);
  populateGrenadeModel(scene, grenade); grenade.setEnabled(weaponId === 'grenade');
  if (weaponId === 'grenade' || weaponId === 'molotov') {
    camera.position.set(-.7, .35, -.9);
    camera.setTarget(new Vector3(0, .04, 0));
  }
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
  if (weaponId === 'orbiter' || weaponId === 'sword') { camera.position.set(-1.1, .5, -3.4); camera.setTarget(new Vector3(0, .16, 0)); }
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
  const previewRoot = { assaultRifle: rifle, pistol, sniper, laserCannon: laser, uzi, rocketLauncher: launcher, sword, orbiter, grenade, molotov }[weaponId];
  const finish = getCosmetics ? createWeaponCosmetics(previewRoot) : null;
  if (finish && getCosmetics) finish.apply(getCosmetics());
  const originalPosition=camera.position.clone(),originalTarget=camera.getTarget().clone();
  let target=originalTarget.clone(),radius=Vector3.Distance(camera.position,target),yaw=0,pitch=0,focused=false,focusedMiniatureId:number|null=null;
  const angles=()=>{const offset=camera.position.subtract(target);radius=offset.length();yaw=Math.atan2(offset.x,offset.z);pitch=Math.atan2(offset.y,Math.hypot(offset.x,offset.z));};
  const orbit=()=>{camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*radius,target.y+Math.sin(pitch)*radius,target.z+Math.cos(yaw)*Math.cos(pitch)*radius);camera.setTarget(target);};
  angles();
  let drag:{x:number;y:number}|null=null;
  const down=(event:PointerEvent)=>{if(event.button!==0)return;drag={x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);event.preventDefault();};
  const move=(event:PointerEvent)=>{if(!drag)return;yaw-=(event.clientX-drag.x)*.008;pitch=Math.max(-1.1,Math.min(1.1,pitch+(event.clientY-drag.y)*.006));drag={x:event.clientX,y:event.clientY};orbit();};
  const up=()=>{drag=null;};
  const zoom=(direction:number)=>{radius=Math.max(focused ? .22 : .7,Math.min(focused ? .8 : 6,radius*direction));orbit();};
  const wheel=(event:WheelEvent)=>{event.preventDefault();zoom(Math.exp(event.deltaY*.001));};
  const key=(event:KeyboardEvent)=>{if(event.key==='ArrowLeft')yaw-=.15;else if(event.key==='ArrowRight')yaw+=.15;else if(event.key==='ArrowUp')pitch=Math.min(1.1,pitch+.1);else if(event.key==='ArrowDown')pitch=Math.max(-1.1,pitch-.1);else if(event.key==='+' || event.key==='=')zoom(.9);else if(event.key==='-')zoom(1.1);else return;event.preventDefault();event.stopPropagation();orbit();};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('keydown',key);
  const resize = new ResizeObserver(() => engine.resize());
  resize.observe(canvas);
  engine.runRenderLoop(() => {
    if (finish && getCosmetics) { finish.apply(getCosmetics()); finish.update(engine.getDeltaTime() / 1000); }
    // Resolve the current miniature by hierarchy because every reward has its own shape.
    const miniature=previewRoot.getDescendants().find((node):node is TransformNode=>node instanceof TransformNode && node.name.startsWith('career miniature '));
    const wantsFocus=getCharmFocus() && !!miniature;
    if (wantsFocus!==focused || (wantsFocus && miniature?.uniqueId!==focusedMiniatureId)) {
      focusedMiniatureId=miniature?.uniqueId ?? null;
      focused=wantsFocus;
      if(focused && miniature){
        for(const mesh of miniature.getChildMeshes()) mesh.computeWorldMatrix(true);
        const bounds=miniature.getHierarchyBoundingVectors(true);
        target=bounds.min.add(bounds.max).scale(.5);
        const sphereRadius=Vector3.Distance(bounds.min,bounds.max)*.5;
        radius=Math.max(.35,sphereRadius/Math.sin(camera.fov/2)*1.2);
        pitch=.2;yaw=-2.05;orbit();
      }
      else {target=originalTarget.clone();camera.position.copyFrom(originalPosition);angles();orbit();}
    }
    scene.render();
  });
  return () => { canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('keydown',key); resize.disconnect(); finish?.dispose(); scene.dispose(); engine.dispose(); };
}
