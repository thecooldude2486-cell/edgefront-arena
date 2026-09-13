import { Color3, MeshBuilder, Ray, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
export const GRENADE = { fuse: 2, radius: 4, speed: 15, gravity: 20 };
export function populateGrenadeModel(scene: Scene, root: TransformNode) {
  const shell = new StandardMaterial('grenade graphite', scene);
  shell.diffuseColor = Color3.FromHexString('#182733');
  const glow = new StandardMaterial('grenade cyan', scene);
  glow.diffuseColor = Color3.FromHexString('#42e5ff'); glow.emissiveColor = glow.diffuseColor.scale(.6);
  const body = MeshBuilder.CreateSphere('Pulse grenade shell', {diameter: .25, segments: 12}, scene);
  body.scaling.y = 1.25; body.parent = root; body.material = shell; body.isPickable = false;
  const ring = MeshBuilder.CreateTorus('grenade band', {diameter: .25, thickness: .035, tessellation: 20}, scene);
  ring.parent = root; ring.material = glow; ring.isPickable = false;
  const cap = MeshBuilder.CreateBox('grenade cap', {width: .09, height: .07, depth: .09}, scene);
  cap.position.y = .18; cap.parent = root; cap.material = glow; cap.isPickable = false;
}

// Physics and fuse use the same active-game time, so flight counts toward detonation.
export function createGrenades(scene: Scene, explode: (position: Vector3) => void) {
  const flying: {root: TransformNode; velocity: Vector3; age: number}[] = [];
  const effects: {mesh: ReturnType<typeof MeshBuilder.CreateSphere>; age: number}[] = [];
  const blast = new StandardMaterial('grenade blast glow', scene);
  blast.emissiveColor = Color3.FromHexString('#8befff'); blast.alpha = .18; blast.disableLighting = true;
  const solid = (mesh: import('@babylonjs/core').AbstractMesh) => mesh.checkCollisions && !mesh.metadata?.owner && mesh.name !== 'player movement collider' && mesh.name !== 'bot movement collider';
  function disposeRoot(root: TransformNode) {
    const materials = new Set(root.getChildMeshes().map(mesh => mesh.material));
    root.dispose(); materials.forEach(material => material?.dispose());
  }
  return {
    throw(origin: Vector3, direction: Vector3) {
      const root = new TransformNode('thrown grenade', scene);
      populateGrenadeModel(scene, root); root.position.copyFrom(origin);
      flying.push({root, velocity: direction.scale(GRENADE.speed).add(new Vector3(0, 3, 0)), age: 0});
    },
    canDamage(origin: Vector3, target: Vector3) {
      const delta = target.subtract(origin), distance = delta.length();
      if (distance > GRENADE.radius) return false;
      if (distance < .001) return true;
      const hit = scene.pickWithRay(new Ray(origin, delta.scale(1 / distance), distance), solid);
      return !hit?.hit || hit.distance >= distance - .1;
    },
    update(dt: number) {
      for (const item of [...flying]) {
        const step = Math.min(dt, GRENADE.fuse - item.age);
        item.velocity.y -= GRENADE.gravity * step;
        const motion = item.velocity.scale(step), length = motion.length();
        if (length > .00001) {
          const direction = motion.scale(1 / length);
          const hit = scene.pickWithRay(new Ray(item.root.position, direction, length + .14), solid);
          if (hit?.hit) {
            item.root.position.addInPlace(direction.scale(Math.max(0, hit.distance - .14)));
            item.velocity.setAll(0);
          } else item.root.position.addInPlace(motion);
        }
        item.age += dt;
        if (item.age >= GRENADE.fuse) {
          const position = item.root.position.clone();
          flying.splice(flying.indexOf(item), 1); disposeRoot(item.root);
          const mesh = MeshBuilder.CreateSphere('grenade explosion', {diameter: GRENADE.radius * 2, segments: 16}, scene);
          mesh.position.copyFrom(position); mesh.material = blast; mesh.isPickable = false;
          effects.push({mesh, age: 0}); explode(position);
        }
      }
      for (const effect of [...effects]) {
        effect.age += dt; effect.mesh.visibility = Math.max(0, 1 - effect.age / .3);
        if (effect.age >= .3) { effect.mesh.dispose(); effects.splice(effects.indexOf(effect), 1); }
      }
    },
    clear() { flying.splice(0).forEach(item => disposeRoot(item.root)); effects.splice(0).forEach(item => item.mesh.dispose()); },
    dispose() { this.clear(); blast.dispose(); },
  };
}
