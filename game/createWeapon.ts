import {
  AbstractMesh,
  Color3,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  TransformNode,
  UniversalCamera,
  Vector3,
} from '@babylonjs/core';
import { COLORS, PISTOL, WEAPON } from './config';
import { createWeaponAmmo } from './createWeaponAmmo';
import type { WeaponHit, WeaponId, PrimaryWeaponId } from './weaponDefinitions';
import { WEAPON_DEFINITIONS } from './weaponDefinitions';
import { populateSniperModel } from './createSniperModel';
import { populateLauncherModel } from './createRockets';
import { populateGrenadeModel } from './createGrenade';
import { populateSwordModel } from './createSwordModel';
import { populateOrbiterModel } from './createOrbiterModel';

type WeaponCallbacks = {
  onFireRocket?: (origin: Vector3, direction: Vector3) => void;
  onThrowGrenade?: (origin: Vector3, direction: Vector3) => void;
  getMeleeWeapon?: () => 'sword' | 'orbiter';
  getPrimaryWeapon?: () => PrimaryWeaponId;
  canUseWeapon?: (weaponId: WeaponId) => boolean;
  onScopeChange?: (scoped: boolean) => void;
  onAmmoChange: (
    ammo: number,
    reserveAmmo: number,
    reloading: boolean,
    weaponId: WeaponId,
    weaponName: string,
    fireMode: string,
  ) => void;
  onImpact: (mesh: AbstractMesh, weaponId: WeaponId) => WeaponHit;
  onHitMarker: (kind: Exclude<WeaponHit, 'none'>) => void;
};

function weaponMaterial(scene: Scene, name: string, hex: string, emissive = 0) {
  const value = new StandardMaterial(name, scene);
  value.diffuseColor = Color3.FromHexString(hex);
  value.specularColor = new Color3(0.45, 0.5, 0.54);
  value.emissiveColor = value.diffuseColor.scale(emissive);
  return value;
}

function createShotSound() {
  let context: AudioContext | null = null;

  function ensureContext() {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    return context;
  }

  return {
    playSwing() {
      const audio = ensureContext();
      const now = audio.currentTime;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(480, now);
      oscillator.frequency.exponentialRampToValueAtTime(90, now + .18);
      gain.gain.setValueAtTime(.06, now);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .2);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now); oscillator.stop(now + .21);
    },
    playShot() {
      const audio = ensureContext();
      const now = audio.currentTime;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(145, now);
      oscillator.frequency.exponentialRampToValueAtTime(58, now + 0.065);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.11, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.085);
    },
    playReload() {
      const audio = ensureContext();
      const now = audio.currentTime;
      for (const [delay, frequency] of [
        [0, 260],
        [0.22, 390],
      ] as const) {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.07, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.055);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(now + delay);
        oscillator.stop(now + delay + 0.06);
      }
    },
    dispose() {
      void context?.close();
    },
  };
}

