import { Color3, MeshBuilder, StandardMaterial, type AbstractMesh, type Mesh, type Scene, type Vector3 } from '@babylonjs/core';
import { getWeaponDamage, type WeaponId } from './weaponDefinitions';

// Only explicitly registered arena cover can be melted. Ten laser damage
// ticks (~1 second) break a fresh panel; other weapons do not damage it.
export const COVER_HEALTH = 60;
export function createDestructibleCover(scene: Scene, meshes: Mesh[]) {
  const panels = new Map(meshes.map(mesh => {
    const original = mesh.material as StandardMaterial;
    const surface = original.clone(`${mesh.name} heat surface`);
    mesh.material = surface;
    const panel = { health: Number(COVER_HEALTH), surface, color: original.diffuseColor.clone(), glow: original.emissiveColor.clone() };
    return [mesh, panel] as const;
  }));
  const pulseMaterial = new StandardMaterial('melted cover flash', scene);
  pulseMaterial.emissiveColor = Color3.FromHexString('#b1ffd4');
  pulseMaterial.disableLighting = true;
  const pulses: { mesh: Mesh; age: number }[] = [];
  function clearPulses() { pulses.forEach(pulse => pulse.mesh.dispose()); pulses.length = 0; }
  return {
    hit(mesh: AbstractMesh, weapon: WeaponId, point: Vector3) {
      const panel = panels.get(mesh as Mesh);
      if (!panel || weapon !== 'laserCannon' || panel.health <= 0) return false;
      panel.health = Math.max(0, panel.health - getWeaponDamage(weapon, 'body'));
      const heat = 1 - panel.health / COVER_HEALTH;
      panel.surface.diffuseColor = Color3.Lerp(panel.color, new Color3(.12, .16, .18), heat);
      panel.surface.emissiveColor = Color3.Lerp(panel.glow, new Color3(.9, .35, .08), heat);
      if (panel.health === 0) {
        // All three flags matter: physics, bot sight rays, and weapon rays
        // must agree that the destroyed cover no longer exists.
        mesh.checkCollisions = false; mesh.isPickable = false; mesh.setEnabled(false);
        const pulse = MeshBuilder.CreateSphere('cover break pulse', { diameter: .5, segments: 8 }, scene);
        pulse.position.copyFrom(point); pulse.material = pulseMaterial;
        pulse.isPickable = false; pulse.checkCollisions = false;
        pulses.push({ mesh: pulse, age: 0 });
      }
      return true;
    },
    update(seconds: number) {
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pulse = pulses[i]; pulse.age += seconds;
        if (pulse.age >= .35) { pulse.mesh.dispose(); pulses.splice(i, 1); continue; }
        pulse.mesh.scaling.setAll(1 + pulse.age * 8);
        pulse.mesh.visibility = 1 - pulse.age / .35;
      }
    },
    reset() {
      clearPulses();
      for (const [mesh, panel] of panels) {
        panel.health = COVER_HEALTH;
        panel.surface.diffuseColor.copyFrom(panel.color);
        panel.surface.emissiveColor.copyFrom(panel.glow);
        mesh.checkCollisions = true; mesh.isPickable = true; mesh.setEnabled(true);
      }
    },
    dispose() { clearPulses(); pulseMaterial.dispose(); panels.forEach(panel => panel.surface.dispose()); },
  };
}
