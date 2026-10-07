import { TransformNode, type Scene } from '@babylonjs/core';
import { smoothPose, type PlayerPose } from './onlineMovement';
import { createRemoteWeapon } from './createRemoteWeapon';
import type { WeaponId } from './weaponDefinitions';
import { createCharacterModel } from './createCharacterModel';
import type { CharacterAppearance } from './storeCatalog';

// Display opponent; all hit validation and health belong to the server.
export function createRemotePlayer(scene: Scene) {
  const root = new TransformNode('online remote player', scene);
  const weapon = createRemoteWeapon(scene, root);
  const character=createCharacterModel(scene,root);
  const {body,head}=character;
  let target: PlayerPose = { x: 0, y: .9, z: 17, yaw: Math.PI, pitch: 0 };
  let current = { ...target };
  root.setEnabled(false);
  function draw() { root.position.set(current.x, current.y, current.z); root.rotation.y = current.yaw; head.rotation.x = current.pitch; weapon.aim(current.pitch); }
  return {
    setCharacterAppearance: (value: CharacterAppearance) => character.apply(value),
    get projectileTargets() { return [body, head]; },
    show(pose: PlayerPose) { current = { ...pose }; target = { ...pose }; draw(); root.setEnabled(true); },
    receive(pose: PlayerPose) { target = { ...pose }; },
    update(seconds: number) { current = smoothPose(current, target, seconds); draw(); weapon.update(seconds); },
    setCosmetics: (value: import('./progression').Cosmetics) => weapon.setCosmetics(value),
    equip: (id: WeaponId) => weapon.equip(id),
    fire: (id: WeaponId) => weapon.fire(id),
    reload: (id: WeaponId, active: boolean) => weapon.reload(id,active),
    hide() { root.setEnabled(false); weapon.clear(); },
    dispose() { weapon.dispose(); character.dispose(); },
  };
}
