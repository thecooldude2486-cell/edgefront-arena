import { Color3, MeshBuilder, Ray, Scene, StandardMaterial, TransformNode, Vector3, type AbstractMesh } from '@babylonjs/core';

import { MOLOTOV } from './projectileDefinitions';
export { MOLOTOV };
export function populateMolotovModel(scene: Scene, root: TransformNode) {
  const shell = new StandardMaterial('Ember pearl shell', scene);
  shell.diffuseColor = Color3.FromHexString('#dce9ef');
  const glow = new StandardMaterial('Ember orange core', scene);
  glow.diffuseColor = Color3.FromHexString('#ff792c'); glow.emissiveColor = glow.diffuseColor.scale(.8);
  for (const [name, height, diameter, y, material] of [
    ['canister', .3, .18, 0, shell], ['energy band', .1, .19, 0, glow],
    ['igniter', .13, .07, .21, shell], ['igniter light', .04, .08, .28, glow],
  ] as const) {
    const mesh = MeshBuilder.CreateCylinder('Ember ' + name, { height, diameter, tessellation: 12 }, scene);
    mesh.parent = root; mesh.position.y = y; mesh.material = material; mesh.isPickable = false;
  }
}

// Active-game time drives both flight and burning. No timers survive a round reset.
export function createMolotovs(scene: Scene, burn: (position: Vector3) => void) {
  const flying: { root: TransformNode; velocity: Vector3; age: number }[] = [];
  const fires: { root: TransformNode; age: number; ticks: number }[] = [];
  const flame = new StandardMaterial('Ember fire', scene);
  flame.emissiveColor = Color3.FromHexString('#ff852e'); flame.disableLighting = true; flame.alpha = .7;
  const solid = (mesh: AbstractMesh) => mesh.isEnabled() && mesh.checkCollisions && !mesh.metadata?.owner && !['player movement collider', 'bot movement collider'].includes(mesh.name);
  function disposeBottle(root: TransformNode) {
    const materials = new Set(root.getChildMeshes().map(mesh => mesh.material));
    root.dispose(); materials.forEach(material => material?.dispose());
  }
  function ignite(point: Vector3) {
    const floor = scene.pickWithRay(new Ray(point.add(new Vector3(0, .15, 0)), Vector3.Down(), 15), solid);
    if (!floor?.hit || !floor.pickedPoint) return;
    const root = new TransformNode('Ember burning area', scene);
    root.position.copyFrom(floor.pickedPoint); root.position.y += .04;
    const pool = MeshBuilder.CreateCylinder('Ember fire radius', { height: .035, diameter: MOLOTOV.radius * 2, tessellation: 48 }, scene);
    pool.parent = root; pool.material = flame; pool.isPickable = false;
    for (let i = 0; i < 22; i++) {
      const angle = i * 2.4, radius = Math.sqrt((i + .5) / 22) * MOLOTOV.radius;
      const mesh = MeshBuilder.CreateSphere('Ember flame', { diameter: .28, segments: 6 }, scene);
      mesh.parent = root; mesh.position.set(Math.cos(angle) * radius, .25, Math.sin(angle) * radius);
      mesh.material = flame; mesh.isPickable = false;
    }
    fires.push({ root, age: 0, ticks: 0 });
  }
  return {
    throw(origin: Vector3, direction: Vector3) {
      const root = new TransformNode('thrown Molotov', scene);
      populateMolotovModel(scene, root); root.position.copyFrom(origin);
      flying.push({ root, velocity: direction.normalizeToNew().scale(MOLOTOV.speed).add(new Vector3(0, 3, 0)), age: 0 });
    },
    canDamage(origin: Vector3, target: Vector3) {
      if (Math.abs(target.y - origin.y) > 2 || Math.hypot(target.x - origin.x, target.z - origin.z) > MOLOTOV.radius) return false;
      const start = origin.add(new Vector3(0, .2, 0)), delta = target.subtract(start), distance = delta.length();
      if (distance < .001) return true;
      const hit = scene.pickWithRay(new Ray(start, delta.scale(1 / distance), distance), solid);
      return !hit?.hit || hit.distance >= distance - .1;
    },
    update(dt: number) {
      // Process existing fires first: a newly landed bottle starts at age zero.
      for (const fire of [...fires]) {
        fire.age = Math.min(MOLOTOV.duration, fire.age + Math.max(0, dt));
        const ticks = Math.floor((fire.age + 1e-8) / MOLOTOV.tick);
        while (fire.ticks < ticks && fires.includes(fire)) { fire.ticks++; burn(fire.root.position.clone()); }
        if (!fires.includes(fire)) continue; // A final hit can reset the entire match.
        fire.root.getChildMeshes().slice(1).forEach((mesh, i) => { mesh.scaling.y = 1.5 + Math.sin(fire.age * 10 + i) * .6; });
        if (fire.age >= MOLOTOV.duration) { fire.root.dispose(); fires.splice(fires.indexOf(fire), 1); }
      }
      for (const item of [...flying]) {
        item.age += dt; item.velocity.y -= MOLOTOV.gravity * dt;
        const motion = item.velocity.scale(dt), length = motion.length();
        const hit = length > 0 ? scene.pickWithRay(new Ray(item.root.position, motion.scale(1 / length), length + .12), solid) : null;
        if (hit?.hit && hit.pickedPoint) {
          const point = hit.pickedPoint.subtract(motion.normalizeToNew().scale(.13));
          flying.splice(flying.indexOf(item), 1); disposeBottle(item.root); ignite(point);
        } else if (item.age > 10) { flying.splice(flying.indexOf(item), 1); disposeBottle(item.root); }
        else { item.root.position.addInPlace(motion); item.root.rotation.z += dt * 3; }
      }
    },
    clear() { flying.splice(0).forEach(item => disposeBottle(item.root)); fires.splice(0).forEach(item => item.root.dispose()); },
    dispose() { this.clear(); flame.dispose(); },
  };
}
