import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  type Scene,
  type Node,
} from '@babylonjs/core';
import {
  characterItem,
  DEFAULT_CHARACTER,
  type CharacterAppearance,
} from './storeCatalog';
// Visible gloves and forearm plates make the selected suit visible in first person.
export function createCharacterHands(scene: Scene, parent: Node) {
  const root = new TransformNode('character first-person gloves', scene);
  root.parent = parent;
  const suit = new StandardMaterial('character glove suit', scene),
    plate = new StandardMaterial('character glove armour', scene);
  for (const [x, y, z] of [
    [0.36, -0.42, 0.49],
    [0.12, -0.44, 0.61],
  ]) {
    const hand = MeshBuilder.CreateBox(
      'character glove',
      { width: 0.12, height: 0.1, depth: 0.19 },
      scene,
    );
    hand.parent = root;
    hand.position.set(x, y, z);
    hand.material = suit;
    hand.isPickable = false;
    const cuff = MeshBuilder.CreateBox(
      'character forearm plate',
      { width: 0.13, height: 0.07, depth: 0.16 },
      scene,
    );
    cuff.parent = root;
    cuff.position.set(x, y - 0.02, z - 0.15);
    cuff.material = plate;
    cuff.isPickable = false;
  }
  function apply(appearance: CharacterAppearance = DEFAULT_CHARACTER) {
    const item = characterItem(appearance.suit) ?? characterItem('standard')!;
    suit.diffuseColor = Color3.FromHexString(item.color);
    plate.diffuseColor = Color3.FromHexString(item.accent);
  }
  apply();
  return {
    root,
    apply,
    dispose() {
      root.dispose();
      suit.dispose();
      plate.dispose();
    },
  };
}
