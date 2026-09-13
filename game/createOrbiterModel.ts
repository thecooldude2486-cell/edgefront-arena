import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode } from '@babylonjs/core';

// Geometry shared by the held weapon, shop and grapple projectile.
export function populateOrbiterModel(scene: Scene, root: TransformNode) {
  function surface(name: string, hex: string, glow = 0) {
    const material = new StandardMaterial(`orbiter ${name}`, scene);
    material.diffuseColor = Color3.FromHexString(hex);
    material.emissiveColor = material.diffuseColor.scale(glow);
    material.specularColor = new Color3(.45, .5, .54);
    return material;
  }
  const graphite = surface('graphite', '#182733');
  const pearl = surface('pearl armour', '#e9f0f1');
  const metal = surface('metal', '#91a4ad');
  const cyan = surface('energy inlay', '#42e5ff', .55);
  const purple = surface('orb core', '#b45cff', .8);
  function attach(mesh: Mesh, material: StandardMaterial, y: number) {
    mesh.parent = root; mesh.material = material; mesh.isPickable = false;
    mesh.position.y = y;
    return mesh;
  }
  function shaft(name: string, y: number, height: number, top: number, bottom: number, material: StandardMaterial) {
    return attach(MeshBuilder.CreateCylinder(`orbiter ${name}`, {
      height, diameterTop: top, diameterBottom: bottom, tessellation: 12,
    }, scene), material, y);
  }
  // A tapered sceptre with a floating orb instead of the old blade head.
  shaft('sceptre grip', -.32, .64, .105, .08, graphite);
  shaft('pearl pommel', -.66, .10, .12, .06, pearl);
  shaft('pearl neck', .035, .25, .16, .105, pearl);
  shaft('orb cradle', .18, .09, .25, .14, metal);
  for (let i = 0; i < 5; i++) shaft(`grip collar ${i}`, -.15 - i * .085, .018, .112, .112, i === 0 ? cyan : metal);
  const inlay = attach(MeshBuilder.CreateBox('orbiter neck inlay', { width: .035, height: .17, depth: .014 }, scene), cyan, .025);
  inlay.position.z = -.074;
  attach(MeshBuilder.CreateSphere('orbiter floating orb', { diameter: .29, segments: 24 }, scene), purple, .42);
  const ring = attach(MeshBuilder.CreateTorus('orbiter orbital halo', { diameter: .48, thickness: .028, tessellation: 48 }, scene), pearl, .42);
  ring.rotation.set(Math.PI / 2, .35, -.35);
  const energyRing = attach(MeshBuilder.CreateTorus('orbiter energy orbit', { diameter: .39, thickness: .014, tessellation: 48 }, scene), cyan, .42);
  energyRing.rotation.set(.35, 0, -.4);
  const dot = attach(MeshBuilder.CreateSphere('orbiter orbit satellite', { diameter: .06, segments: 12 }, scene), cyan, .64);
  dot.position.x = .09;
}
