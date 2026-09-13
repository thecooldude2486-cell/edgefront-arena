import { AbstractMesh, Color3, MeshBuilder, Ray, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
export const ROCKET = { speed: 45, radius: 4, lifetime: 4 };
export function populateLauncherModel(scene: Scene, root: TransformNode) {
  const pearl = new StandardMaterial('comet pearl', scene); pearl.diffuseColor = Color3.FromHexString('#e9f0f1');
  const dark = new StandardMaterial('comet graphite', scene); dark.diffuseColor = Color3.FromHexString('#182733');
  const cyan = new StandardMaterial('comet energy', scene); cyan.diffuseColor = Color3.FromHexString('#42e5ff'); cyan.emissiveColor = cyan.diffuseColor.scale(.6);
  function tube(name: string, z: number, diameter: number, length: number, material: StandardMaterial) {
    const mesh = MeshBuilder.CreateCylinder(name, {diameter, height: length, tessellation: 12}, scene);
    mesh.parent = root; mesh.position.z = z; mesh.rotation.x = Math.PI / 2; mesh.material = material; mesh.isPickable = false;
  }
  tube('comet body', .1, .34, .9, pearl); tube('comet rear collar', -.39, .38, .14, dark);
  tube('comet front collar', .56, .39, .15, dark); tube('comet bore', .642, .28, .01, dark);
  tube('comet cyan band', .43, .35, .025, cyan);
  const grip = MeshBuilder.CreateBox('comet grip', {width: .12, height: .3, depth: .18}, scene);
  grip.parent = root; grip.position.set(0, -.27, -.13); grip.material = dark; grip.isPickable = false;
  const sight = MeshBuilder.CreateTorus('comet sight', {diameter: .13, thickness: .02, tessellation: 16}, scene);
  sight.parent = root; sight.position.set(0, .24, .1); sight.rotation.x = Math.PI / 2; sight.material = cyan; sight.isPickable = false;
}

// A swept ray covers every metre travelled each frame, so fast rockets cannot tunnel.
export function createRockets(scene: Scene, explode: (position: Vector3, direct: AbstractMesh | null) => void) {
  const material = new StandardMaterial('comet missile glow', scene);
  material.diffuseColor = Color3.FromHexString('#dcebf0'); material.emissiveColor = Color3.FromHexString('#35aabb');
  const blastMaterial = new StandardMaterial('comet blast', scene); blastMaterial.emissiveColor = Color3.FromHexString('#84eaff'); blastMaterial.alpha = .2;
  const flying: {mesh: ReturnType<typeof MeshBuilder.CreateSphere>; direction: Vector3; age: number}[] = [];
  const effects: {mesh: ReturnType<typeof MeshBuilder.CreateSphere>; age: number}[] = [];
  return {
    fire(origin: Vector3, direction: Vector3) {
      const mesh = MeshBuilder.CreateSphere('Comet missile', {diameter: .18, segments: 12}, scene);
      mesh.position.copyFrom(origin); mesh.material = material; mesh.isPickable = false;
      flying.push({mesh, direction: direction.normalizeToNew(), age: 0});
    },
    update(dt: number) {
      for (const rocket of [...flying]) {
        if (!flying.includes(rocket)) continue;
        const distance = ROCKET.speed * Math.min(dt, ROCKET.lifetime - rocket.age);
        const hit = scene.pickWithRay(new Ray(rocket.mesh.position, rocket.direction, distance), mesh =>
          mesh !== rocket.mesh && mesh.metadata?.owner !== 'player' &&
          (mesh.metadata?.owner === 'bot' || (mesh.checkCollisions && mesh.name !== 'bot movement collider')));
        rocket.age += dt;
        if (hit?.hit && hit.pickedPoint) {
          // Keep splash origin just outside the struck surface.
          const position = hit.pickedPoint.subtract(rocket.direction.scale(.04));
          flying.splice(flying.indexOf(rocket), 1); rocket.mesh.dispose();
          const effect = MeshBuilder.CreateSphere('Comet explosion', {diameter: ROCKET.radius * 2, segments: 16}, scene);
          effect.position.copyFrom(position); effect.material = blastMaterial; effect.isPickable = false;
          effects.push({mesh: effect, age: 0});
          explode(position, hit.pickedMesh);
        } else if (rocket.age >= ROCKET.lifetime) {
          flying.splice(flying.indexOf(rocket), 1); rocket.mesh.dispose();
        } else rocket.mesh.position.addInPlace(rocket.direction.scale(distance));
      }
      for (const effect of [...effects]) {
        effect.age += dt; effect.mesh.visibility = Math.max(0, 1 - effect.age / .3);
        if (effect.age >= .3) { effect.mesh.dispose(); effects.splice(effects.indexOf(effect), 1); }
      }
    },
    clear() { flying.splice(0).forEach(item => item.mesh.dispose()); effects.splice(0).forEach(item => item.mesh.dispose()); },
    dispose() { this.clear(); material.dispose(); blastMaterial.dispose(); },
  };
}