// Shared geometry only: the shop reuses these models without shooting or ammo logic.
export function populateWeaponModels(scene: Scene, root: TransformNode, pistolRoot: TransformNode) {
  const graphite = weaponMaterial(scene, 'kestrel graphite', '#182733');
  const shell = weaponMaterial(scene, 'kestrel pearl shell', '#e9f0f1');
  const metal = weaponMaterial(scene, 'kestrel metal', '#91a4ad');
  const cyan = weaponMaterial(scene, 'kestrel energy rail', COLORS.cyan, 0.45);
  const dark = weaponMaterial(scene, 'kestrel grip', '#0b1118');

  function box(
    name: string,
    position: Vector3,
    size: { width: number; height: number; depth: number },
    surface = graphite,
  ) {
    const mesh = MeshBuilder.CreateBox(name, size, scene);
    mesh.parent = root;
    mesh.position = position;
    mesh.material = surface;
    mesh.isPickable = false;
    return mesh;
  }

  // Original Kestrel AR: a bright, angular sports rifle with a cyan energy optic.
  box(
    'kestrel receiver core',
    new Vector3(0, -0.015, 0.08),
    { width: 0.23, height: 0.2, depth: 0.72 },
    graphite,
  );
  box(
    'kestrel pearl receiver',
    new Vector3(0, 0.045, 0.08),
    { width: 0.3, height: 0.2, depth: 0.62 },
    shell,
  );
  box(
    'kestrel upper rail',
    new Vector3(0, 0.16, 0.16),
    { width: 0.13, height: 0.045, depth: 0.54 },
    cyan,
  );
  box(
    'kestrel stock core',
    new Vector3(0.01, -0.01, -0.42),
    { width: 0.2, height: 0.18, depth: 0.3 },
    dark,
  );
  box(
    'kestrel pearl stock',
    new Vector3(0, 0.055, -0.43),
    { width: 0.28, height: 0.16, depth: 0.33 },
    shell,
  );
  box(
    'kestrel stock heel',
    new Vector3(0, -0.035, -0.58),
    { width: 0.25, height: 0.28, depth: 0.08 },
    graphite,
  );
  const grip = box(
    'kestrel grip',
    new Vector3(0, -0.22, -0.06),
    { width: 0.14, height: 0.34, depth: 0.18 },
    dark,
  );
  grip.rotation.x = -0.22;
  const magazine = box(
    'kestrel magazine',
    new Vector3(0, -0.205, 0.19),
    { width: 0.17, height: 0.3, depth: 0.2 },
    graphite,
  );
  magazine.rotation.x = 0.08;
  box(
    'kestrel handguard',
    new Vector3(0, 0.005, 0.48),
    { width: 0.27, height: 0.2, depth: 0.38 },
    shell,
  );
  box(
    'kestrel handguard inset',
    new Vector3(0, 0.0, 0.55),
    { width: 0.29, height: 0.07, depth: 0.2 },
    metal,
  );

  const optic = MeshBuilder.CreateTorus(
    'kestrel halo optic',
    { diameter: 0.24, thickness: 0.035, tessellation: 20 },
    scene,
  );
  optic.parent = root;
  optic.position = new Vector3(0, 0.22, 0.06);
  optic.rotation.x = Math.PI / 2;
  optic.material = cyan;
  optic.isPickable = false;
  box(
    'kestrel optic base',
    new Vector3(0, 0.175, 0.06),
    { width: 0.15, height: 0.07, depth: 0.12 },
    graphite,
  );
  const opticDot = MeshBuilder.CreateSphere(
    'kestrel optic dot',
    { diameter: 0.022, segments: 6 },
    scene,
  );
  opticDot.parent = root;
  opticDot.position = new Vector3(0, 0.22, 0.065);
  opticDot.material = cyan;
  opticDot.isPickable = false;

  const barrel = MeshBuilder.CreateCylinder(
    'kestrel barrel',
    { diameter: 0.075, height: 0.43, tessellation: 12 },
    scene,
  );
  barrel.parent = root;
  barrel.position = new Vector3(0, 0.02, 0.77);
  barrel.rotation.x = Math.PI / 2;
  barrel.material = dark;
  barrel.isPickable = false;

  const muzzle = MeshBuilder.CreateCylinder(
    'kestrel muzzle brake',
    { diameter: 0.12, height: 0.14, tessellation: 10 },
    scene,
  );
  muzzle.parent = root;
  muzzle.position = new Vector3(0, 0.02, 1.0);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.material = graphite;
  muzzle.isPickable = false;

  // Original Vesper Pistol: a compact pearl-and-graphite secondary.

  function pistolBox(
    name: string,
    position: Vector3,
    size: { width: number; height: number; depth: number },
    surface = graphite,
  ) {
    const mesh = MeshBuilder.CreateBox(name, size, scene);
    mesh.parent = pistolRoot;
    mesh.position = position;
    mesh.material = surface;
    mesh.isPickable = false;
    return mesh;
  }

  pistolBox(
    'vesper slide',
    new Vector3(0, 0.05, 0.18),
    { width: 0.22, height: 0.16, depth: 0.58 },
    shell,
  );
  pistolBox(
    'vesper slide inset',
    new Vector3(0, 0.075, 0.24),
    { width: 0.24, height: 0.055, depth: 0.28 },
    metal,
  );
  pistolBox(
    'vesper frame',
    new Vector3(0, -0.055, 0.08),
    { width: 0.2, height: 0.12, depth: 0.36 },
    graphite,
  );
  const pistolGrip = pistolBox(
    'vesper grip',
    new Vector3(0, -0.25, -0.015),
    { width: 0.16, height: 0.38, depth: 0.2 },
    dark,
  );
  pistolGrip.rotation.x = -0.16;
  pistolBox(
    'vesper sight',
    new Vector3(0, 0.155, 0.12),
    { width: 0.06, height: 0.055, depth: 0.09 },
    cyan,
  );
  const pistolBarrel = MeshBuilder.CreateCylinder(
    'vesper barrel',
    { diameter: 0.07, height: 0.18, tessellation: 10 },
    scene,
  );
  pistolBarrel.parent = pistolRoot;
  pistolBarrel.position = new Vector3(0, 0.045, 0.54);
  pistolBarrel.rotation.x = Math.PI / 2;
  pistolBarrel.material = dark;
  pistolBarrel.isPickable = false;

}

