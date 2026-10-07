import { Color3, MeshBuilder, StandardMaterial, type Scene, type TransformNode } from '@babylonjs/core';

// Original Edgefront compact SMG: pearl armour, graphite frame and cyan rails.
export function populateUziModel(scene: Scene, root: TransformNode) {
  const pearl = new StandardMaterial('Flux pearl armour', scene);
  pearl.diffuseColor = Color3.FromHexString('#e0edf3');
  const dark = new StandardMaterial('Flux graphite frame', scene);
  dark.diffuseColor = Color3.FromHexString('#182b39');
  const cyan = new StandardMaterial('Flux cyan rail', scene);
  cyan.diffuseColor = Color3.FromHexString('#42e5ff'); cyan.emissiveColor = cyan.diffuseColor.scale(.55);
  function box(name: string, size: number[], position: number[], material: StandardMaterial) {
    const mesh = MeshBuilder.CreateBox('Flux ' + name, { width: size[0], height: size[1], depth: size[2] }, scene);
    mesh.position.set(position[0], position[1], position[2]); mesh.material = material;
    mesh.parent = root; mesh.isPickable = false; return mesh;
  }
  box('receiver', [.18, .18, .48], [0, 0, .18], pearl);
  box('lower frame', [.14, .07, .4], [0, -.11, .16], dark);
  box('grip magazine', [.105, .36, .12], [0, -.27, .07], dark).rotation.x = -.08;
  box('magazine base', [.13, .04, .15], [0, -.46, .085], pearl);
  box('barrel', [.085, .085, .2], [0, .015, .51], dark);
  box('muzzle ring', [.11, .11, .025], [0, .015, .605], cyan);
  box('top rail', [.075, .025, .37], [0, .105, .17], dark);
  box('front sight', [.028, .075, .035], [0, .15, .34], cyan);
  for (const side of [-1, 1]) {
    box('rear sight', [.024, .075, .035], [side * .043, .15, -.02], dark);
    box('side stripe', [.012, .025, .3], [side * .095, .025, .17], cyan);
    box('stock strut', [.025, .035, .2], [side * .065, -.045, -.16], dark);
  }
  box('stock pad', [.17, .12, .035], [0, -.055, -.27], pearl);
}
