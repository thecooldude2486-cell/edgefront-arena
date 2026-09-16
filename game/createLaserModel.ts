import { Color3, MeshBuilder, StandardMaterial, type Scene, type TransformNode } from '@babylonjs/core';

// Original Edgefront shell, exposed green power cell and five focusing rings.
export function populateLaserModel(scene: Scene, root: TransformNode) {
  function material(name: string, hex: string, glow = 0) {
    const m = new StandardMaterial(`helion ${name}`, scene);
    m.diffuseColor = Color3.FromHexString(hex); m.emissiveColor = m.diffuseColor.scale(glow);
    m.specularColor = new Color3(.4, .5, .55); return m;
  }
  const pearl = material('ceramic', '#e5eef1');
  const dark = material('graphite', '#172b38');
  const green = material('energy', '#92f3b5', .9);
  const cyan = material('trim', '#35d5ea', .5);
  function box(name: string, x: number, y: number, z: number, w: number, h: number, d: number, mat: StandardMaterial) {
    const m = MeshBuilder.CreateBox(`helion ${name}`, { width: w, height: h, depth: d }, scene);
    m.parent = root; m.position.set(x, y, z); m.material = mat; m.isPickable = false;
    return m;
  }
  box('receiver', 0, 0, .1, .32, .3, .85, dark);
  for (const side of [-1, 1]) {
    box('shell', side * .17, .025, .06, .08, .25, .72, pearl);
    box('rail', side * .14, .04, .71, .07, .09, .66, pearl);
    box('rail light', side * .18, .06, .71, .015, .035, .56, cyan);
  }
  const grip = box('grip', 0, -.25, -.13, .14, .32, .18, dark); grip.rotation.x = -.2;
  box('stock', 0, -.04, -.49, .26, .24, .23, pearl);
  box('power cell', 0, .21, .13, .17, .13, .45, green);
  box('sight rear', 0, .24, -.22, .19, .04, .07, dark);
  for (let i = 0; i < 5; i++) {
    const ring = MeshBuilder.CreateTorus(`helion focusing ring ${i}`, { diameter: .29, thickness: .045, tessellation: 24 }, scene);
    ring.parent = root; ring.rotation.x = Math.PI / 2; ring.position.z = .42 + i * .13;
    ring.material = i % 2 ? dark : green; ring.isPickable = false;
  }
  box('emitter', 0, 0, 1.02, .12, .12, .08, green);
}