export function createWeapon(
  scene: Scene,
  camera: UniversalCamera,
  canvas: HTMLCanvasElement,
  callbacks: WeaponCallbacks,
) {
  const root = new TransformNode('kestrel rifle root', scene);
  root.parent = camera;
  root.position = new Vector3(0.46, -0.38, 0.88);
  root.rotation = new Vector3(-0.02, -0.045, 0);
  const hipPosition = root.position.clone();
  const hipRotation = root.rotation.clone();
  // This position lines the optic up with the centre of the screen.
  const aimPosition = new Vector3(0, -0.22, 0.56);
  const aimRotation = Vector3.Zero();
  const sprintPosition = new Vector3(0.34, -0.5, 0.72);
  const sprintRotation = new Vector3(0.14, -0.12, 0.08);
  const pistolHipPosition = new Vector3(0.38, -0.34, 0.72);
  const pistolHipRotation = new Vector3(-0.015, -0.035, 0);
  const pistolAimPosition = new Vector3(0, -0.155, 0.5);
  const pistolAimRotation = Vector3.Zero();
  const pistolSprintPosition = new Vector3(0.3, -0.46, 0.64);
  const pistolSprintRotation = new Vector3(0.12, -0.1, 0.07);

  const pistolRoot = new TransformNode('vesper pistol root', scene);
  pistolRoot.parent = camera;
  pistolRoot.position.copyFrom(pistolHipPosition);
  pistolRoot.rotation.copyFrom(pistolHipRotation);
  populateWeaponModels(scene, root, pistolRoot);
  pistolRoot.setEnabled(false);
  const sniperRoot = new TransformNode('meridian sniper root', scene);
  sniperRoot.parent = camera;
  populateSniperModel(scene, sniperRoot);
  sniperRoot.position.set(.42, -.38, .88);
  sniperRoot.setEnabled(false);
  const rocketRoot = new TransformNode('comet launcher root', scene);
  rocketRoot.parent = camera; populateLauncherModel(scene, rocketRoot); rocketRoot.setEnabled(false);
  const grenadeRoot = new TransformNode('grenade utility root', scene);
  grenadeRoot.parent = camera; populateGrenadeModel(scene, grenadeRoot); grenadeRoot.setEnabled(false);
  const swordRoot = new TransformNode('sword melee root', scene);
  swordRoot.parent = camera;
  populateSwordModel(scene, swordRoot);
  swordRoot.setEnabled(false);
  const orbiterRoot = new TransformNode('orbiter melee root', scene);
  orbiterRoot.parent = camera;
  populateOrbiterModel(scene, orbiterRoot);
  orbiterRoot.position.set(.55, -.4, 1.1);
  orbiterRoot.setEnabled(false);

  const flash = MeshBuilder.CreateSphere(
    'muzzle flash',
    { diameter: 0.18, segments: 6 },
    scene,
  );
  flash.parent = root;
  flash.position = new Vector3(0, 0.02, 1.14);
  flash.scaling = new Vector3(0.75, 0.75, 1.7);
  flash.material = weaponMaterial(scene, 'muzzle glow', '#fff2a8', 1);
  flash.isPickable = false;
  flash.setEnabled(false);

  const flashLight = new PointLight(
    'muzzle light',
    new Vector3(0, 0.02, 1.14),
    scene,
  );
  flashLight.parent = root;
  flashLight.diffuse = Color3.FromHexString('#ffd987');
  flashLight.intensity = 0;
  flashLight.range = 5;

  const impactMaterial = weaponMaterial(scene, 'impact spark', '#dffaff', 0.9);
  const audio = createShotSound();
  const weaponStats = {
    rocketLauncher: WEAPON_DEFINITIONS.rocketLauncher,
    grenade: WEAPON_DEFINITIONS.grenade,
    assaultRifle: WEAPON,
    pistol: PISTOL,
    sniper: WEAPON_DEFINITIONS.sniper,
    sword: WEAPON_DEFINITIONS.sword,
    orbiter: WEAPON_DEFINITIONS.orbiter,
  };
  const weaponRoots = {
    rocketLauncher: rocketRoot,
    grenade: grenadeRoot,
    assaultRifle: root,
    pistol: pistolRoot,
    sniper: sniperRoot,
    sword: swordRoot,
    orbiter: orbiterRoot,
  };
  const weaponPoses = {
    rocketLauncher: { hipPosition: new Vector3(.44, -.35, .85), hipRotation: Vector3.Zero(), aimPosition: new Vector3(0, -.24, .65), aimRotation: Vector3.Zero(), sprintPosition: new Vector3(.45, -.5, .8), sprintRotation: new Vector3(.1, -.1, .1), muzzlePosition: new Vector3(0, 0, .67) },
    grenade: { hipPosition: new Vector3(.4, -.3, .7), hipRotation: Vector3.Zero(), aimPosition: new Vector3(.4, -.3, .7), aimRotation: Vector3.Zero(), sprintPosition: new Vector3(.4, -.4, .6), sprintRotation: Vector3.Zero(), muzzlePosition: Vector3.Zero() },
    sword: {
      hipPosition: new Vector3(.55, -.4, 1.1), hipRotation: new Vector3(.1, -.2, -.25),
      aimPosition: new Vector3(.55, -.4, 1.1), aimRotation: new Vector3(.1, -.2, -.25),
      sprintPosition: new Vector3(.6, -.5, 1), sprintRotation: new Vector3(.2, -.3, -.4), muzzlePosition: Vector3.Zero(),
    },
    orbiter: {
      hipPosition: new Vector3(.55, -.4, 1.1), hipRotation: new Vector3(.1, -.2, -.25),
      aimPosition: new Vector3(.55, -.4, 1.1), aimRotation: new Vector3(.1, -.2, -.25),
      sprintPosition: new Vector3(.6, -.5, 1.0), sprintRotation: new Vector3(.2, -.3, -.4),
      muzzlePosition: Vector3.Zero(),
    },
    sniper: {
      hipPosition: new Vector3(.42, -.38, .88),
      hipRotation: new Vector3(-.02, -.045, 0),
      aimPosition: new Vector3(0, -.25, .58),
      aimRotation: Vector3.Zero(),
      sprintPosition: new Vector3(.34, -.5, .72),
      sprintRotation: new Vector3(.14, -.12, .08),
      muzzlePosition: new Vector3(0, .015, 1.56),
    },
    assaultRifle: {
      hipPosition,
      hipRotation,
      aimPosition,
      aimRotation,
      sprintPosition,
      sprintRotation,
      muzzlePosition: new Vector3(0, 0.02, 1.14),
    },
    pistol: {
      hipPosition: pistolHipPosition,
      hipRotation: pistolHipRotation,
      aimPosition: pistolAimPosition,
      aimRotation: pistolAimRotation,
      sprintPosition: pistolSprintPosition,
      sprintRotation: pistolSprintRotation,
      muzzlePosition: new Vector3(0, 0.045, 0.67),
    },
  };
  const ammoSupplies = {
    rocketLauncher: createWeaponAmmo(1, 5),
    grenade: createWeaponAmmo(1, 0),
    assaultRifle: createWeaponAmmo(WEAPON.magazineSize, WEAPON.reserveAmmo),
    pistol: createWeaponAmmo(PISTOL.magazineSize, PISTOL.reserveAmmo),
    sniper: createWeaponAmmo(WEAPON_DEFINITIONS.sniper.magazineSize, WEAPON_DEFINITIONS.sniper.reserveAmmo),
    sword: createWeaponAmmo(0, 0),
    orbiter: createWeaponAmmo(0, 0),
  };
  const lastShotAt: Record<WeaponId, number> = {
    rocketLauncher: -Infinity,
    grenade: -Infinity,
    assaultRifle: -Infinity,
    pistol: -Infinity,
    sniper: -Infinity,
    sword: -Infinity,
    orbiter: -Infinity,
  };
  let currentWeaponId: WeaponId = 'assaultRifle';
  let firing = false;
  let pointerAiming = false;
  let keyboardAiming = false;
  let sprintPoseActive = false;
  let reloading = false;
  let reloadTimer: ReturnType<typeof setTimeout> | null = null;
  let flashTimer: ReturnType<typeof setTimeout> | null = null;
  let active = true;
  let scoped = false;
  let swingAt = -Infinity;
  function setScoped(next: boolean) {
    if (scoped === next) return;
    scoped = next;
    callbacks.onScopeChange?.(next);
  }

  function updateHud(isReloading = reloading) {
    const ammo = ammoSupplies[currentWeaponId].state;
    const stats = weaponStats[currentWeaponId];
    callbacks.onAmmoChange(
      ammo.magazine,
      ammo.reserve,
      isReloading,
      currentWeaponId,
      stats.name,
      stats.fireMode,
    );
  }

  function cancelReload() {
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = null;
    reloading = false;
  }

  function switchWeapon(nextWeaponId: WeaponId) {
    if (nextWeaponId === currentWeaponId || !active) return;
    if (nextWeaponId !== 'grenade' && nextWeaponId !== 'pistol' && nextWeaponId !== (callbacks.getMeleeWeapon?.() ?? 'orbiter') && nextWeaponId !== primaryWeapon()) return;
    if (callbacks.canUseWeapon && !callbacks.canUseWeapon(nextWeaponId)) return;
    setScoped(false);
    cancelReload();
    swingAt = -Infinity;
    firing = false;
    pointerAiming = false;
    keyboardAiming = false;
    weaponRoots[currentWeaponId].setEnabled(false);
    currentWeaponId = nextWeaponId;
    weaponRoots[currentWeaponId].setEnabled(true);
    updateHud(false);
  }

  updateHud(false);

  // Both rifles share slot 1. Ownership alone does not equip the sniper.
  function primaryWeapon(): PrimaryWeaponId {
    const selected = callbacks.getPrimaryWeapon?.() ?? 'assaultRifle';
    return callbacks.canUseWeapon?.(selected) === false ? 'assaultRifle' : selected;
  }

  function showImpact(position: Vector3) {
    const spark = MeshBuilder.CreateSphere(
      'shot impact',
      { diameter: 0.085, segments: 5 },
      scene,
    );
    spark.position.copyFrom(position);
    spark.material = impactMaterial;
    spark.isPickable = false;
    window.setTimeout(() => spark.dispose(), 110);
  }

  function reload() {
    if (weaponStats[currentWeaponId].fireMode === 'Melee') return;
    const stats = weaponStats[currentWeaponId];
    const ammoSupply = ammoSupplies[currentWeaponId];
    const ammo = ammoSupply.state;
    if (
      reloading ||
      ammo.magazine === stats.magazineSize ||
      ammo.reserve === 0
    )
      return;
    reloading = true;
    firing = false;
    if (currentWeaponId === 'sniper') {
      // The solid scope must never reappear in the camera's aimed position.
      // Reload cancels both aim controls; the next deliberate aim starts fresh.
      pointerAiming = false;
      keyboardAiming = false;
      setScoped(false);
      sniperRoot.position.copyFrom(weaponPoses.sniper.hipPosition);
      sniperRoot.rotation.copyFrom(weaponPoses.sniper.hipRotation);
      sniperRoot.setEnabled(active);
      camera.fov = 1.05;
    }
    updateHud(true);
    audio.playReload();
    const reloadingWeaponId = currentWeaponId;
    reloadTimer = setTimeout(() => {
      ammoSupplies[reloadingWeaponId].reload();
      reloading = false;
      reloadTimer = null;
      updateHud(false);
    }, stats.reloadMs);
  }

  function shoot(now: number) {
    const stats = weaponStats[currentWeaponId];
    const ammoSupply = ammoSupplies[currentWeaponId];
    if (
      reloading ||
      now - lastShotAt[currentWeaponId] < stats.fireDelayMs
    )
      return;
    if (weaponStats[currentWeaponId].fireMode !== 'Melee' && ammoSupply.state.magazine <= 0) {
      reload();
      return;
    }

    lastShotAt[currentWeaponId] = now;
    if (currentWeaponId === 'grenade') {
      ammoSupply.fire(); updateHud(false);
      callbacks.onThrowGrenade?.(camera.position.clone(), camera.getForwardRay().direction.clone());
      return;
    }
    if (weaponStats[currentWeaponId].fireMode === 'Melee') {
      swingAt = now;
      audio.playSwing();
    } else {
    ammoSupply.fire();
    updateHud(false);
    audio.playShot();
    camera.rotation.x -=
      currentWeaponId === 'sniper' ? .024 : currentWeaponId === 'pistol'
        ? 0.007 + Math.random() * 0.004
        : 0.009 + Math.random() * 0.006;
    const activeRoot = weaponRoots[currentWeaponId];
    const poses = weaponPoses[currentWeaponId];
    const targetPosition = sprintPoseActive
      ? poses.sprintPosition
      : pointerAiming || keyboardAiming
        ? poses.aimPosition
        : poses.hipPosition;
    activeRoot.position.z = targetPosition.z - 0.07;
    flash.parent = activeRoot;
    flash.position.copyFrom(poses.muzzlePosition);
    flash.scaling =
      currentWeaponId === 'pistol'
        ? new Vector3(0.55, 0.55, 1.25)
        : new Vector3(0.75, 0.75, 1.7);
    flashLight.parent = activeRoot;
    flashLight.position.copyFrom(poses.muzzlePosition);
    flash.setEnabled(true);
    flashLight.intensity = 2.8;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      flash.setEnabled(false);
      flashLight.intensity = 0;
    }, 45);
    }

    if (currentWeaponId === 'rocketLauncher') {
      callbacks.onFireRocket?.(camera.position.clone(), camera.getForwardRay().direction.clone());
      return;
    }
    // The ray begins exactly at the centre of the player's view.
    const ray = camera.getForwardRay(stats.range);
    const hit = scene.pickWithRay(
      ray,
      (mesh) => mesh.isPickable && !mesh.name.startsWith('kestrel'),
    );
    if (hit?.hit && hit.pickedPoint && hit.pickedMesh) {
      // Melee uses only the white HUD marker, never bullet impact effects.
      const melee = stats.fireMode === 'Melee';
      if (!melee) showImpact(hit.pickedPoint);
      const kind = callbacks.onImpact(hit.pickedMesh, currentWeaponId);
      if (kind !== 'none') callbacks.onHitMarker(melee ? 'body' : kind);
    }
  }

  const onPointerDown = (event: PointerEvent) => {
    if (document.pointerLockElement !== canvas || !active) return;
    if (event.button === 0) {
      if (weaponStats[currentWeaponId].fireMode !== 'Auto') {
        // Semi-automatic fire: one pointer press can produce only one shot.
        shoot(performance.now());
      } else {
        firing = true;
      }
    }
    if (event.button === 2 && currentWeaponId !== 'grenade' && weaponStats[currentWeaponId].fireMode !== 'Melee' && !(currentWeaponId === 'sniper' && reloading)) pointerAiming = true;
  };
  const onPointerUp = (event: PointerEvent) => {
    if (event.button === 0) firing = false;
    if (event.button === 2) pointerAiming = false;
  };
  const onContextMenu = (event: MouseEvent) => event.preventDefault();
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'KeyR') reload();
    if (
      document.pointerLockElement === canvas &&
      active &&
      !event.repeat
    ) {
      if (event.code === 'Digit1') switchWeapon(primaryWeapon());
      if (event.code === 'Digit2') switchWeapon('pistol');
      if (event.code === 'Digit4') switchWeapon('grenade');
      if (event.code === 'Digit3') switchWeapon(callbacks.getMeleeWeapon?.() ?? 'orbiter');
    }
    if (
      currentWeaponId !== 'grenade' && event.code === 'KeyQ' &&
      !event.repeat &&
      document.pointerLockElement === canvas &&
      active &&
      weaponStats[currentWeaponId].fireMode !== 'Melee' &&
      !(currentWeaponId === 'sniper' && reloading)
    ) {
      keyboardAiming = !keyboardAiming;
    }
  };
  const onPointerLockChange = () => {
    if (document.pointerLockElement !== canvas) {
      firing = false;
      pointerAiming = false;
      keyboardAiming = false;
      setScoped(false);
    }
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('keydown', onKeyDown);
  document.addEventListener('pointerlockchange', onPointerLockChange);

  return {
    selectWeapon: switchWeapon,
    get id() { return currentWeaponId; },
    update(now: number, sprinting: boolean) {
      if (currentWeaponId !== 'grenade' && currentWeaponId !== 'pistol' && weaponStats[currentWeaponId].fireMode !== 'Melee' && currentWeaponId !== primaryWeapon()) switchWeapon(primaryWeapon());
      if (weaponStats[currentWeaponId].fireMode === 'Melee' && currentWeaponId !== (callbacks.getMeleeWeapon?.() ?? 'orbiter')) switchWeapon(callbacks.getMeleeWeapon?.() ?? 'orbiter');
      sprintPoseActive = sprinting && active;
      if (
        firing &&
        active &&
        weaponStats[currentWeaponId].fireMode === 'Auto'
      )
        shoot(now);
      const aimingDownSights =
        (pointerAiming || keyboardAiming) && active && !sprintPoseActive &&
        !(currentWeaponId === 'sniper' && reloading);
      setScoped(currentWeaponId === 'sniper' && aimingDownSights && !reloading);
      sniperRoot.setEnabled(active && currentWeaponId === 'sniper' && !scoped);
      const activeRoot = weaponRoots[currentWeaponId];
      const poses = weaponPoses[currentWeaponId];
      let targetPosition = aimingDownSights
        ? poses.aimPosition
        : poses.hipPosition;
      let targetRotation = aimingDownSights
        ? poses.aimRotation
        : poses.hipRotation;
      if (sprintPoseActive) {
        const stride = now * 0.016;
        targetPosition = poses.sprintPosition.add(
          new Vector3(
            Math.sin(stride) * 0.028,
            Math.abs(Math.cos(stride)) * 0.024,
            0,
          ),
        );
        targetRotation = poses.sprintRotation.add(
          new Vector3(
            Math.cos(stride) * 0.018,
            0,
            Math.sin(stride) * 0.04,
          ),
        );
      }
      const positionBlend = aimingDownSights ? 0.24 : 0.18;
      if (weaponStats[currentWeaponId].fireMode === 'Melee') {
        const progress = Math.min(1, Math.max(0, (now - swingAt) / 420));
        const swing = Math.sin(progress * Math.PI);
        targetPosition = targetPosition.add(new Vector3(-.65 * swing, .12 * swing, .12 * swing));
        targetRotation = targetRotation.add(new Vector3(-.35 * swing, -.8 * swing, -1.5 * swing));
      }
      activeRoot.position = Vector3.Lerp(
        activeRoot.position,
        targetPosition,
        positionBlend,
      );
      activeRoot.rotation = Vector3.Lerp(
        activeRoot.rotation,
        targetRotation,
        positionBlend,
      );
      const targetFov = aimingDownSights ? (scoped ? .35 : .82) : sprinting ? 1.12 : 1.05;
      camera.fov += (targetFov - camera.fov) * 0.16;
    },
    setActive(nextActive: boolean) {
      setScoped(false);
      active = nextActive;
      firing = false;
      pointerAiming = false;
      keyboardAiming = false;
      sprintPoseActive = false;
      root.setEnabled(nextActive && currentWeaponId === 'assaultRifle');
      pistolRoot.setEnabled(nextActive && currentWeaponId === 'pistol');
      sniperRoot.setEnabled(nextActive && currentWeaponId === 'sniper');
      rocketRoot.setEnabled(nextActive && currentWeaponId === 'rocketLauncher');
      grenadeRoot.setEnabled(nextActive && currentWeaponId === 'grenade');
      swordRoot.setEnabled(nextActive && currentWeaponId === 'sword');
      orbiterRoot.setEnabled(nextActive && currentWeaponId === 'orbiter');
    },
    reset() {
      swingAt = -Infinity;
      setScoped(false);
      cancelReload();
      pointerAiming = false;
      keyboardAiming = false;
      sprintPoseActive = false;
      firing = false;
      ammoSupplies.assaultRifle.reset();
      ammoSupplies.pistol.reset();
      ammoSupplies.sniper.reset();
      ammoSupplies.grenade.reset();
      ammoSupplies.rocketLauncher.reset();
      currentWeaponId = primaryWeapon();
      root.setEnabled(active && currentWeaponId === 'assaultRifle');
      pistolRoot.setEnabled(false);
      sniperRoot.setEnabled(active && currentWeaponId === 'sniper');
      rocketRoot.setEnabled(active && currentWeaponId === 'rocketLauncher');
      grenadeRoot.setEnabled(false);
      swordRoot.setEnabled(false);
      orbiterRoot.setEnabled(false);
      updateHud(false);
    },
    dispose() {
      if (reloadTimer) clearTimeout(reloadTimer);
      if (flashTimer) clearTimeout(flashTimer);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      audio.dispose();
      root.dispose();
      pistolRoot.dispose();
      sniperRoot.dispose();
      rocketRoot.dispose();
      grenadeRoot.dispose();
      swordRoot.dispose();
      orbiterRoot.dispose();
      flashLight.dispose();
    },
  };
}
