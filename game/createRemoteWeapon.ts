import { Color3, MeshBuilder, PointLight, Ray, StandardMaterial, TransformNode, Vector3, type Scene } from '@babylonjs/core';
import { createShotSound, populateWeaponModels } from './createWeapon';
import { populateSniperModel } from './createSniperModel';
import { populateUziModel } from './createUziModel';
import { populateLaserModel } from './createLaserModel';
import { populateLauncherModel } from './createRockets';
import { populateGrenadeModel } from './createGrenade';
import { populateMolotovModel } from './createMolotov';
import { populateSwordModel } from './createSwordModel';
import { populateOrbiterModel } from './createOrbiterModel';
import type { WeaponId } from './weaponDefinitions';
import { WEAPON_DEFINITIONS } from './weaponDefinitions';

import { createWeaponCosmetics } from './createWeaponCosmetics';
import { EMPTY_COSMETICS, type Cosmetics } from './progression';

// Display and sound only: no ammo, attacks, damage or hit validation.
export function createRemoteWeapon(scene: Scene, parent: TransformNode) {
  const mount = new TransformNode('remote weapon mount', scene);
  mount.parent = parent; mount.position.set(.38, .05, .25); mount.scaling.setAll(.7);
  let cosmetics: Cosmetics = { ...EMPTY_COSMETICS };
  const finishes = new Map<WeaponId, ReturnType<typeof createWeaponCosmetics>>();
  const models = new Map<WeaponId, TransformNode>();
  const audio = createShotSound();
  const unlockAudio = () => audio.unlock();
  globalThis.window?.addEventListener('pointerdown', unlockAudio);
  const glow = new StandardMaterial('remote muzzle glow', scene);
  glow.diffuseColor = glow.emissiveColor = Color3.FromHexString('#fff2a8');
  const flash = MeshBuilder.CreateSphere('remote muzzle flash', { diameter: .18, segments: 6 }, scene);
  flash.material = glow; flash.isPickable = false; flash.setEnabled(false);
  const light = new PointLight('remote muzzle light', Vector3.Zero(), scene);
  light.diffuse = Color3.FromHexString('#ffd987'); light.range = 5; light.intensity = 0;
  const beamGlow = new StandardMaterial('remote helion glow', scene);
  beamGlow.diffuseColor = beamGlow.emissiveColor = Color3.FromHexString('#a5ffd2');
  const beam = MeshBuilder.CreateBox('remote helion beam', { width: .035, height: .035, depth: 1 }, scene);
  beam.material = beamGlow; beam.isPickable = false; beam.setEnabled(false);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let laserOn = false;
  let equipped: WeaponId | null = null;
  let reloadAge = 0, reloadDuration = 0;
  let swingAge = 1, throwAge = 1;
  function resetPose() {
    reloadDuration=0; swingAge=1; throwAge=1;
    for (const node of models.values()) { node.rotation.setAll(0); node.position.setAll(0); }
  }
  function stopEffects() {
    if (timer) clearTimeout(timer);
    timer = null; laserOn = false; flash.setEnabled(false); light.intensity = 0;
    beam.setEnabled(false); audio.setLaser(false);
  }
  function equip(id: WeaponId) {
    if (equipped !== id) { stopEffects(); resetPose(); equipped=id; }
    ensure(id); for (const [key, node] of models) node.setEnabled(key === id);
  }
  function root(id: WeaponId) {
    const node = new TransformNode('remote held ' + id, scene);
    node.parent = mount; node.setEnabled(false); models.set(id, node); return node;
  }
  function ensure(id: WeaponId) {
    if (models.has(id)) return;
    if (id === 'assaultRifle' || id === 'pistol') populateWeaponModels(scene, root('assaultRifle'), root('pistol'));
    else {
      const populate = { sniper: populateSniperModel, uzi: populateUziModel,
        laserCannon: populateLaserModel, rocketLauncher: populateLauncherModel,
        grenade: populateGrenadeModel, molotov: populateMolotovModel,
        sword: populateSwordModel, orbiter: populateOrbiterModel }[id];
      populate(scene, root(id));
    }
    for (const [key, node] of models) {
      if (!finishes.has(key)) finishes.set(key, createWeaponCosmetics(node));
      finishes.get(key)!.apply(cosmetics);
    }
    for (const node of models.values()) for (const mesh of node.getChildMeshes()) {
      mesh.isPickable = false; mesh.checkCollisions = false;
    }
  }
  return {
    setCosmetics(value: Cosmetics) { cosmetics = { ...value }; finishes.forEach(finish => finish.apply(cosmetics)); },
    equip(id: WeaponId) { equip(id); },
    reload(id: WeaponId, active: boolean) {
      if (!active) { if (equipped===id) resetPose(); return; }
      equip(id); stopEffects(); resetPose();
      reloadAge=0; reloadDuration=WEAPON_DEFINITIONS[id].reloadMs/1000;
      if (reloadDuration>0) audio.playReload();
    },
    fire(id: WeaponId) {
      const stats = WEAPON_DEFINITIONS[id];
      equip(id);
      resetPose();
      if (stats.fireMode === 'Melee') { swingAge=0; audio.playSwing(); return; }
      if (stats.fireMode === 'Utility') { throwAge=0; audio.playSwing(); return; }
      const model = models.get(id)!;
      if (timer) clearTimeout(timer);
      if (id === 'laserCannon') {
        laserOn = true; audio.setLaser(true);
        timer = setTimeout(stopEffects, stats.fireDelayMs + 100);
        return;
      }
      laserOn = false; beam.setEnabled(false); audio.setLaser(false);
      const muzzles: Partial<Record<WeaponId, number[]>> = { assaultRifle: [0,.02,1.14], pistol: [0,.045,.67], uzi: [0,.015,.63], sniper: [0,.015,1.56], rocketLauncher: [0,0,.67] };
      const muzzle = muzzles[id];
      if (!muzzle) return;
      flash.parent = light.parent = model;
      flash.position.set(muzzle[0], muzzle[1], muzzle[2]); light.position.copyFrom(flash.position);
      flash.scaling.set(id === 'pistol' ? .55 : .75, id === 'pistol' ? .55 : .75, id === 'pistol' ? 1.25 : 1.7);
      flash.setEnabled(true); light.intensity = 2.8;
      model.position.z = -.07; audio.playShot();
      timer = setTimeout(stopEffects, 45);
    },
    update(seconds: number) {
      finishes.forEach(finish => finish.update(seconds));
      for (const model of models.values()) model.position.z *= Math.exp(-18 * seconds);
      const model=equipped ? models.get(equipped) : null;
      if (model) {
        if (reloadDuration>0) {
          reloadAge+=seconds;
          const amount=Math.sin(Math.PI*Math.min(1,reloadAge/reloadDuration));
          model.rotation.x=-.5*amount; model.rotation.z=.35*amount; model.position.y=-.2*amount;
          if (reloadAge>=reloadDuration) resetPose();
        } else if (swingAge<.42) {
          swingAge=Math.min(.42,swingAge+seconds);
          const amount=Math.sin(Math.PI*swingAge/.42);
          model.rotation.z=-1.5*amount; model.rotation.y=-.8*amount;
        } else if (throwAge<.4) {
          throwAge=Math.min(.4,throwAge+seconds);
          model.rotation.x=-1.2*Math.sin(Math.PI*throwAge/.4);
        }
      }
      if (!laserOn) return;
      mount.computeWorldMatrix(true);
      const start = Vector3.TransformCoordinates(new Vector3(0,0,1.06), mount.getWorldMatrix());
      const direction = Vector3.TransformNormal(Vector3.Forward(), mount.getWorldMatrix()).normalize();
      const ray = new Ray(start, direction, WEAPON_DEFINITIONS.laserCannon.range);
      const hit = scene.pickWithRay(ray, mesh => mesh.isPickable && mesh.isEnabled() && mesh.isVisible);
      const end = hit?.pickedPoint ?? start.add(direction.scale(ray.length));
      beam.position.copyFrom(Vector3.Center(start, end)); beam.scaling.z = Vector3.Distance(start, end);
      beam.lookAt(end); beam.setEnabled(true);
    },
    aim(pitch: number) { mount.rotation.x = pitch; },
    clear() { stopEffects(); resetPose(); equipped=null; for (const node of models.values()) node.setEnabled(false); },
    dispose() {
      finishes.forEach(finish => finish.dispose());
      stopEffects(); globalThis.window?.removeEventListener('pointerdown', unlockAudio); audio.dispose();
      flash.dispose(); light.dispose(); beam.dispose(); glow.dispose(); beamGlow.dispose();
      const materials = new Set(mount.getChildMeshes().map(mesh => mesh.material));
      mount.dispose(); materials.forEach(material => material?.dispose());
    },
  };
}
