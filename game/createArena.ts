import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  SpotLight,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import { createArenaEnvironment } from './createArenaEnvironment';
import { mapScale } from './teams';
import { COLORS } from './config';
import { DEFAULT_MAP, type ArenaMapId } from './maps';
import { createDestructibleCover } from './createDestructibleCover';

function material(scene: Scene, name: string, hex: string, emissive = 0) {
  const value = new StandardMaterial(name, scene);
  value.diffuseColor = Color3.FromHexString(hex);
  value.specularColor = new Color3(0.16, 0.2, 0.22);
  if (emissive > 0) value.emissiveColor = value.diffuseColor.scale(emissive);
  return value;
}

function arenaBox(
  scene: Scene,
  name: string,
  position: Vector3,
  size: { width: number; height: number; depth: number },
  surface: StandardMaterial,
  rotationY = 0,
) {
  const mesh = MeshBuilder.CreateBox(name, size, scene);
  mesh.position = position;
  mesh.rotation.y = rotationY;
  mesh.material = surface;
  mesh.checkCollisions = true;
  mesh.receiveShadows = true;
  return mesh;
}

function createRamp(
  scene: Scene,
  name: string,
  position: Vector3,
  width: number,
  run: number,
  rise: number,
  direction: 1 | -1,
  surface: StandardMaterial,
) {
  const length = Math.sqrt(run * run + rise * rise);
  const ramp = arenaBox(
    scene,
    name,
    position,
    { width, height: 0.45, depth: length },
    surface,
  );
  ramp.rotation.x = direction * Math.atan2(rise, run);
  return ramp;
}

function decorativeBox(
  scene: Scene,
  name: string,
  position: Vector3,
  size: { width: number; height: number; depth: number },
  surface: StandardMaterial,
) {
  const mesh = arenaBox(scene, name, position, size, surface);
  mesh.checkCollisions = false;
  mesh.isPickable = false;
  return mesh;
}

