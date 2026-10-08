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
import { createTeamBotBrain, type BotActor } from './createTeamBotBrain';
import type { BotNavigation } from './createBotNavigation';
import { DIFFICULTIES, NIGHTMARE_TACTICS, type Difficulty } from './difficulty';

type BotCallbacks = {
  onEliminated: () => void;
  onHealthChange: (health: number) => void;
  onPlayerHit: (weaponId: WeaponId, hitZone: WeaponHitZone) => void;
  isPlayerAlive: () => boolean;
  onEnvironmentHit?: (mesh: AbstractMesh, weapon: WeaponId) => void;
  onShot?: (origin: Vector3, direction: Vector3) => void;
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
  getDifficulty: () => Difficulty = () => 'normal',
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
  root.metadata = { owner: 'bot' };
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

  let patrolPoints = [
    new Vector3(-13, SPAWNS.bot.y, 10),
    new Vector3(-16, SPAWNS.bot.y, -6),
    new Vector3(14, SPAWNS.bot.y, -10),
    new Vector3(16, SPAWNS.bot.y, 7),
  ];

  let spawn = SPAWNS.bot.clone(),
    autoRespawn = true;
  let targetOverride: { position: Vector3; alive: boolean } | null = null;
  const targetAlive = () => targetOverride?.alive ?? callbacks.isPlayerAlive();
  let teamBrain: ReturnType<typeof createTeamBotBrain> | null = null;
  let teamPlan: ReturnType<
    ReturnType<typeof createTeamBotBrain>['plan']
  > | null = null;
  let health = BOT.maxHealth;
  let alive = true;
  let patrolIndex = 0;
  let nextShotAt = performance.now() + 1000;
  let lastShotAt = -Infinity;
  let sawPlayer = false;
  let magazine: number = NIGHTMARE_TACTICS.magazine,
    burstShots = 0;
  const aimHistory: { at: number; position: Vector3 }[] = [];
  let attackerPosition: Vector3 | null = null;
  let alertSeconds = 0;
  const retaliates = () =>
    ['hard', 'extreme', 'nightmare'].includes(getDifficulty());
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
        mesh.isEnabled() &&
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
    const difficulty = DIFFICULTIES[getDifficulty()];
    lastShotAt = now;
    nextShotAt = now + difficulty.shotMs + Math.random() * difficulty.jitterMs;

    const nightmare = getDifficulty() === 'nightmare';
    let aimTarget = target;
    const aimsAtHead =
      !nightmare || Math.random() < NIGHTMARE_TACTICS.headChance;
    if (nightmare) {
      const remembered =
        aimHistory.findLast(
          (sample) => sample.at <= now - NIGHTMARE_TACTICS.trackingDelayMs,
        ) ?? aimHistory[0];
      aimTarget = remembered?.position ?? target;
    }
    const muzzle = root.position.add(new Vector3(0.33, 0.25, -0.9));
    const spread = Math.min(1.9, 0.45 + distance * 0.045) * difficulty.spread;
    const error = new Vector3(
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread * 0.7,
      (Math.random() - 0.5) * spread,
    );
    const vertical = aimsAtHead ? 0 : -0.55;
    const end = aimTarget.add(error).add(new Vector3(0, vertical, 0));
    if (nightmare) {
      magazine--;
      burstShots++;
      if (magazine === 0) {
        nextShotAt = now + NIGHTMARE_TACTICS.reloadMs;
        magazine = NIGHTMARE_TACTICS.magazine;
        burstShots = 0;
      } else if (burstShots === NIGHTMARE_TACTICS.burstShots) {
        nextShotAt = now + NIGHTMARE_TACTICS.recoveryMs;
        burstShots = 0;
      }
    }
    const tracer = MeshBuilder.CreateLines(
      'bot shot tracer',
      { points: [muzzle, end] },
      scene,
    );
    tracer.color = Color3.FromHexString(COLORS.coral);
    tracer.isPickable = false;
    window.setTimeout(() => tracer.dispose(), 75);

    // Small random aim error keeps the bot fair for a first-time player.
    const actualError = end.subtract(target.add(new Vector3(0, vertical, 0)));
    const rayDelta = end.subtract(muzzle),
      length = rayDelta.length();
    const blocked = scene.pickWithRay(
      new Ray(muzzle, rayDelta.normalize(), length),
      (mesh) => mesh.checkCollisions && mesh !== root && !mesh.metadata?.owner,
    );
    callbacks.onShot?.(muzzle, rayDelta.normalizeToNew());
    if (blocked?.hit && blocked.pickedMesh)
      callbacks.onEnvironmentHit?.(blocked.pickedMesh, 'assaultRifle');
    if (
      (!blocked?.hit || blocked.distance >= length - 0.1) &&
      actualError.length() < (nightmare ? 0.44 : 0.66)
    ) {
      const horizontalError = Math.hypot(actualError.x, actualError.z);
      const hitZone: WeaponHitZone =
        aimsAtHead && Math.abs(actualError.y) < 0.12 && horizontalError < 0.19
          ? 'head'
          : 'body';
      callbacks.onPlayerHit('assaultRifle', hitZone);
    }
  }

  function respawn() {
    health = BOT.maxHealth;
    callbacks.onHealthChange(health);
    alive = true;
    patrolIndex = 0;
    root.position.copyFrom(spawn);
    root.rotation.set(0, SPAWNS.botYaw, 0);
    root.setEnabled(true);
    nextShotAt = performance.now() + 900;
    sawPlayer = false;
    lastShotAt = -Infinity;
    magazine = NIGHTMARE_TACTICS.magazine;
    burstShots = 0;
    aimHistory.length = 0;
    attackerPosition = null;
    alertSeconds = 0;
    targetOverride = null;
    teamBrain?.reset();
    teamPlan = null;
  }

  function hurt(amount: number) {
    if (!alive) return false;
    health = Math.max(0, health - amount);
    callbacks.onHealthChange(health);
    if (health === 0) {
      alive = false;
      root.setEnabled(false);
      if (autoRespawn) respawnTimer = setTimeout(respawn, BOT.respawnMs);
      callbacks.onEliminated();
      return true;
    }
    return false;
  }
  return {
    root,
    setTeam(team: number) {
      suit.diffuseColor = Color3.FromHexString(
        team === 0 ? COLORS.cyan : COLORS.coral,
      );
    },
    setSpawn(value: Vector3) {
      spawn = value.clone();
      root.position.copyFrom(spawn);
    },
    setAutoRespawn(value: boolean) {
      autoRespawn = value;
    },
    setTarget(position: Vector3 | null, alive = true) {
      targetOverride = position ? { position: position.clone(), alive } : null;
    },
    configureTeam(
      slot: number,
      size: number,
      scale: number,
      navigation: BotNavigation | null,
    ) {
      teamBrain =
        size > 1 && navigation
          ? createTeamBotBrain(slot, size, scale, navigation, hasLineOfSight)
          : null;
      teamPlan = null;
      targetOverride = null;
    },
    planTeamStep(actors: readonly BotActor[], now: number) {
      if (!teamBrain) return -1;
      const previousTarget = teamPlan?.target?.slot;
      teamPlan = teamBrain.plan(root.position, health, actors, now);
      if (teamPlan.target?.slot !== previousTarget) {
        sawPlayer = false;
        aimHistory.length = 0;
      }
      targetOverride = {
        position:
          teamPlan.target?.position.add(new Vector3(0, 0.8, 0)) ??
          root.position.clone(),
        alive: Boolean(teamPlan.target),
      };
      return teamPlan.target?.slot ?? -1;
    },
    takeHazardDamage: hurt,
    setPatrolRoute(points: readonly (readonly [number, number])[]) {
      patrolPoints = points.map(([x, z]) => new Vector3(x, SPAWNS.bot.y, z));
      patrolIndex = 0;
    },
    update(deltaSeconds: number, now: number) {
      if (!alive) return;
      const difficulty = DIFFICULTIES[getDifficulty()];
      alertSeconds = Math.max(0, alertSeconds - deltaSeconds);
      const alerted =
        retaliates() &&
        alertSeconds > 0 &&
        attackerPosition !== null &&
        targetAlive();
      visor.emissiveColor = Color3.FromHexString(difficulty.color).scale(0.55);
      visor.diffuseColor = Color3.FromHexString(difficulty.color);
      const playerPosition = (
        targetOverride?.position ?? camera.position
      ).clone();
      aimHistory.push({ at: now, position: playerPosition.clone() });
      while (
        aimHistory.length > 2 &&
        aimHistory[1].at < now - NIGHTMARE_TACTICS.trackingDelayMs - 50
      )
        aimHistory.shift();
      const flatToPlayer = playerPosition.subtract(root.position);
      flatToPlayer.y = 0;
      const distance = flatToPlayer.length();
      const canSeePlayer =
        targetAlive() &&
        (distance < 27 || alerted) &&
        hasLineOfSight(playerPosition);

      let moveDirection: Vector3;
      // Reacquiring the player after cover always requires a fresh reaction.
      if (canSeePlayer && !sawPlayer) {
        nextShotAt = Math.max(
          lastShotAt === -Infinity ? 0 : nextShotAt,
          now + difficulty.reactionMs + (teamBrain?.reactionOffset ?? 0),
        );
        aimHistory.length = 0;
        aimHistory.push({ at: now, position: playerPosition.clone() });
      }
      sawPlayer = canSeePlayer;
      if (canSeePlayer) {
        if (alerted) attackerPosition = playerPosition.clone();
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
        if (!teamPlan || teamPlan.canFire)
          fireAtPlayer(now, playerPosition, distance);
      } else if (alerted && attackerPosition) {
        // Investigate the last revealed position, not a player hidden by walls.
        moveDirection = attackerPosition.subtract(root.position);
        moveDirection.y = 0;
        if (moveDirection.length() < 1) moveDirection.setAll(0);
        else moveDirection.normalize();
      } else {
        const patrolTarget = patrolPoints[patrolIndex];
        const toPatrol = patrolTarget.subtract(root.position);
        toPatrol.y = 0;
        if (toPatrol.length() < 1.2)
          patrolIndex = (patrolIndex + 1) % patrolPoints.length;
        moveDirection = toPatrol.normalize();
      }

      if (teamPlan) moveDirection = teamPlan.movement;
      if (moveDirection.lengthSquared() > 0.001) {
        const speed = canSeePlayer
          ? difficulty.moveSpeed
          : difficulty.patrolSpeed;
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
      if ((teamPlan?.target && canSeePlayer) || (alerted && attackerPosition)) {
        const facing = (
          teamPlan?.target?.position ?? attackerPosition!
        ).subtract(root.position);
        root.rotation.y = Math.atan2(-facing.x, -facing.z);
      }
    },
    ownsMesh(mesh: AbstractMesh) {
      return mesh === root || mesh.isDescendantOf(root);
    },
    takeDamage(weaponId: WeaponId, hitZone: WeaponHitZone) {
      if (!alive) return false;
      const amount = health - applyWeaponDamage(health, weaponId, hitZone);
      if (hurt(amount)) return true;
      if (retaliates() && targetAlive()) {
        // A hit reveals the attacker for six seconds. Further hits refresh
        // awareness, but do not reset the firing timer (no stun-locking).
        attackerPosition = (
          targetOverride?.position ?? camera.position
        ).clone();
        alertSeconds = 6;
        const facing = attackerPosition.subtract(root.position);
        root.rotation.y = Math.atan2(-facing.x, -facing.z);
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
