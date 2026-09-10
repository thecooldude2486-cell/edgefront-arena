import { Color3, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';

// Original Meridian model, shared by the first-person view and shop preview.
export function populateSniperModel(scene: Scene, root: TransformNode) {
  function material(name: string, hex: string, glow = 0) {
    const surface = new StandardMaterial(`meridian ${name}`, scene);
    surface.diffuseColor = Color3.FromHexString(hex);
    surface.emissiveColor = surface.diffuseColor.scale(glow);
    surface.specularColor = new Color3(.35, .4, .42);
    return surface;
  }
  const dark = material('graphite', '#15262d');
  const shell = material('shell', '#c7dcd5');
  const green = material('common green', '#88ed8b', .35);
  const metal = material('metal', '#526a72');
  function box(name: string, x: number, y: number, z: number, width: number, height: number, depth: number, surface = dark) {
    const mesh = MeshBuilder.CreateBox(`meridian ${name}`, { width, height, depth }, scene);
    mesh.parent = root;
    mesh.position.set(x, y, z);
    mesh.material = surface;
    mesh.isPickable = false;
    return mesh;
  }
  function tube(name: string, y: number, z: number, diameter: number, length: number, surface = metal) {
    const mesh = MeshBuilder.CreateCylinder(`meridian ${name}`, { diameter, height: length, tessellation: 16 }, scene);
    mesh.parent = root;
    mesh.position.set(0, y, z);
    mesh.rotation.x = Math.PI / 2;
    mesh.material = surface;
    mesh.isPickable = false;
  }
  box('receiver', 0, 0, .08, .22, .19, .72, shell);
  box('fore-end', 0, -.015, .55, .19, .14, .42);
  box('green rail', 0, .11, .31, .12, .025, .81, green);
  box('stock spine', 0, -.035, -.47, .12, .10, .42, metal);
  box('cheek rest', 0, .055, -.48, .2, .11, .28, shell);
  box('stock heel', 0, -.055, -.72, .21, .30, .10);
  box('grip', 0, -.21, -.16, .14, .3, .17).rotation.x = -.25;
  box('magazine', 0, -.16, .18, .15, .21, .22);
  tube('long barrel', .015, 1.02, .065, .73);
  tube('muzzle brake', .015, 1.44, .105, .14, dark);
  for (const z of [-.09, .22]) box(`scope mount ${z}`, 0, .16, z, .1, .12, .08);
  tube('scope body', .25, .09, .15, .52, dark);
  tube('scope front', .25, .37, .21, .14, dark);
  tube('scope rear', .25, -.21, .19, .12, dark);
  tube('scope lens', .25, .447, .17, .01, green);
  box('scope dial', 0, .35, .1, .095, .085, .095, metal);
  box('side accent', .114, .025, .1, .008, .07, .32, green);
  root.rotation = Vector3.Zero();
}
