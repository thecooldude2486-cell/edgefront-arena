import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, VertexData } from '@babylonjs/core';

// Original orbital-blade melee: four swept blades, a neon ring and central core.
export function populateOrbiterModel(scene: Scene, root: TransformNode) {
  function surface(name: string, hex: string, glow = 0) {
    const material = new StandardMaterial(`orbiter ${name}`, scene);
    material.diffuseColor = Color3.FromHexString(hex);
    material.emissiveColor = material.diffuseColor.scale(glow);
    material.specularColor = new Color3(.4, .4, .45);
    return material;
  }
  const black = surface('black', '#11131c');
  const grey = surface('grey', '#646b7b');
  const white = surface('white', '#e3e6ed');
  const purple = surface('neon purple', '#b45cff', 1.7);
  function attach(mesh: Mesh, material: StandardMaterial) {
    mesh.parent = root; mesh.material = material; mesh.isPickable = false;
    return mesh;
  }
  const grip = attach(MeshBuilder.CreateCylinder('orbiter handle', { diameter: .13, height: .65, tessellation: 12 }, scene), black);
  grip.position.y = -.29;
  for (let i = 0; i < 4; i++) {
    const band = attach(MeshBuilder.CreateTorus(`orbiter grip band ${i}`, { diameter: .145, thickness: .02, tessellation: 16 }, scene), i % 2 ? grey : white);
    band.position.y = -.2 - i * .1;
  }
  const hub = attach(MeshBuilder.CreateCylinder('orbiter hub', { diameter: .42, height: .17, tessellation: 12 }, scene), black);
  hub.rotation.x = Math.PI / 2; hub.position.y = .22;
  const ring = attach(MeshBuilder.CreateTorus('orbiter neon centre ring', { diameter: .42, thickness: .045, tessellation: 48 }, scene), purple);
  ring.rotation.x = Math.PI / 2; ring.position.set(0, .22, -.105);
  const dot = attach(MeshBuilder.CreateSphere('orbiter neon centre dot', { diameter: .095, segments: 12 }, scene), purple);
  dot.position.set(0, .22, -.12);
  // Extruded polygon blades rather than rectangular blocks.
  const outline = [[.14, -.08], [.48, -.08], [.68, .12], [.75, .39], [.63, .31], [.43, .08], [.18, .09]];
  for (let blade = 0; blade < 4; blade++) {
    const positions: number[] = [], indices: number[] = [], normals: number[] = [];
    for (const z of [-.035, .035]) for (const [x, y] of outline) positions.push(x, y, z);
    const n = outline.length;
    for (let i = 1; i < n - 1; i++) indices.push(0, i + 1, i, n, n + i, n + i + 1);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; indices.push(i, j, n + j, i, n + j, n + i); }
    VertexData.ComputeNormals(positions, indices, normals);
    const data = new VertexData(); data.positions = positions; data.indices = indices; data.normals = normals;
    const mesh = attach(new Mesh(`orbiter swept blade ${blade}`, scene), blade % 2 ? white : grey);
    data.applyToMesh(mesh); mesh.rotation.z = blade * Math.PI / 2; mesh.position.y = .22;
  }
}
