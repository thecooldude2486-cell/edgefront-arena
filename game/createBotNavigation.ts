import { Ray, Vector3, type Scene } from '@babylonjs/core';

// Ground routes deliberately exclude the item-only perches and moving ferries.
// The same mesh bounds used for collision keep bots away from walls and voids.
export function createBotNavigation(scene: Scene, scale: number) {
  const step = 2;
  const bodies = scene.meshes
    .filter(
      (mesh) =>
        mesh.checkCollisions &&
        !mesh.metadata?.owner &&
        !mesh.metadata?.movingPlatform,
    )
    .map((mesh) => {
      mesh.computeWorldMatrix(true);
      const bounds = mesh.getBoundingInfo().boundingBox;
      return {
        mesh,
        min: bounds.minimumWorld.clone(),
        max: bounds.maximumWorld.clone(),
      };
    });
  const ground = bodies.filter((b) => b.max.y >= -0.1 && b.max.y <= 0.4);
  const obstacles = bodies.filter((b) => b.max.y > 0.4 && b.min.y < 2.05);
  const buckets = new Map<string, typeof obstacles>();
  for (const body of obstacles) {
    const minX = Math.max(
      Math.floor((-27 * scale) / step),
      Math.floor((body.min.x - 0.56) / step),
    );
    const maxX = Math.min(
      Math.ceil((27 * scale) / step),
      Math.floor((body.max.x + 0.56) / step),
    );
    const minZ = Math.max(
      Math.floor((-20 * scale) / step),
      Math.floor((body.min.z - 0.56) / step),
    );
    const maxZ = Math.min(
      Math.ceil((20 * scale) / step),
      Math.floor((body.max.z + 0.56) / step),
    );
    for (let x = minX; x <= maxX; x++)
      for (let z = minZ; z <= maxZ; z++) {
        const id = `${x},${z}`,
          nearby = buckets.get(id) ?? [];
        nearby.push(body);
        buckets.set(id, nearby);
      }
  }
  const edges = new Map<string, boolean>();
  let collisionState = '';
  function refresh() {
    const state = bodies
      .map((b) => (b.mesh.isEnabled() && b.mesh.checkCollisions ? '1' : '0'))
      .join('');
    if (state !== collisionState) {
      edges.clear();
      collisionState = state;
    }
  }
  const contains = (b: (typeof bodies)[number], p: Vector3, margin: number) =>
    p.x >= b.min.x - margin &&
    p.x <= b.max.x + margin &&
    p.z >= b.min.z - margin &&
    p.z <= b.max.z + margin;
  function walkable(p: Vector3) {
    if (Math.abs(p.x) > 27 * scale || Math.abs(p.z) > 20 * scale) return false;
    return (
      ground.some((b) => b.mesh.isEnabled() && contains(b, p, -0.52)) &&
      !(
        buckets.get(`${Math.floor(p.x / step)},${Math.floor(p.z / step)}`) ?? []
      ).some(
        (b) =>
          b.mesh.isEnabled() && b.mesh.checkCollisions && contains(b, p, 0.56),
      )
    );
  }
  function clear(from: Vector3, to: Vector3) {
    // Exact segment/expanded-box intersection also catches grazing a thin corner.
    const nearby = new Set<(typeof obstacles)[number]>();
    for (
      let x = Math.floor(Math.min(from.x, to.x) / step);
      x <= Math.floor(Math.max(from.x, to.x) / step);
      x++
    )
      for (
        let z = Math.floor(Math.min(from.z, to.z) / step);
        z <= Math.floor(Math.max(from.z, to.z) / step);
        z++
      )
        for (const body of buckets.get(`${x},${z}`) ?? []) nearby.add(body);
    for (const body of nearby) {
      if (!body.mesh.isEnabled() || !body.mesh.checkCollisions) continue;
      let entry = 0,
        exit = 1;
      for (const axis of ['x', 'z'] as const) {
        const delta = to[axis] - from[axis],
          min = body.min[axis] - 0.56,
          max = body.max[axis] + 0.56;
        if (Math.abs(delta) < 0.00001) {
          if (from[axis] < min || from[axis] > max) {
            entry = 2;
            break;
          }
        } else {
          const a = (min - from[axis]) / delta,
            b = (max - from[axis]) / delta;
          entry = Math.max(entry, Math.min(a, b));
          exit = Math.min(exit, Math.max(a, b));
        }
      }
      if (entry <= exit) return false;
    }
    const distance = Math.hypot(to.x - from.x, to.z - from.z);
    const samples = Math.max(1, Math.ceil(distance / 0.45));
    for (let i = 0; i <= samples; i++)
      if (!walkable(Vector3.Lerp(from, to, i / samples))) return false;
    return true;
  }
  const key = (x: number, z: number) => `${x},${z}`;
  const point = (x: number, z: number) => new Vector3(x * step, 1, z * step);
  function nearest(p: Vector3) {
    const cx = Math.round(p.x / step),
      cz = Math.round(p.z / step);
    const candidates: { x: number; z: number; distance: number }[] = [];
    for (let x = cx - 3; x <= cx + 3; x++)
      for (let z = cz - 3; z <= cz + 3; z++)
        candidates.push({
          x,
          z,
          distance: Vector3.DistanceSquared(point(x, z), p),
        });
    return (
      candidates
        .sort((a, b) => a.distance - b.distance)
        .find((c) => walkable(point(c.x, c.z)) && clear(p, point(c.x, c.z))) ??
      null
    );
  }
  function edgeClear(ax: number, az: number, bx: number, bz: number) {
    const a = key(ax, az),
      b = key(bx, bz),
      id = a < b ? `${a}/${b}` : `${b}/${a}`;
    if (!edges.has(id)) edges.set(id, clear(point(ax, az), point(bx, bz)));
    return edges.get(id)!;
  }
  function route(from: Vector3, goal: Vector3) {
    refresh();
    const start = nearest(from);
    // A cover/enemy position can be inside an obstacle; find a safe nearby destination.
    let end: { x: number; z: number } | null = null,
      best = Infinity;
    const gx = Math.round(goal.x / step),
      gz = Math.round(goal.z / step);
    for (let x = gx - 3; x <= gx + 3; x++)
      for (let z = gz - 3; z <= gz + 3; z++) {
        const p = point(x, z),
          d = Vector3.DistanceSquared(p, goal);
        if (d < best && walkable(p)) {
          end = { x, z };
          best = d;
        }
      }
    if (!start || !end) return [];
    const startKey = key(start.x, start.z),
      endKey = key(end.x, end.z);
    const open: { x: number; z: number; cost: number; rank: number }[] = [
      { x: start.x, z: start.z, cost: 0, rank: 0 },
    ];
    const costs = new Map([[startKey, 0]]);
    const parents = new Map<string, string>(),
      closed = new Set<string>();
    while (open.length && closed.size < 2500) {
      open.sort((a, b) => b.rank - a.rank);
      const current = open.pop()!,
        id = key(current.x, current.z);
      if (closed.has(id)) continue;
      if (id === endKey) {
        const path: Vector3[] = [];
        let cursor: string | undefined = id;
        while (cursor) {
          const [x, z] = cursor.split(',').map(Number);
          path.unshift(point(x, z));
          cursor = parents.get(cursor);
        }
        return path;
      }
      closed.add(id);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const x = current.x + dx,
          z = current.z + dz,
          next = key(x, z);
        const cost = current.cost + Math.hypot(dx, dz);
        if (
          closed.has(next) ||
          cost >= (costs.get(next) ?? Infinity) ||
          !edgeClear(current.x, current.z, x, z)
        )
          continue;
        costs.set(next, cost);
        parents.set(next, id);
        open.push({
          x,
          z,
          cost,
          rank: cost + Math.hypot(x - end.x, z - end.z),
        });
      }
    }
    return [];
  }
  function steer(position: Vector3, wanted: Vector3) {
    if (wanted.lengthSquared() < 0.001) return Vector3.Zero();
    const direction = wanted.normalizeToNew();
    for (const angle of [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4]) {
      const candidate = new Vector3(
        direction.x * Math.cos(angle) - direction.z * Math.sin(angle),
        0,
        direction.x * Math.sin(angle) + direction.z * Math.cos(angle),
      );
      if (clear(position, position.add(candidate.scale(0.9)))) return candidate;
    }
    return Vector3.Zero();
  }
  function visible(from: Vector3, to: Vector3) {
    const delta = to.subtract(from),
      distance = delta.length();
    if (distance < 0.01) return true;
    const hit = scene.pickWithRay(
      new Ray(from, delta.scale(1 / distance), distance),
      (mesh) =>
        mesh.isEnabled() && mesh.checkCollisions && !mesh.metadata?.owner,
    );
    return !hit?.hit || hit.distance >= distance - 0.1;
  }
  return { walkable, clear, route, steer, visible };
}
export type BotNavigation = ReturnType<typeof createBotNavigation>;
