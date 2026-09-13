import { Color3, MeshBuilder, Scene, StandardMaterial, TransformNode } from '@babylonjs/core';

// Original Edgefront sports blade; shared between shop and first-person view.
export function populateSwordModel(scene: Scene, root: TransformNode) {
  const material = (name: string, hex: string, glow = 0) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(hex); m.emissiveColor = m.diffuseColor.scale(glow);
    return m;
  };
  const pearl = material('sword pearl', '#e9f0f1');
  const dark = material('sword graphite', '#182733');
  const cyan = material('sword energy edge', '#42e5ff', .65);
  function part(name: string, y: number, width: number, height: number, depth: number, surface: StandardMaterial) {
    const mesh = MeshBuilder.CreateBox(name, {width, height, depth}, scene);
    mesh.parent = root; mesh.position.y = y; mesh.material = surface; mesh.isPickable = false;
    return mesh;
  }
  part('sword grip', -.3, .10, .38, .12, dark);
  part('sword pommel', -.51, .13, .06, .15, pearl);
  part('sword guard', -.07, .38, .06, .17, dark);
  part('sword guard light', -.035, .3, .018, .12, cyan);
  part('sword blade', .43, .14, .92, .045, pearl);
  const edge = part('sword edge', .43, .022, .92, .05, cyan); edge.position.x = .074;
  const tip = MeshBuilder.CreateCylinder('sword point', {height: .23, diameterTop: 0, diameterBottom: .19, tessellation: 4}, scene);
  tip.parent = root; tip.position.y = 1; tip.scaling.z = .3; tip.material = pearl; tip.isPickable = false;
}
