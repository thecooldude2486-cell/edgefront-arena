import {
  AbstractMesh,
  Color3,
  MeshBuilder,
  Ray,
  Scene,
  StandardMaterial,
  UniversalCamera,
  Vector3,
} from '@babylonjs/core';
import {
  applyWeaponDamage,
  type WeaponHitZone,
  type WeaponId,
} from './weaponDefinitions';
import { BOT, COLORS, SPAWNS } from './config';

type BotCallbacks = {
  onEliminated: () => void;
  onHealthChange: (health: number) => void;
  onPlayerHit: (weaponId: WeaponId, hitZone: WeaponHitZone) => void;
  isPlayerAlive: () => boolean;
};

function makeMaterial(scene: Scene, name: string, hex: string, emissive = 0) {
  const value = new StandardMaterial(name, scene);
  value.diffuseColor = Color3.FromHexString(hex);
  value.specularColor = new Color3(0.28, 0.34, 0.38);
  value.emissiveColor = value.diffuseColor.scale(emissive);
  return value;
}

export function createBot(
  scene: Scene,
  camera: UniversalCamera,
  callbacks: BotCallbacks,
) {
  // This invisible capsule is both the bot's root and its collision body.
  const root = MeshBuilder.CreateCapsule(
    'bot movement collider',
    { height: 2.2, radius: 0.46, tessellation: 8 },
    scene,
  );
  root.position.copyFrom(SPAWNS.bot);
  root.rotation.y = SPAWNS.botYaw;
  root.isPickable = false;
  root.checkCollisions = true;
  root.ellipsoid = new Vector3(0.46, 1.05, 0.46);

  const suit = makeMaterial(scene, 'bot coral suit', COLORS.coral);
  const armour = makeMaterial(scene, 'bot dark armour', '#142632');
  const visor = makeMaterial(scene, 'bot lime visor', COLORS.lime, 0.55);
  const invisible = makeMaterial(scene, 'bot invisible collider', '#000000');
  invisible.alpha = 0;
  invisible.disableDepthWrite = true;
  root.material = invisible;

  function mark(mesh: AbstractMesh, hitZone: WeaponHitZone) {
    mesh.parent = root;
    mesh.metadata = { owner: 'bot', hitZone };
    mesh.isPickable = true;
    mesh.checkCollisions = false;
    return mesh;
  }

  const torso = mark(
    MeshBuilder.CreateCapsule(
      'bot torso',
      { height: 1.28, radius: 0.4, tessellation: 10 },
      scene,
    ),
    'body',
  );
  torso.material = suit;
  torso.position.y = 0.25;

  const chest = mark(
    MeshBuilder.CreateBox(
      'bot chest plate',
      { width: 0.68, height: 0.52, depth: 0.16 },
      scene,
    ),
    'body',
  );
  chest.position = new Vector3(0, 0.34, -0.35);
  chest.material = armour;

  const head = mark(
    MeshBuilder.CreateSphere(
      'bot head',
      { diameter: 0.62, segments: 10 },
      scene,
    ),
    'head',
  );
  head.position.y = 1.17;
  head.material = armour;

  const visorMesh = mark(
    MeshBuilder.CreateBox(
      'bot visor',
      { width: 0.48, height: 0.16, depth: 0.1 },
      scene,
    ),
    'head',
  );
  visorMesh.position = new Vector3(0, 1.2, -0.29);
  visorMesh.material = visor;

  for (const side of [-1, 1] as const) {
    const arm = mark(
      MeshBuilder.CreateCapsule(
        `bot ${side} arm`,
        { height: 0.86, radius: 0.13, tessellation: 8 },
        scene,
      ),
      'body',
    );
    arm.position = new Vector3(side * 0.48, 0.2, 0);
    arm.rotation.z = side * 0.16;
    arm.material = armour;

    const leg = mark(
      MeshBuilder.CreateCapsule(
        `bot ${side} leg`,
        { height: 0.9, radius: 0.15, tessellation: 8 },
        scene,
      ),
      'body',
    );
    leg.position = new Vector3(side * 0.2, -0.63, 0);
    leg.material = suit;
  }

  // A compact carbine silhouette makes it clear that the bot can return fire.
  const botGun = MeshBuilder.CreateBox(
    'bot carbine',
    { width: 0.18, height: 0.16, depth: 0.72 },
    scene,
  );
  botGun.parent = root;
  botGun.position = new Vector3(0.33, 0.2, -0.52);
  botGun.rotation.x = -0.1;
  botGun.material = armour;
  botGun.isPickable = false;

  const patrolPoints = [
    new Vector3(-13, SPAWNS.bot.y, 10),
    new Vector3(-16, SPAWNS.bot.y, -6),
    new Vector3(14, SPAWNS.bot.y, -10),
    new Vector3(16, SPAWNS.bot.y, 7),
  ];

  let health = BOT.maxHealth;
  let alive = true;
  let patrolIndex = 0;
  let nextShotAt = performance.now() + 1000;
  let respawnTimer: ReturnType<typeof setTimeout> | null = null;
  callbacks.onHealthChange(health);

  function hasLineOfSight(target: Vector3) {
    const eye = root.position.add(new Vector3(0, 0.8, 0));
    const towardPlayer = target.subtract(eye);
    const distance = towardPlayer.length();
    if (distance <= 0.001) return true;
    const ray = new Ray(eye, towardPlayer.normalize(), distance);
    const obstruction = scene.pickWithRay(ray, (mesh) => {
      return (
        mesh.checkCollisions &&
        mesh !== root &&
        mesh.metadata?.owner !== 'bot' &&
        mesh.metadata?.owner !== 'player'
      );
    });
    return (
      !obstruction?.hit || (obstruction.distance ?? distance) >= distance - 0.5
    );
  }

  function fireAtPlayer(now: number, target: Vector3, distance: number) {
    if (now < nextShotAt) return;
    nextShotAt = now + 520 + Math.random() * 260;

    const muzzle = root.position.add(new Vector3(0.33, 0.25, -0.9));
    const spread = Math.min(1.9, 0.45 + distance * 0.045);
    const error = new Vector3(
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread * 0.7,
      (Math.random() - 0.5) * spread,
    );
    const end = target.add(error);
    const tracer = MeshBuilder.CreateLines(
      'bot shot tracer',
      { points: [muzzle, end] },
      scene,
    );
    tracer.color = Color3.FromHexString(COLORS.coral);
    tracer.isPickable = false;
    window.setTimeout(() => tracer.dispose(), 75);

    // Small random aim error keeps the bot fair for a first-time player.
    if (error.length() < 0.66) {
      const horizontalError = Math.hypot(error.x, error.z);
      const hitZone: WeaponHitZone =
        Math.abs(error.y) < 0.18 && horizontalError < 0.3 ? 'head' : 'body';
      callbacks.onPlayerHit('assaultRifle', hitZone);
    }
  }

  function respawn() {
    health = BOT.maxHealth;
    callbacks.onHealthChange(health);
    alive = true;
    patrolIndex = 0;
    root.position.copyFrom(SPAWNS.bot);
    root.rotation.set(0, SPAWNS.botYaw, 0);
    root.setEnabled(true);
    nextShotAt = performance.now() + 900;
  }

  return {
    root,
    update(deltaSeconds: number, now: number) {
      if (!alive) return;
      const playerPosition = camera.position.clone();
      const flatToPlayer = playerPosition.subtract(root.position);
      flatToPlayer.y = 0;
      const distance = flatToPlayer.length();
      const canSeePlayer =
        callbacks.isPlayerAlive() &&
        distance < 27 &&
        hasLineOfSight(playerPosition);

      let moveDirection: Vector3;
      if (canSeePlayer) {
        const toward = flatToPlayer.normalize();
        const strafe = new Vector3(-toward.z, 0, toward.x).scale(
          Math.sin(now * 0.0017),
        );
        const distanceControl =
          distance > 13
            ? toward.scale(0.75)
            : distance < 7
              ? toward.scale(-0.65)
              : Vector3.Zero();
        moveDirection = distanceControl.add(strafe.scale(0.72)).normalize();
        fireAtPlayer(now, playerPosition, distance);
      } else {
        const patrolTarget = patrolPoints[patrolIndex];
        const toPatrol = patrolTarget.subtract(root.position);
        toPatrol.y = 0;
        if (toPatrol.length() < 1.2)
          patrolIndex = (patrolIndex + 1) % patrolPoints.length;
        moveDirection = toPatrol.normalize();
      }

      if (moveDirection.lengthSquared() > 0.001) {
        const speed = canSeePlayer ? 2.8 : 2.15;
        root.moveWithCollisions(
          new Vector3(
            moveDirection.x * speed * deltaSeconds,
            -0.08,
            moveDirection.z * speed * deltaSeconds,
          ),
        );
        // The bot model faces along its negative local Z axis.
        root.rotation.y = Math.atan2(-moveDirection.x, -moveDirection.z);
      }
    },
    ownsMesh(mesh: AbstractMesh) {
      return mesh.metadata?.owner === 'bot';
    },
    takeDamage(weaponId: WeaponId, hitZone: WeaponHitZone) {
      if (!alive) return false;
      health = applyWeaponDamage(health, weaponId, hitZone);
      callbacks.onHealthChange(health);
      if (health === 0) {
        alive = false;
        root.setEnabled(false);
        respawnTimer = setTimeout(respawn, BOT.respawnMs);
        callbacks.onEliminated();
        return true;
      }
      return false;
    },
    get alive() {
      return alive;
    },
    get health() {
      return health;
    },
    reset() {
      if (respawnTimer) clearTimeout(respawnTimer);
      respawnTimer = null;
      respawn();
    },
    dispose() {
      if (respawnTimer) clearTimeout(respawnTimer);
      root.getChildMeshes().forEach((mesh) => mesh.dispose());
      root.dispose();
      [suit, armour, visor, invisible].forEach((surface) => surface.dispose());
    },
  };
}
