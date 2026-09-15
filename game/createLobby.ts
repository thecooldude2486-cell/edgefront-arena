import { Color3, DynamicTexture, HemisphericLight, MeshBuilder, StandardMaterial, Vector3, type Scene } from '@babylonjs/core';
import { createLobbySecrets } from './createLobbySecrets';

export const LOBBY_SPAWN = new Vector3(0, 1.72, -141);

// Original sports-complex atrium. All destinations use a flat, accessible
// concourse. The combat arena is untouched, 120 metres away from this room.
export function createLobby(scene: Scene) {
  const existing = new Set(scene.meshes);
  function material(name: string, hex: string, luminous = false) {
    const m = new StandardMaterial(`lobby ${name}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.emissiveColor = m.diffuseColor.scale(luminous ? .7 : .13);
    m.specularColor = new Color3(.2, .25, .3);
    return m;
  }
  const navy = material('graphite', '#243a4e');
  const floor = material('porcelain floor', '#829ba9');
  const pearl = material('ceramic', '#e1e9e9');
  const dark = material('recess', '#102432');
  const cyan = material('cyan', '#39cfe3', true);
  const violet = material('violet', '#a591f3', true);
  const leaf = material('foliage', '#48886f');
  const metal = material('brushed metal', '#617b8f');
  function box(name: string, x: number, y: number, z: number, w: number, h: number, d: number, mat: StandardMaterial, solid = true) {
    const mesh = MeshBuilder.CreateBox(`lobby ${name}`, { width: w, height: h, depth: d }, scene);
    mesh.position.set(x, y, z - 120); mesh.material = mat;
    mesh.checkCollisions = solid; mesh.isPickable = solid;
    return mesh;
  }
  function ring(name: string, x: number, y: number, z: number, diameter: number, thickness: number, mat: StandardMaterial) {
    const mesh = MeshBuilder.CreateTorus(`lobby ${name}`, { diameter, thickness, tessellation: 64 }, scene);
    mesh.position.set(x, y, z - 120); mesh.material = mat; mesh.isPickable = false;
    return mesh;
  }
  function cylinder(name: string, x: number, y: number, z: number, diameter: number, height: number, mat: StandardMaterial, solid = true) {
    const mesh = MeshBuilder.CreateCylinder(`lobby ${name}`, { diameter, height, tessellation: 48 }, scene);
    mesh.position.set(x, y, z - 120); mesh.material = mat; mesh.checkCollisions = solid; mesh.isPickable = solid;
    return mesh;
  }
  function sign(text: string, x: number, y: number, z: number, width: number, tint: string) {
    const texture = new DynamicTexture(`lobby sign ${text}`, { width: 1024, height: 128 }, scene, false);
    texture.drawText(text, null, 82, 'bold 52px sans-serif', tint, '#102432', true);
    const mat = new StandardMaterial(`lobby lettering ${text}`, scene);
    mat.diffuseTexture = texture; mat.emissiveTexture = texture; mat.disableLighting = true;
    const mesh = MeshBuilder.CreatePlane(`lobby sign ${text}`, { width, height: width / 8 }, scene);
    mesh.position.set(x, y, z - 120); mesh.material = mat; mesh.isPickable = false;
  }
  box('foundation', 0, -.35, 0, 54, .7, 62, floor);
  for (const x of [-21, -7, 7, 21]) box('floor seam', x, .005, 0, .035, .01, 60, metal, false);
  for (const z of [-23, -9, 5, 19]) box('floor seam', 0, .005, z, 52, .01, .035, metal, false);
  // Real openings in the collision walls lead into the secret rooms.
  // Their opaque, non-solid disguises are built by createLobbySecrets.
  box('back wall left', -7.3, 7, 31, 39.4, 14, .8, navy);
  box('back wall right', 21.3, 7, 31, 11.4, 14, .8, navy);
  box('back wall lintel', 14, 8.5, 31, 3.2, 11, .8, navy);
  box('entry wall', 0, 7, -31, 54, 14, .8, navy);
  for (const side of [-1, 1]) {
    const entranceZ = side < 0 ? 15 : 16;
    const before = entranceZ - 1.6;
    const after = entranceZ + 1.6;
    box('perimeter wall front', side * 27, 7, (before - 31) / 2, .8, 14, before + 31, navy);
    box('perimeter wall rear', side * 27, 7, (after + 31) / 2, .8, 14, 31 - after, navy);
    box('perimeter lintel', side * 27, 8.5, entranceZ, .8, 11, 3.2, navy);
    box('high clerestory', side * 26.5, 10, 0, .12, 3, 57, cyan, false);
    box('upper fascia', side * 24.5, 7.2, 0, 4.5, .7, 62, pearl);
    box('fascia light', side * 22.2, 6.8, 0, .1, .12, 60, cyan, false);
    for (const z of [-25, -13, -1, 11, 25]) {
      box('column footing', side * 24, .25, z, 2, .5, 2, metal);
      box('structural pier', side * 24, 6.5, z, 1.1, 13, 1.1, pearl);
      box('pier inset', side * 23.4, 4, z, .06, 4, .4, navy, false);
    }
  }
  for (const z of [-24, -12, 0, 12, 24]) box('roof beam', 0, 14, z, 54, .65, .5, pearl);
  box('skylight', 0, 15, 0, 50, .1, 60, material('skylight', '#86afc6', true), false);
  cylinder('central island', 0, .17, -3, 8, .34, navy);
  ring('island rim', 0, .37, -3, 7.8, .09, cyan);
  cylinder('sculpture base', 0, .7, -3, 2.8, 1.1, pearl);
  const orb = MeshBuilder.CreateSphere('lobby suspended Orb', { diameter: 2, segments: 24 }, scene);
  orb.position.set(0, 3.4, -123); orb.material = cyan; orb.isPickable = false;
  const orbitA = ring('orbital band', 0, 3.4, -3, 3.8, .12, pearl);
  const orbitB = ring('orbital light', 0, 3.4, -3, 4.8, .055, violet);
  ring('atrium crown', 0, 11.5, -3, 15, .4, pearl);
  ring('atrium crown light', 0, 11.2, -3, 14.8, .1, cyan);
  for (const x of [-6, 6]) {
    box('navigation strip', x, .017, 0, .12, .03, 50, cyan, false);
    for (const z of [-16, -12, 8, 12, 16]) {
      const arrow = box('route chevron', x, .025, z, .9, .035, .14, pearl, false);
      arrow.rotation.y = -.65;
    }
  }
  // Layered arena gateway and an accessible check-in console.
  box('duel recess', 0, 5, 29.9, 18, 10, .3, dark);
  for (const x of [-8, 8]) {
    box('portal pillar', x, 5, 28.5, 1, 10, 2, pearl);
    box('portal light', x * .94, 4.5, 27.4, .12, 8, .1, cyan, false);
  }
  box('portal crown', 0, 10, 28.5, 17, .8, 2, pearl);
  for (const x of [-2.9, 2.9]) box('door leaf', x, 3.8, 29.4, 5.7, 7.6, .4, metal);
  box('door seam', 0, 3.8, 29.15, .06, 7.6, .06, cyan, false);
  sign('DUEL DECK', 0, 8.6, 27.35, 12, '#b9f5ff');
  sign('01 / ROOK TRAINING', 0, 6.6, 29.1, 8, '#e1e9e9');
  sign('EDGEFRONT ATHLETIC COMPLEX', 0, 12.4, 30.4, 23, '#e1e9e9');
  function consoleAt(x: number, z: number, accent: StandardMaterial, label: string) {
    cylinder('terminal base', x, .1, z, 2.3, .2, navy);
    box('terminal pedestal', x, .75, z, .65, 1.3, .65, metal);
    const screen = box('terminal screen', x, 1.55, z, 1.8, .12, 1, accent);
    screen.rotation.x = -.35;
    ring('interaction zone', x, .025, z, 6.6, .045, accent);
    sign(label, x, 2.4, z + .2, 3.8, '#e1e9e9');
  }
  consoleAt(0, 23, cyan, '[ E ] CHECK IN');
  // Armory: mounted original rifle silhouettes, a counter and violet lighting.
  box('armory back', -16, 3.3, 15, 12, 6.6, .6, dark);
  box('armory canopy', -16, 6.8, 13, 12.5, .45, 5, pearl);
  box('armory header light', -16, 6.5, 10.6, 12, .08, .08, violet, false);
  sign('ARMORY', -16, 5.6, 14.6, 9, '#d7caff');
  for (const x of [-20, -16, -12]) {
    box('weapon display backing', x, 3.3, 14.5, 3.5, 3, .12, navy);
    box('display rifle receiver', x, 3.4, 14.25, 1.4, .4, .25, pearl, false);
    box('display rifle barrel', x + 1, 3.45, 14.25, .7, .12, .15, metal, false);
    const mag = box('display magazine', x, 3, 14.25, .3, .6, .25, metal, false); mag.rotation.z = -.2;
    box('display rifle stock', x - 1, 3.3, 14.25, .65, .4, .2, metal, false);
    box('rack underlight', x, 1.85, 14.3, 3, .05, .1, violet, false);
  }
  box('armory counter', -16, .65, 12, 10, 1.3, 1.8, navy);
  box('armory counter lip', -16, 1.34, 12, 10.2, .1, 2, pearl);
  consoleAt(-16, 8, violet, '[ E ] BROWSE');
  sign('RECOVERY LOUNGE', 16, 5.6, 14.6, 10, '#b9f5ff');
  box('lounge backdrop', 16, 3, 15, 12, 6, .5, navy);
  for (const x of [12, 16, 20]) {
    box('bench seat', x, .55, 11, 3, .35, 1.8, pearl);
    box('bench back', x, 1.2, 11.8, 3, 1, .3, metal);
    for (const dx of [-1, 1]) box('bench leg', x + dx, .2, 11, .15, .4, 1.2, navy);
  }
  cylinder('lounge table', 16, .7, 7, 2.8, .15, pearl);
  cylinder('table leg', 16, .35, 7, .4, .7, metal);
  for (const x of [-20, 20]) for (const z of [-22, -9, 22]) {
    cylinder('planter', x, .4, z, 2.2, .8, pearl);
    cylinder('soil', x, .81, z, 1.9, .03, dark, false);
    cylinder('tree trunk', x, 1.9, z, .25, 2.2, metal, false);
    for (let i = 0; i < 6; i++) {
      const frond = MeshBuilder.CreateSphere('lobby foliage', { diameter: 1, segments: 5 }, scene);
      frond.position.set(x + Math.sin(i) * .6, 3 + (i % 2) * .4, z - 120 + Math.cos(i) * .6);
      frond.scaling.set(1.6, .5, 1.2); frond.rotation.z = Math.sin(i) * .35;
      frond.material = leaf; frond.isPickable = false;
    }
  }
  // Small route signs stay out of the central sightline.
  for (const side of [-1, 1]) {
    box('arrival bench', side * 14, .6, -18, 5, .3, 1.5, pearl);
    box('arrival bench support', side * 14, .25, -18, 4.5, .5, 1.1, navy);
    box('arrival bench back', side * 14, 1.1, -17.4, 5, .8, .2, metal);
    box('wayfinding post', side * 10, 1.5, -14, .12, 3, .12, metal);
    sign(side < 0 ? 'ARMORY / 02' : 'DUEL DECK / 01', side * 10, 3.2, -14.1, 4, '#e1e9e9');
  }
  const secrets = createLobbySecrets(scene);
  const light = new HemisphericLight('lobby daylight', new Vector3(0, 1, 0), scene);
  light.intensity = 1.2; light.groundColor = new Color3(.45, .52, .6);
  light.includedOnlyMeshes = scene.meshes.filter(mesh => !existing.has(mesh));
  return {
    secrets,
    update(time: number) {
      secrets.update(time);
      orb.position.y = 3.4 + Math.sin(time * .001) * .18;
      orbitA.rotation.set(.8, time * .00025, .3);
      orbitB.rotation.set(-.6, -time * .0002, .7);
    },
  };
}
