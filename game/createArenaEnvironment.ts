import {
  Color3,
  MeshBuilder,
  Ray,
  StandardMaterial,
  Vector3,
  type AbstractMesh,
  type Scene,
} from '@babylonjs/core';
import {
  barrelLocations,
  barrelDamage,
  ferryPosition,
  newEnvironment,
  BARREL_RADIUS,
  type EnvironmentState,
} from './arenaEnvironment';
import { mapScale } from './teams';
import type { ArenaMapId } from './maps';
export function createArenaEnvironment(scene: Scene, map: ArenaMapId) {
  const metal = new StandardMaterial('traversal midnight metal', scene);
  metal.diffuseColor = Color3.FromHexString('#142e3c');
  metal.specularColor.set(0.25, 0.3, 0.35);
  const cyan = new StandardMaterial('traversal cyan guidance', scene);
  cyan.diffuseColor = Color3.FromHexString('#32d6e9');
  cyan.emissiveColor = cyan.diffuseColor.scale(0.6);
  const danger = new StandardMaterial('oil barrel warning amber', scene);
  danger.diffuseColor = Color3.FromHexString('#d29540');
  danger.emissiveColor = danger.diffuseColor.scale(0.15);
  const blastMaterial = new StandardMaterial('oil explosion glow', scene);
  blastMaterial.diffuseColor = Color3.FromHexString('#ffb450');
  blastMaterial.emissiveColor = blastMaterial.diffuseColor;
  blastMaterial.disableLighting = true;
  blastMaterial.alpha = 0.6;
  function box(
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    trim = false,
  ) {
    const mesh = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      scene,
    );
    mesh.position.set(x, y, z);
    mesh.material = trim ? cyan : metal;
    mesh.checkCollisions = !trim;
    mesh.isPickable = !trim;
    mesh.receiveShadows = true;
    return mesh;
  }
  const platforms = [-1, 1].map((side) => {
    box('void launch dock', side * 14, -0.25, side * 23.4, 4, 0.5, 4.8);
    for (const offset of [-1.85, 1.85])
      box(
        'launch dock warning edge',
        side * 14 + offset,
        0.03,
        side * 23.4,
        0.1,
        0.07,
        4.8,
        true,
      );
    box('ferry destination island', side * 14, 1.35, side * 35, 7, 0.5, 4);
    box('blast / Orbiter only perch', side * 20, 4.55, side * 34, 4, 0.5, 5);
    box('perch rear cover', side * 20, 5.45, side * 36.2, 4, 1.3, 0.35);
    box('perch grapple beacon', side * 20, 6.8, side * 36.2, 0.3, 2, 0.3);
    box(
      'perch beacon glow',
      side * 20,
      7.85,
      side * 36.2,
      0.6,
      0.12,
      0.6,
      true,
    );
    const mesh = box(
      'moving void ferry',
      side * 14,
      0,
      side * 25.8,
      3.6,
      0.35,
      3.6,
    );
    const rim = box('moving ferry cyan edge', 0, 0.2, 0, 3.6, 0.06, 3.6, true);
    rim.parent = mesh;
    mesh.metadata = { movingPlatform: true };
    return {
      side,
      mesh,
      previous: mesh.position.clone(),
      delta: Vector3.Zero(),
    };
  });
  const locations = barrelLocations(map);
  const barrels = locations.map((p, id) => {
    const mesh = MeshBuilder.CreateCylinder(
      `explosive oil barrel ${id}`,
      { diameter: 1.05, height: 1.4, tessellation: 16 },
      scene,
    );
    mesh.position.set(p.x, p.y, p.z);
    mesh.material = metal;
    mesh.checkCollisions = true;
    mesh.metadata = { barrelId: id };
    mesh.receiveShadows = true;
    for (const y of [-0.46, 0, 0.46]) {
      const band = MeshBuilder.CreateTorus(
        'oil barrel hazard band',
        { diameter: 1.07, thickness: 0.08, tessellation: 16 },
        scene,
      );
      band.parent = mesh;
      band.position.y = y;
      band.material = danger;
      band.isPickable = false;
    }
    const warning = box(
      'oil barrel warning plate',
      0,
      0,
      -0.535,
      0.3,
      0.4,
      0.04,
      true,
    );
    warning.parent = mesh;
    warning.material = danger;
    return mesh;
  });
  const scale = mapScale(map);
  scene.meshes
    .filter(
      (m) =>
        m.material &&
        [metal, cyan, danger].includes(m.material as StandardMaterial) &&
        !m.parent,
    )
    .forEach((m) => {
      m.position.x *= scale;
      m.position.z *= scale;
      if (!Number.isInteger(m.metadata?.barrelId)) {
        m.scaling.x *= scale;
        m.scaling.z *= scale;
      }
    });
  let state = newEnvironment(map);
  const flashes: {
    mesh: ReturnType<typeof MeshBuilder.CreateSphere>;
    age: number;
  }[] = [];
  function flash(id: number) {
    if (scene.getEngine().getClassName() === 'NullEngine') return;
    const mesh = MeshBuilder.CreateSphere(
      'oil barrel explosion',
      { diameter: 1, segments: 12 },
      scene,
    );
    mesh.position.copyFrom(barrels[id].position);
    mesh.material = blastMaterial;
    mesh.isPickable = false;
    flashes.push({ mesh, age: 0 });
  }
  function apply(next: EnvironmentState, animate = false) {
    const old = state;
    state = { seconds: next.seconds, barrelHealth: [...next.barrelHealth] };
    barrels.forEach((mesh, id) => {
      if (animate && old.barrelHealth[id] > 0 && state.barrelHealth[id] === 0)
        flash(id);
      mesh.setEnabled(state.barrelHealth[id] > 0);
    });
    platforms.forEach((p) => {
      p.previous.copyFrom(p.mesh.position);
      const value = ferryPosition(p.side, state.seconds);
      p.mesh.position.set(value.x * scale, value.y - 0.175, value.z * scale);
      p.delta.copyFrom(p.mesh.position.subtract(p.previous));
      p.mesh.computeWorldMatrix(true);
    });
    barrels.forEach((mesh) => mesh.computeWorldMatrix(true));
  }
  function visible(origin: Vector3, target: Vector3) {
    const delta = target.subtract(origin),
      distance = delta.length();
    if (distance < 0.001) return true;
    const hit = scene.pickWithRay(
      new Ray(origin, delta.scale(1 / distance), distance),
      (mesh) =>
        mesh.isEnabled() &&
        mesh.checkCollisions &&
        !Number.isInteger(mesh.metadata?.barrelId) &&
        !mesh.metadata?.owner &&
        !mesh.name.includes('movement collider'),
    );
    return !hit?.hit || hit.distance >= distance - 0.15;
  }
  apply(state);
  return {
    barrels,
    platforms,
    visible,
    get state() {
      return { seconds: state.seconds, barrelHealth: [...state.barrelHealth] };
    },
    apply,
    update(seconds: number, dt: number) {
      apply({ ...state, seconds });
      for (const f of flashes.slice()) {
        f.age += dt;
        f.mesh.scaling.setAll(1 + f.age * 14);
        f.mesh.visibility = Math.max(0, 1 - f.age / 0.45);
        if (f.age >= 0.45) {
          f.mesh.dispose();
          flashes.splice(flashes.indexOf(f), 1);
        }
      }
    },
    carry(position: Vector3, halfHeight: number) {
      for (const p of platforms) {
        const foot = position.y - halfHeight;
        const top = p.previous.y + 0.175;
        if (
          Math.abs(foot - top) < 0.22 &&
          Math.abs(position.x - p.previous.x) < 1.8 &&
          Math.abs(position.z - p.previous.z) < 1.8 * scale
        )
          return p.delta.clone();
      }
      return Vector3.Zero();
    },
    hit(
      mesh: AbstractMesh,
      amount: number,
      onExplosion: (point: Vector3) => void,
    ) {
      const id = mesh.metadata?.barrelId;
      if (!Number.isInteger(id) || state.barrelHealth[id] <= 0) return false;
      state.barrelHealth[id] = Math.max(0, state.barrelHealth[id] - amount);
      if (state.barrelHealth[id] === 0) {
        mesh.setEnabled(false);
        flash(id);
        const point = mesh.position.clone();
        // Disable first so the exploding barrel cannot shield anyone from itself.
        onExplosion(point);
        barrels.forEach((other, index) => {
          const distance = Vector3.Distance(point, other.position);
          if (
            index !== id &&
            state.barrelHealth[index] > 0 &&
            distance < BARREL_RADIUS &&
            visible(point, other.position)
          )
            this.hit(other, barrelDamage(distance), onExplosion);
        });
      }
      return true;
    },
    blast(
      point: Vector3,
      radius: number,
      amount: number,
      onExplosion: (point: Vector3) => void,
    ) {
      barrels.forEach((mesh) => {
        if (
          mesh.isEnabled() &&
          Vector3.Distance(point, mesh.position) <= radius &&
          visible(point, mesh.position)
        )
          this.hit(mesh, amount, onExplosion);
      });
    },
    reset() {
      flashes.splice(0).forEach((f) => f.mesh.dispose());
      apply(newEnvironment(map));
      platforms.forEach((p) => p.delta.setAll(0));
    },
    dispose() {
      flashes.forEach((f) => f.mesh.dispose());
      [metal, cyan, danger, blastMaterial].forEach((m) => m.dispose());
    },
  };
}
