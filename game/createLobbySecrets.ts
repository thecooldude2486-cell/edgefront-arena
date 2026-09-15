import { Color3, MeshBuilder, Ray, StandardMaterial, TransformNode, Vector3, type Scene } from '@babylonjs/core';
import { LASER_PARTS, type LaserPartId } from './laserParts';

export function createLobbySecrets(scene: Scene) {
  const shell = new StandardMaterial('secret alcove ceramic', scene);
  shell.diffuseColor = Color3.FromHexString('#405768'); shell.emissiveColor = shell.diffuseColor.scale(.15);
  const metal = new StandardMaterial('laser component metal', scene);
  metal.diffuseColor = Color3.FromHexString('#d5dce5');
  const energy = new StandardMaterial('laser component energy', scene);
  energy.emissiveColor = Color3.FromHexString('#92f3b5'); energy.diffuseColor = energy.emissiveColor;
  function box(name: string, x: number, y: number, z: number, width: number, height: number, depth: number, solid = true) {
    const mesh = MeshBuilder.CreateBox(`secret ${name}`, { width, height, depth }, scene);
    mesh.position.set(x, y, z); mesh.material = shell; mesh.checkCollisions = solid;
    return mesh;
  }
  // Three genuinely enclosed rooms outside the main concourse. The outer
  // walls, floors and ceilings are solid; only the disguised entrance is not.
  const rooms = [
    { name: 'coil workshop', x: -31.5, z: -105, w: 9, d: 8, side: -1 },
    { name: 'emitter lab', x: 31.5, z: -104, w: 9, d: 8, side: 1 },
    { name: 'regulator vault', x: 14, z: -84.5, w: 8, d: 9, side: 0 },
  ];
  for (const room of rooms) {
    const { name, x, z, w, d, side } = room;
    box(`${name} floor`, x, -.3, z, w, .6, d);
    box(`${name} ceiling`, x, 4.2, z, w, .3, d);
    if (side) {
      box(`${name} outer wall`, x + side * w / 2, 2, z, .3, 4, d);
      for (const end of [-1, 1]) box(`${name} end wall`, x, 2, z + end * d / 2, w, 4, .3);
      box(`${name} sightline baffle`, x - side * 1.5, 1.5, z, .3, 3, 3);
    } else {
      box(`${name} outer wall`, x, 2, z + d / 2, w, 4, .3);
      for (const end of [-1, 1]) box(`${name} side wall`, x + end * w / 2, 2, z, .3, 4, d);
      box(`${name} sightline baffle`, x, 1.5, z - 1.5, 3, 3, .3);
    }
    const doorX = side ? side * 27 : x;
    const doorZ = side ? z : -89;
    const disguise = box(`${name} false wall`, doorX, 1.5, doorZ, side ? .8 : 3.2, 3, side ? 3.2 : .8, false);
    disguise.material = scene.getMaterialByName('lobby graphite') ?? shell;
    // Not a collision wall, but it hides collection prompts until entered.
    disguise.metadata = { secretEntrance: true };
    // A small interior light makes the exit visible from INSIDE only.
    const exitLight = box(`${name} interior exit light`, doorX + side * .5, 2.7, doorZ + (side ? 0 : .5), side ? .04 : 2.4, .07, side ? 2.4 : .04, false);
    exitLight.material = energy;
    for (const offset of [-2, 2]) {
      const cabinet = box(`${name} equipment rack`, x + (side ? 0 : offset), 1.1, z + (side ? offset : 2.8), .8, 2.2, .55);
      cabinet.material = metal;
      const lamp = box(`${name} rack lamp`, cabinet.position.x, 1.8, cabinet.position.z - .3, .45, .08, .03, false);
      lamp.material = energy;
    }
  }
  const roots = new Map<LaserPartId, TransformNode>();
  for (const [index, part] of LASER_PARTS.entries()) {
    // The first two are deliberately obvious: a pedestal beside the Armory
    // and the existing lounge table. The other three are behind false walls.
    if (part.id !== 'lens') box(`${part.id} shelf`, part.x, .225, part.z, 1.3, .45, 1);
    const root = new TransformNode(`laser part ${part.id}`, scene);
    root.position.set(part.x, part.y, part.z); roots.set(part.id, root);
    // Five small engineering components, not an assembled weapon.
    const core = MeshBuilder.CreateCylinder(`part ${part.id} core`, { diameter: .24, height: .55, tessellation: 12 }, scene);
    core.parent = root; core.material = energy; core.isPickable = false;
    const casing = MeshBuilder.CreateTorus(`part ${part.id} ring`, { diameter: .5, thickness: .08, tessellation: 20 }, scene);
    casing.parent = root; casing.material = metal; casing.isPickable = false;
    casing.rotation.x = index % 2 ? Math.PI / 2 : .4;
    for (const side of [-1, 1]) {
      const plate = MeshBuilder.CreateBox(`part ${part.id} plate`, { width: .35 + index * .035, height: .08, depth: .35 }, scene);
      plate.parent = root; plate.position.y = side * .3; plate.material = metal; plate.isPickable = false;
    }
  }
  return {
    setCollected(ids: readonly LaserPartId[]) { for (const [id, root] of roots) root.setEnabled(!ids.includes(id)); },
    nearby(eye: Vector3) {
      return LASER_PARTS.find(part => {
        if (!roots.get(part.id)?.isEnabled()) return false;
        const direction = new Vector3(part.x, part.y, part.z).subtract(eye);
        const distance = direction.length();
        if (distance > 2.3) return false;
        // Collecting through a screen or wall is never allowed.
        return !scene.pickWithRay(new Ray(eye, direction.normalize(), distance), mesh => (mesh.checkCollisions || mesh.metadata?.secretEntrance) && mesh.metadata?.owner !== 'player')?.hit;
      }) ?? null;
    },
    update(time: number) {
      for (const [index, part] of LASER_PARTS.entries()) {
        const root = roots.get(part.id)!;
        root.rotation.y = time * .0006 + index;
        root.position.y = part.y + Math.sin(time * .002 + index) * .06;
      }
    },
  };
}
