import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  type Scene,
} from '@babylonjs/core';
import {
  characterItem,
  DEFAULT_CHARACTER,
  readCharacterAppearance,
  type CharacterAppearance,
} from './storeCatalog';

// Sports-tech armour uses the same pearl, graphite and energy materials as guns.
export function createCharacterModel(
  scene: Scene,
  root = new TransformNode('character model', scene),
) {
  const suit = new StandardMaterial('character suit', scene),
    pearl = new StandardMaterial('character armour', scene),
    dark = new StandardMaterial('character graphite', scene),
    visor = new StandardMaterial('character visor', scene),
    energy = new StandardMaterial('character accent', scene);
  dark.diffuseColor = Color3.FromHexString('#182733');
  dark.specularColor.set(0.2, 0.24, 0.28);
  const box = (
    name: string,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material = pearl,
  ) => {
    const mesh = MeshBuilder.CreateBox(
      'character ' + name,
      { width: w, height: h, depth: d },
      scene,
    );
    mesh.parent = root;
    mesh.position.set(x, y, z);
    mesh.material = material;
    mesh.isPickable = false;
    return mesh;
  };
  const body = MeshBuilder.CreateCapsule(
    'online body',
    { height: 1.35, radius: 0.32, tessellation: 8 },
    scene,
  );
  body.parent = root;
  body.position.y = -0.18;
  body.material = suit;
  body.isPickable = false;
  const head = MeshBuilder.CreateSphere(
    'online head',
    { diameter: 0.42, segments: 8 },
    scene,
  );
  head.parent = root;
  head.position.y = 0.62;
  head.material = pearl;
  head.isPickable = false;
  const face = MeshBuilder.CreateBox(
    'character visor face',
    { width: 0.32, height: 0.13, depth: 0.05 },
    scene,
  );
  face.parent = head;
  face.position.z = 0.2;
  face.material = visor;
  face.isPickable = false;
  box('chest plate', 0.43, 0.35, 0.09, 0, 0.05, 0.28);
  box('chest energy rail', 0.27, 0.025, 0.02, 0, 0.06, 0.335, energy);
  box('belt', 0.49, 0.07, 0.12, 0, -0.36, 0.25, dark);
  for (const side of [-1, 1]) {
    box('shoulder', 0.14, 0.19, 0.28, side * 0.3, 0.2, 0);
    box('arm', 0.14, 0.43, 0.16, side * 0.33, -0.12, 0, suit);
    box('gauntlet', 0.16, 0.16, 0.2, side * 0.33, -0.32, 0.02, dark);
    box('wrist rail', 0.17, 0.025, 0.21, side * 0.33, -0.3, 0.02, energy);
    box('leg armour', 0.18, 0.28, 0.11, side * 0.13, -0.64, 0.2);
    box('boot', 0.21, 0.13, 0.28, side * 0.13, -0.91, 0.03, dark);
  }
  const antenna = box(
    'signal antenna',
    0.025,
    0.24,
    0.025,
    -0.16,
    0.91,
    0,
    dark,
  );
  const tip = box('signal tip', 0.05, 0.045, 0.05, -0.16, 1.03, 0, energy);
  const crest = box('atrium crest', 0.09, 0.12, 0.18, 0, 0.85, 0, energy);
  const halo = MeshBuilder.CreateTorus(
    'character orbital headpiece',
    { diameter: 0.55, thickness: 0.035, tessellation: 24 },
    scene,
  );
  halo.parent = root;
  halo.position.y = 0.91;
  halo.material = energy;
  halo.isPickable = false;
  let signature = '';
  function apply(value: CharacterAppearance = DEFAULT_CHARACTER) {
    const appearance = readCharacterAppearance(value),
      key = JSON.stringify(appearance);
    if (signature === key) return;
    signature = key;
    const shell = characterItem(appearance.suit)!,
      glass = characterItem(appearance.visor)!;
    suit.diffuseColor = Color3.FromHexString(shell.color);
    pearl.diffuseColor = Color3.FromHexString(shell.accent);
    visor.diffuseColor = Color3.FromHexString(glass.color);
    visor.emissiveColor = Color3.FromHexString(glass.accent).scale(0.12);
    energy.diffuseColor = Color3.FromHexString(shell.color);
    energy.emissiveColor = energy.diffuseColor.scale(0.45);
    antenna.setEnabled(appearance.gear === 'signal');
    tip.setEnabled(appearance.gear === 'signal');
    crest.setEnabled(appearance.gear === 'crest');
    halo.setEnabled(appearance.gear === 'halo');
  }
  apply();
  return {
    root,
    body,
    head,
    apply,
    dispose() {
      root.dispose();
      [suit, pearl, dark, visor, energy].forEach((material) =>
        material.dispose(),
      );
    },
  };
}