export function createArena(scene: Scene, mapId: ArenaMapId = DEFAULT_MAP) {
  const previousMeshes = new Set(scene.meshes),
    previousLights = new Set(scene.lights);
  const dark = material(scene, 'midnight structure', COLORS.navy);
  const floor = material(scene, 'arena floor', COLORS.floor);
  const floorLight = material(scene, 'raised surfaces', COLORS.floorLight);
  const cyan = material(scene, 'cyan team trim', COLORS.cyan, 0.35);
  const coral = material(scene, 'coral team trim', COLORS.coral, 0.28);
  const lime = material(scene, 'neutral trim', COLORS.lime, 0.22);
  const concrete = material(scene, 'stadium concrete', '#102631');
  const seatCyan = material(scene, 'cyan stadium seats', '#26798b');
  const seatCoral = material(scene, 'coral stadium seats', '#a94c50');
  const flood = material(scene, 'stadium flood lights', '#e7fbff', 0.86);
  const glass = material(scene, 'safety glass', '#7bddea', 0.18);
  glass.alpha = 0.22;
  glass.backFaceCulling = false;

  // Scoreboards are decorative solid panels, with no text or score textures.
  const scoreMaterial = new StandardMaterial('blank scoreboard screen', scene);
  scoreMaterial.emissiveColor = Color3.FromHexString('#03111b');
  scoreMaterial.diffuseColor = Color3.Black();
  scoreMaterial.disableLighting = true;
  scoreMaterial.specularColor = Color3.Black();
  const scoreMeshes: Mesh[] = [];
  const coverMeshes: Mesh[] = [];
  function breakableBox(...args: Parameters<typeof arenaBox>) {
    const mesh = arenaBox(...args);
    coverMeshes.push(mesh);
    return mesh;
  }

  // A wide foundation makes the arena feel like one intentional structure.
  arenaBox(
    scene,
    'arena foundation',
    new Vector3(0, -0.65, 0),
    { width: 58, height: 1.3, depth: 44 },
    floor,
  );

  if (mapId === DEFAULT_MAP) {
    // The centre ring is a low circular stage, not a grid or voxel field.
    const centre = MeshBuilder.CreateCylinder(
      'centre combat ring',
      { diameter: 15, height: 0.32, tessellation: 32 },
      scene,
    );
    centre.position.y = 0.16;
    centre.material = floorLight;
    centre.checkCollisions = true;
    centre.receiveShadows = true;

    const centreStripe = MeshBuilder.CreateTorus(
      'centre ring trim',
      { diameter: 13.2, thickness: 0.17, tessellation: 48 },
      scene,
    );
    centreStripe.position.y = 0.36;
    centreStripe.material = lime;
  }
  // Perimeter walls curve visually around the play space using angled segments.
  // Open launch docks lead outside the foundation into a real void.
  for (const side of [-1, 1]) {
    const gap = side * 14;
    const left = gap - 2.1,
      right = gap + 2.1;
    arenaBox(
      scene,
      side === 1 ? 'north wall' : 'south wall',
      new Vector3((-24 + left) / 2, 2.2, side * 21.5),
      { width: left + 24, height: 4.4, depth: 1 },
      dark,
    );
    arenaBox(
      scene,
      `${side} outer wall right`,
      new Vector3((right + 24) / 2, 2.2, side * 21.5),
      { width: 24 - right, height: 4.4, depth: 1 },
      dark,
    );
  }
  arenaBox(
    scene,
    'east wall',
    new Vector3(28.5, 2.2, 0),
    { width: 1, height: 4.4, depth: 36 },
    dark,
  );
  arenaBox(
    scene,
    'west wall',
    new Vector3(-28.5, 2.2, 0),
    { width: 1, height: 4.4, depth: 36 },
    dark,
  );
  arenaBox(
    scene,
    'north east corner',
    new Vector3(25.7, 2.2, 19),
    { width: 1, height: 4.4, depth: 7 },
    dark,
    -Math.PI / 4,
  );
  arenaBox(
    scene,
    'north west corner',
    new Vector3(-25.7, 2.2, 19),
    { width: 1, height: 4.4, depth: 7 },
    dark,
    Math.PI / 4,
  );
  arenaBox(
    scene,
    'south east corner',
    new Vector3(25.7, 2.2, -19),
    { width: 1, height: 4.4, depth: 7 },
    dark,
    Math.PI / 4,
  );
  arenaBox(
    scene,
    'south west corner',
    new Vector3(-25.7, 2.2, -19),
    { width: 1, height: 4.4, depth: 7 },
    dark,
    -Math.PI / 4,
  );

  // Team spawn arches make both ends readable at a glance.
  for (const side of [-1, 1] as const) {
    const teamSurface = side === -1 ? cyan : coral;
    const z = side * 17.5;
    arenaBox(
      scene,
      `${side} spawn back`,
      new Vector3(0, 1.3, z + side * 1.6),
      { width: 10, height: 2.6, depth: 0.7 },
      dark,
    );
    arenaBox(
      scene,
      `${side} spawn left`,
      new Vector3(-5.1, 1.35, z),
      { width: 0.7, height: 2.7, depth: 4 },
      teamSurface,
    );
    arenaBox(
      scene,
      `${side} spawn right`,
      new Vector3(5.1, 1.35, z),
      { width: 0.7, height: 2.7, depth: 4 },
      teamSurface,
    );
    arenaBox(
      scene,
      `${side} spawn canopy`,
      new Vector3(0, 3.2, z),
      { width: 11, height: 0.5, depth: 4 },
      dark,
    );
  }

  if (mapId === DEFAULT_MAP) {
    // Paired diagonal fins provide purposeful cover around the central ring.
    const coverPositions = [
      [-8.5, -6, -0.3],
      [8.5, -6, 0.3],
      [-8.5, 6, 0.3],
      [8.5, 6, -0.3],
    ] as const;
    coverPositions.forEach(([x, z, rotation], index) => {
      breakableBox(
        scene,
        `centre cover ${index}`,
        new Vector3(x, 1.25, z),
        { width: 5.5, height: 2.5, depth: 0.7 },
        index < 2 ? cyan : coral,
        rotation,
      );
    });

    // Elevated side lanes and broad ramps give three routes through the map.
    for (const side of [-1, 1] as const) {
      const x = side * 20;
      arenaBox(
        scene,
        `${side} side platform`,
        new Vector3(x, 2.2, 0),
        { width: 7, height: 0.6, depth: 14 },
        floorLight,
      );
      // Two rail sections leave a central entrance into the spectator stands.
      for (const z of [-4.5, 4.5]) {
        arenaBox(
          scene,
          `${side} side rail outer ${z}`,
          new Vector3(x + side * 3.35, 3.1, z),
          { width: 0.35, height: 1.5, depth: 5 },
          lime,
        );
      }
      breakableBox(
        scene,
        `${side} side cover`,
        new Vector3(x, 3.4, 0),
        { width: 3.8, height: 2.1, depth: 0.65 },
        dark,
      );
      createRamp(
        scene,
        `${side} north ramp`,
        new Vector3(x, 1.05, 9.5),
        6.5,
        7,
        2.2,
        -1,
        floorLight,
      );
      createRamp(
        scene,
        `${side} south ramp`,
        new Vector3(x, 1.05, -9.5),
        6.5,
        7,
        2.2,
        1,
        floorLight,
      );
    }

    // Low centre barriers interrupt long sightlines without closing the arena.
    breakableBox(
      scene,
      'centre north barrier',
      new Vector3(0, 0.8, 7.7),
      { width: 6, height: 1.6, depth: 0.7 },
      coral,
    );
    breakableBox(
      scene,
      'centre south barrier',
      new Vector3(0, 0.8, -7.7),
      { width: 6, height: 1.6, depth: 0.7 },
      cyan,
    );
  } else {
    const box = (
      name: string,
      x: number,
      y: number,
      z: number,
      width: number,
      height: number,
      depth: number,
      breakable = false,
      surface = floorLight,
    ) => {
      const mesh = arenaBox(
        scene,
        `${mapId} ${name}`,
        new Vector3(x, y, z),
        { width, height, depth },
        surface,
      );
      if (breakable) coverMeshes.push(mesh);
      return mesh;
    };
    if (mapId === 'switchyard') {
      for (const x of [-8, 8])
        for (const z of [-6, 6]) {
          box(
            `shelter ${x} ${z}`,
            x,
            1.2,
            z,
            7,
            2.4,
            0.8,
            true,
            x < 0 ? cyan : coral,
          );
          box(
            `route marker ${x} ${z}`,
            x,
            0.06,
            z + Math.sign(z) * 1.2,
            7,
            0.12,
            0.15,
            false,
            lime,
          ).checkCollisions = false;
        }
      box('low central island', 0, 0.55, 0, 5, 1.1, 5, true, dark);
      for (const x of [-19, 19])
        box(`outer safety wall ${x}`, x, 1.1, 0, 0.8, 2.2, 9, true, dark);
    } else if (mapId === 'skyline') {
      box('lower combat deck', 0, 0.95, 0, 9, 1.9, 12);
      for (const z of [-9.5, 9.5])
        createRamp(
          scene,
          `skyline central ramp ${z}`,
          new Vector3(0, 0.95, z),
          8,
          7,
          1.9,
          z < 0 ? -1 : 1,
          floorLight,
        );
      for (const x of [-15, 15]) {
        box(`high flank ${x}`, x, 4.5, 0, 6, 0.6, 10);
        for (const z of [-9.5, 9.5])
          createRamp(
            scene,
            `skyline flank ramp ${x} ${z}`,
            new Vector3(x, 2.2, z),
            5.5,
            9,
            4.8,
            z < 0 ? -1 : 1,
            floorLight,
          );
        box(
          `high cover ${x}`,
          x,
          5.4,
          0,
          2.8,
          1.2,
          0.7,
          true,
          x < 0 ? cyan : coral,
        );
      }
      box('skybridge', 0, 4.6, 0, 30, 0.4, 3);
      for (const z of [-1.7, 1.7])
        box(`bridge edge ${z}`, 0, 4.92, z, 30, 0.22, 0.18, false, lime);
      for (const x of [-6, 6])
        box(
          `lower shelter ${x}`,
          x,
          0.85,
          5 * Math.sign(x),
          2,
          1.7,
          2,
          true,
          dark,
        );
    } else {
      for (const x of [-18, 18])
        for (const z of [-7, 7]) {
          box(`firing deck ${x} ${z}`, x, 2.2, z, 6, 0.6, 5);
          createRamp(
            scene,
            `crossfire ramp ${x} ${z}`,
            new Vector3(x, 1, z + Math.sign(z) * 5.5),
            5.5,
            6,
            2.5,
            z < 0 ? -1 : 1,
            floorLight,
          );
          box(
            `deck cover ${x} ${z}`,
            x,
            2.95,
            z,
            2.2,
            0.9,
            0.5,
            true,
            x < 0 ? cyan : coral,
          );
        }
      for (const x of [-8, 8])
        for (const z of [-6, 6])
          box(`cover island ${x} ${z}`, x, 0.45, z, 2, 0.9, 2, true, dark);
      for (const x of [-12, 12])
        box(`sightline column ${x}`, x, 2.1, 0, 1.5, 4.2, 1.5, false, lime);
      const ring = MeshBuilder.CreateTorus(
        'crossfire centre target',
        { diameter: 11, thickness: 0.15, tessellation: 40 },
        scene,
      );
      ring.position.y = 0.06;
      ring.material = coral;
      ring.isPickable = false;
    }
  }
  // Thin floor guides act like court markings and do not block movement.
  for (const x of [-12, 12]) {
    const guide = arenaBox(
      scene,
      `lane guide ${x}`,
      new Vector3(x, 0.025, 0),
      { width: 0.12, height: 0.05, depth: 33 },
      lime,
    );
    guide.checkCollisions = false;
  }

  // Circular team pads and stadium light pylons finish the sports-arena identity.
  for (const side of [-1, 1] as const) {
    const pad = MeshBuilder.CreateCylinder(
      `${side} spawn pad`,
      { diameter: 8, height: 0.08, tessellation: 28 },
      scene,
    );
    pad.position = new Vector3(0, 0.045, side * 17);
    pad.material = side === -1 ? cyan : coral;
    pad.isPickable = false;

    for (const x of [-24, 24]) {
      const z = side * 15.5;
      const pylon = MeshBuilder.CreateCylinder(
        `${side} ${x} light pylon`,
        { diameter: 0.95, height: 8.5, tessellation: 8 },
        scene,
      );
      pylon.position = new Vector3(x, 4.25, z);
      pylon.material = dark;
      pylon.checkCollisions = true;

      const crown = MeshBuilder.CreateCylinder(
        `${side} ${x} pylon crown`,
        { diameter: 1.5, height: 0.32, tessellation: 8 },
        scene,
      );
      crown.position = new Vector3(x, 8.2, z);
      crown.material = side === -1 ? cyan : coral;
      crown.isPickable = false;

      const beacon = arenaBox(
        scene,
        `${side} ${x} beacon`,
        new Vector3(x, 8.72, z),
        { width: 0.16, height: 0.85, depth: 0.16 },
        lime,
      );
      beacon.checkCollisions = false;
      beacon.isPickable = false;
    }
  }

  // Slim wall ribbons repeat the two team colours without adding more cover.
  for (const side of [-1, 1] as const) {
    const ribbon = arenaBox(
      scene,
      `${side} end light ribbon`,
      new Vector3(0, 3.65, side * 20.94),
      { width: 32, height: 0.12, depth: 0.08 },
      side === -1 ? cyan : coral,
    );
    ribbon.checkCollisions = false;
    ribbon.isPickable = false;
  }

  // Five-tier grandstands sit behind the elevated side lanes. Their stepped
  // decks are solid and walkable; seats stay non-colliding so they never snag
  // the player while exploring the spectator area.
  const seatZPositions = [
    -15, -13.2, -11.4, -9.6, -7.8, -6, -4.2, 4.2, 6, 7.8, 9.6, 11.4, 13.2, 15,
  ];

  for (const side of [-1, 1] as const) {
    const seatSurface = side === -1 ? seatCyan : seatCoral;
    const teamSurface = side === -1 ? cyan : coral;

    for (let tier = 0; tier < 5; tier += 1) {
      const x = side * (24.05 + tier * 0.8);
      const deckY = 2.7 + tier * 0.58;
      const tierDeck = arenaBox(
        scene,
        `${side} grandstand tier ${tier}`,
        new Vector3(x, deckY, 0),
        { width: 0.95, height: 0.45, depth: 34 },
        concrete,
      );
      tierDeck.isPickable = false;

      seatZPositions.forEach((z, seatIndex) => {
        const alternateSurface =
          (seatIndex + tier) % 5 === 0 ? lime : seatSurface;
        decorativeBox(
          scene,
          `${side} tier ${tier} seat ${seatIndex} base`,
          new Vector3(x - side * 0.08, deckY + 0.29, z),
          { width: 0.5, height: 0.12, depth: 0.72 },
          alternateSurface,
        );
        decorativeBox(
          scene,
          `${side} tier ${tier} seat ${seatIndex} back`,
          new Vector3(x + side * 0.22, deckY + 0.58, z),
          { width: 0.12, height: 0.64, depth: 0.72 },
          alternateSurface,
        );
      });
    }

    // A broad centre aisle joins the side platform to the top row. Its gentle
    // incline is easier to climb than jumping up the individual tiers.
    const standRun = 5.05;
    const standRise = 2.72;
    const standRampLength = Math.sqrt(
      standRun * standRun + standRise * standRise,
    );
    const standRamp = arenaBox(
      scene,
      `${side} spectator access ramp`,
      new Vector3(side * 25.15, 3.86, 0),
      { width: standRampLength, height: 0.28, depth: 2.7 },
      floorLight,
    );
    standRamp.rotation.z = side * Math.atan2(standRise, standRun);
    standRamp.isPickable = false;
    for (const z of [-1.43, 1.43]) {
      const aisleTrim = decorativeBox(
        scene,
        `${side} spectator aisle trim ${z}`,
        new Vector3(side * 25.15, 4.04, z),
        { width: standRampLength, height: 0.1, depth: 0.12 },
        teamSurface,
      );
      aisleTrim.rotation.z = side * Math.atan2(standRise, standRun);
    }

    // The original perimeter wall was only court-height. This upper barrier
    // safely encloses the newly walkable top rows.
    const upperBoundary = arenaBox(
      scene,
      `${side} upper spectator boundary`,
      new Vector3(side * 28.42, 6.05, 0),
      { width: 0.42, height: 3.3, depth: 36 },
      dark,
    );
    upperBoundary.isPickable = false;

    // A central player tunnel and team-colour frame break up each stand.
    decorativeBox(
      scene,
      `${side} spectator tunnel`,
      new Vector3(side * 27.65, 3.65, 0),
      { width: 0.35, height: 2.65, depth: 5.6 },
      dark,
    );
    for (const z of [-2.9, 2.9]) {
      decorativeBox(
        scene,
        `${side} tunnel frame ${z}`,
        new Vector3(side * 27.38, 3.7, z),
        { width: 0.28, height: 2.9, depth: 0.22 },
        teamSurface,
      );
    }
    decorativeBox(
      scene,
      `${side} tunnel header`,
      new Vector3(side * 27.4, 5.12, 0),
      { width: 0.3, height: 0.24, depth: 6 },
      teamSurface,
    );

    // Transparent rink-style safety glass separates spectators from combat.
    for (const z of [-12, -7.2, 7.2, 12]) {
      decorativeBox(
        scene,
        `${side} safety glass ${z}`,
        new Vector3(side * 23.62, 4.05, z),
        { width: 0.12, height: 1.3, depth: 4.35 },
        glass,
      );
    }

    // A deep roof canopy, light banks, and an illuminated fascia frame the bowl.
    const canopy = decorativeBox(
      scene,
      `${side} grandstand canopy`,
      new Vector3(side * 26, 8.3, 0),
      { width: 6.2, height: 0.42, depth: 41 },
      dark,
    );
    canopy.rotation.z = side * 0.055;
    decorativeBox(
      scene,
      `${side} upper fascia`,
      new Vector3(side * 23.35, 7.52, 0),
      { width: 0.2, height: 0.28, depth: 34 },
      teamSurface,
    );

    for (const z of [-13, -6.5, 0, 6.5, 13]) {
      decorativeBox(
        scene,
        `${side} flood bank ${z}`,
        new Vector3(side * 23.15, 7.78, z),
        { width: 0.22, height: 0.42, depth: 3.7 },
        flood,
      );
    }
  }

  // End-zone scoreboards and banners make both spawn ends read like team bays.
  for (const side of [-1, 1] as const) {
    const teamSurface = side === -1 ? cyan : coral;
    decorativeBox(
      scene,
      `${side} scoreboard frame`,
      new Vector3(0, 6.35, side * 21.05),
      { width: 14, height: 3.25, depth: 0.5 },
      concrete,
    );
    const blankScreen = decorativeBox(
      scene,
      `${side} scoreboard screen`,
      new Vector3(0, 6.35, side * 20.76),
      { width: 12.5, height: 2.1, depth: 0.08 },
      scoreMaterial,
    );
    scoreMeshes.push(blankScreen);
    decorativeBox(
      scene,
      `${side} scoreboard centre trim`,
      new Vector3(0, 6.35, side * 20.65),
      { width: 0.18, height: 1.55, depth: 0.07 },
      lime,
    );
    decorativeBox(
      scene,
      `${side} scoreboard team accent`,
      new Vector3(side * 3.1, 6.35, side * 20.65),
      { width: 4.7, height: 0.18, depth: 0.07 },
      teamSurface,
    );

    // Restore the original stadium banners as decorative frames.
    for (const x of [-20, -16, 16, 20]) {
      decorativeBox(
        scene,
        `${side} hanging banner ${x}`,
        new Vector3(x, 5.9, side * 21.02),
        { width: 2.5, height: 3.8, depth: 0.16 },
        x < 0 ? cyan : coral,
      );
      decorativeBox(
        scene,
        `${side} banner inset ${x}`,
        new Vector3(x, 5.9, side * 20.9),
        { width: 1.15, height: 2.55, depth: 0.08 },
        dark,
      );
    }
  }

  // Four soft stadium spots brighten the court without changing visibility or AI.
  for (const x of [-22, 22]) {
    for (const z of [-13, 13]) {
      const lightPosition = new Vector3(x, 7.6, z);
      const spotlight = new SpotLight(
        `stadium spotlight ${x} ${z}`,
        lightPosition,
        Vector3.Zero().subtract(lightPosition).normalize(),
        Math.PI / 2.7,
        2,
        scene,
      );
      spotlight.diffuse = Color3.FromHexString(x < 0 ? '#8feaf6' : '#ffd0c8');
      spotlight.intensity = 0.36;
      spotlight.range = 58;
    }
  }

  // A compact suspended display gives the open roof a strong arena focal point.
  const overheadCore = MeshBuilder.CreateCylinder(
    'overhead display core',
    { diameter: 5.2, height: 2.1, tessellation: 8 },
    scene,
  );
  overheadCore.position.y = 10.2;
  overheadCore.material = concrete;
  overheadCore.isPickable = false;
  for (const [x, z, width, depth] of [
    [0, -2.5, 3.8, 0.12],
    [0, 2.5, 3.8, 0.12],
    [-2.5, 0, 0.12, 3.8],
    [2.5, 0, 0.12, 3.8],
  ] as const) {
    decorativeBox(
      scene,
      `overhead display panel ${x} ${z}`,
      new Vector3(x, 10.2, z),
      { width, height: 1.25, depth },
      x + z < 0 ? cyan : coral,
    );
    // Blank inset inside the original coloured frame. No text texture.
    const blankPanel = decorativeBox(
      scene,
      `overhead blank screen ${x} ${z}`,
      new Vector3(
        x === 0 ? 0 : Math.sign(x) * 2.62,
        10.2,
        z === 0 ? 0 : Math.sign(z) * 2.62,
      ),
      {
        width: x === 0 ? 3.55 : 0.04,
        height: 1.08,
        depth: z === 0 ? 3.55 : 0.04,
      },
      scoreMaterial,
    );
    scoreMeshes.push(blankPanel);
  }
  decorativeBox(
    scene,
    'overhead display halo',
    new Vector3(0, 8.98, 0),
    { width: 5.8, height: 0.14, depth: 5.8 },
    lime,
  );

  const arenaMaterials = {
    dark,
    floor,
    floorLight,
    cyan,
    coral,
    lime,
    concrete,
    seatCyan,
    seatCoral,
    flood,
    glass,
    scoreMaterial,
  };
  if (['foundry', 'relay', 'harbor', 'citadel'].includes(mapId)) {
    for (const x of [-14, -7, 7, 14])
      for (const z of [-9, 0, 9]) {
        const height =
          mapId === 'citadel' ? 2.8 : mapId === 'relay' ? 2.1 : 1.6;
        const block = arenaBox(
          scene,
          `${mapId} team cover`,
          new Vector3(x, height / 2, z + (x < 0 ? -2 : 2)),
          { width: 3.5, height, depth: 1.2 },
          floorLight,
        );
        coverMeshes.push(block);
      }
    if (mapId === 'relay' || mapId === 'citadel')
      for (const x of [-16, 16]) {
        arenaBox(
          scene,
          `${mapId} command deck`,
          new Vector3(x, 1.8, 0),
          { width: 5, height: 0.4, depth: 6 },
          floorLight,
        );
        createRamp(
          scene,
          `${mapId} command ramp`,
          new Vector3(x, 0.85, 6),
          4,
          6,
          1.7,
          1,
          floorLight,
        );
      }
    if (mapId === 'harbor')
      for (const x of [-9, 9])
        for (const z of [-13, 13])
          arenaBox(
            scene,
            'harbor cargo stack',
            new Vector3(x, 1.8, z),
            { width: 4, height: 3.6, depth: 3 },
            concrete,
          );
    const scale = mapScale(mapId);
    scene.meshes
      .filter((m) => !previousMeshes.has(m) && !m.parent)
      .forEach((m) => {
        m.position.x *= scale;
        m.position.z *= scale;
        m.scaling.x *= scale;
        m.scaling.z *= scale;
      });
    scene.lights
      .filter((l) => !previousLights.has(l))
      .forEach((l) => {
        if ('position' in l) {
          const p = (l as SpotLight).position;
          p.x *= scale;
          p.z *= scale;
        }
      });
  }
  const cover = createDestructibleCover(scene, coverMeshes);
  const environment = createArenaEnvironment(scene, mapId);
  const meshes = scene.meshes.filter((mesh) => !previousMeshes.has(mesh));
  const lights = scene.lights.filter((light) => !previousLights.has(light));
  return {
    mapId,
    environment,
    cover,
    scoreMeshes,
    materials: arenaMaterials,
    meshes,
    dispose() {
      environment.dispose();
      cover.dispose();
      meshes.forEach((mesh) => mesh.dispose());
      lights.forEach((light) => light.dispose());
      Object.values(arenaMaterials).forEach((surface) => surface.dispose());
    },
  };
}
