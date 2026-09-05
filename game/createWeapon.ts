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
import type { WeaponHit, WeaponId } from './weaponDefinitions';

type WeaponCallbacks = {
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
  const pistolRoot = new TransformNode('vesper pistol root', scene);
  pistolRoot.parent = camera;
  pistolRoot.position.copyFrom(pistolHipPosition);
  pistolRoot.rotation.copyFrom(pistolHipRotation);

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
  pistolRoot.setEnabled(false);

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
    assaultRifle: WEAPON,
    pistol: PISTOL,
  };
  const weaponRoots = {
    assaultRifle: root,
    pistol: pistolRoot,
  };
  const weaponPoses = {
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
    assaultRifle: createWeaponAmmo(WEAPON.magazineSize, WEAPON.reserveAmmo),
    pistol: createWeaponAmmo(PISTOL.magazineSize, PISTOL.reserveAmmo),
  };
  const lastShotAt: Record<WeaponId, number> = {
    assaultRifle: -Infinity,
    pistol: -Infinity,
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
    cancelReload();
    firing = false;
    pointerAiming = false;
    keyboardAiming = false;
    weaponRoots[currentWeaponId].setEnabled(false);
    currentWeaponId = nextWeaponId;
    weaponRoots[currentWeaponId].setEnabled(true);
    updateHud(false);
  }

  updateHud(false);

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
    if (ammoSupply.state.magazine <= 0) {
      reload();
      return;
    }

    lastShotAt[currentWeaponId] = now;
    ammoSupply.fire();
    updateHud(false);
    audio.playShot();
    camera.rotation.x -=
      currentWeaponId === 'pistol'
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

    // The ray begins exactly at the centre of the player's view.
    const ray = camera.getForwardRay(stats.range);
    const hit = scene.pickWithRay(
      ray,
      (mesh) => mesh.isPickable && !mesh.name.startsWith('kestrel'),
    );
    if (hit?.hit && hit.pickedPoint && hit.pickedMesh) {
      showImpact(hit.pickedPoint);
      const kind = callbacks.onImpact(hit.pickedMesh, currentWeaponId);
      if (kind !== 'none') callbacks.onHitMarker(kind);
    }
  }

  const onPointerDown = (event: PointerEvent) => {
    if (document.pointerLockElement !== canvas) return;
    if (event.button === 0) {
      if (weaponStats[currentWeaponId].fireMode === 'Semi') {
        // Semi-automatic fire: one pointer press can produce only one shot.
        shoot(performance.now());
      } else {
        firing = true;
      }
    }
    if (event.button === 2) pointerAiming = true;
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
      if (event.code === 'Digit1') switchWeapon('assaultRifle');
      if (event.code === 'Digit2') switchWeapon('pistol');
    }
    if (
      event.code === 'KeyQ' &&
      !event.repeat &&
      document.pointerLockElement === canvas &&
      active
    ) {
      keyboardAiming = !keyboardAiming;
    }
  };
  const onPointerLockChange = () => {
    if (document.pointerLockElement !== canvas) {
      firing = false;
      pointerAiming = false;
      keyboardAiming = false;
    }
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('keydown', onKeyDown);
  document.addEventListener('pointerlockchange', onPointerLockChange);

  return {
    selectWeapon: switchWeapon,
    update(now: number, sprinting: boolean) {
      sprintPoseActive = sprinting && active;
      if (
        firing &&
        active &&
        weaponStats[currentWeaponId].fireMode === 'Auto'
      )
        shoot(now);
      const aimingDownSights =
        (pointerAiming || keyboardAiming) && active && !sprintPoseActive;
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
      const targetFov = aimingDownSights ? 0.82 : sprinting ? 1.12 : 1.05;
      camera.fov += (targetFov - camera.fov) * 0.16;
    },
    setActive(nextActive: boolean) {
      active = nextActive;
      firing = false;
      pointerAiming = false;
      keyboardAiming = false;
      sprintPoseActive = false;
      root.setEnabled(nextActive && currentWeaponId === 'assaultRifle');
      pistolRoot.setEnabled(nextActive && currentWeaponId === 'pistol');
    },
    reset() {
      cancelReload();
      pointerAiming = false;
      keyboardAiming = false;
      sprintPoseActive = false;
      firing = false;
      ammoSupplies.assaultRifle.reset();
      ammoSupplies.pistol.reset();
      currentWeaponId = 'assaultRifle';
      root.setEnabled(active);
      pistolRoot.setEnabled(false);
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
      flashLight.dispose();
    },
  };
}
