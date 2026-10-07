import { Color3, MeshBuilder, Ray, StandardMaterial, Vector3, type Scene } from '@babylonjs/core';
import { WEAPON_DEFINITIONS, type WeaponId } from './weaponDefinitions';

// Cosmetic world traces only. No damage callback or hit marker.
export function createOnlineTracers(scene: Scene) {
  const material = new StandardMaterial('online tracer glow', scene);
  material.emissiveColor = Color3.FromHexString('#a4efff'); material.disableLighting = true;
  const traces: { mesh: ReturnType<typeof MeshBuilder.CreateBox>; age: number }[] = [];
  return {
    fire(id: WeaponId, origin: Vector3, direction: Vector3) {
      if (!['assaultRifle','pistol','uzi','sniper'].includes(id)) return;
      const ray = new Ray(origin, direction, WEAPON_DEFINITIONS[id].range);
      const hit = scene.pickWithRay(ray, mesh => mesh.isEnabled() && mesh.isVisible && mesh.checkCollisions && !mesh.metadata?.owner && !mesh.name.includes('movement collider'));
      const end = hit?.pickedPoint ?? origin.add(direction.scale(ray.length));
      const length = Vector3.Distance(origin,end);
      if (length < .05) return;
      const mesh = MeshBuilder.CreateBox('online bullet tracer', { width:.018,height:.018,depth:Math.max(.01,length-.04) }, scene);
      mesh.material = material; mesh.isPickable = false;
      mesh.position.copyFrom(Vector3.Center(origin,end)); mesh.lookAt(end);
      traces.push({ mesh, age:0 });
      if (traces.length>64) traces.shift()!.mesh.dispose();
    },
    update(dt: number) {
      for (const trace of [...traces]) {
        trace.age += dt; trace.mesh.visibility = Math.max(0,1-trace.age/.09);
        if (trace.age>=.09) { trace.mesh.dispose(); traces.splice(traces.indexOf(trace),1); }
      }
    },
    clear() { traces.splice(0).forEach(t=>t.mesh.dispose()); },
    dispose() { this.clear(); material.dispose(); },
  };
}
