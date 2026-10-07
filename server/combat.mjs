import { createDeathRecap } from '../game/deathRecap.ts';
import { DEFAULT_MAP, isArenaMapId } from '../game/maps.ts';
import './gameImports.mjs';
import { createCombatPerformance } from '../game/combatXp.ts';
import { NullEngine, Scene, MeshBuilder, Ray, Vector3 } from '@babylonjs/core';
const { createArena } = await import('../game/createArena.ts');
import {
  WEAPON_DEFINITIONS,
  getWeaponDamage,
} from '../game/weaponDefinitions.ts';
import { LASER_ENERGY } from '../game/createLaserEnergy.ts';
import { ROCKET, GRENADE, MOLOTOV } from '../game/projectileDefinitions.ts';

export function newCombatPlayer() {
  const inventory = Object.fromEntries(
    Object.entries(WEAPON_DEFINITIONS).map(([id, stats]) => [
      id,
      {
        ammo: stats.magazineSize,
        reserve: stats.reserveAmmo,
        reloadAt: 0,
        lastShot: -Infinity,
      },
    ]),
  );
  return {
    incomingDamage: createDeathRecap(),
    performance: createCombatPerformance(Date.now()),
    health: 100,
    weapon: 'assaultRifle',
    supplyWeapon: 'assaultRifle',
    inventory,
    ...inventory.assaultRifle,
    pose: null,
    ready: false,
    sequence: -1,
    energyUpdatedAt: null,
    projectiles: [],
    fires: [],
  };
}

// The arena collision scene is shared; target colliders are positioned for each query.
export function createHitWorld(mapId = DEFAULT_MAP) {
  if (!isArenaMapId(mapId)) throw Error('Unknown arena map');
  const engine = new NullEngine(),
    scene = new Scene(engine);
  const arena = createArena(scene, mapId);
  let onExplosion = () => {};
  const body = MeshBuilder.CreateCapsule(
    'server body',
    { height: 1.35, radius: 0.32, tessellation: 8 },
    scene,
  );
  const head = MeshBuilder.CreateSphere(
    'server head',
    { diameter: 0.42, segments: 8 },
    scene,
  );
  scene.meshes.forEach((mesh) => mesh.computeWorldMatrix(true));
  const solid = (mesh) =>
    mesh.isEnabled() &&
    mesh.checkCollisions &&
    !mesh.metadata?.owner &&
    !['player movement collider', 'bot movement collider'].includes(mesh.name);
  function sweep(origin, direction, distance, pose = null) {
    if (pose) {
      body.position.set(pose.x, pose.y - 0.18, pose.z);
      head.position.set(pose.x, pose.y + 0.62, pose.z);
      body.computeWorldMatrix(true);
      head.computeWorldMatrix(true);
    }
    const ray = new Ray(
      new Vector3(origin.x, origin.y, origin.z),
      new Vector3(direction.x, direction.y, direction.z),
      distance,
    );
    const pick = scene.pickWithRay(
      ray,
      (mesh) => (pose && (mesh === body || mesh === head)) || solid(mesh),
      false,
    );
    return pick?.hit && pick.pickedPoint
      ? {
          point: pick.pickedPoint,
          distance: pick.distance,
          mesh: pick.pickedMesh,
          kind:
            pick.pickedMesh === head
              ? 'head'
              : pick.pickedMesh === body
                ? 'body'
                : Number.isInteger(pick.pickedMesh?.metadata?.barrelId)
                  ? 'barrel'
                  : 'cover',
        }
      : null;
  }
  return {
    sweep,
    environment: arena.environment,
    setEnvironment(state, callback = () => {}) {
      arena.environment.apply(state);
      onExplosion = callback;
    },
    hitBarrel(mesh, amount) {
      return arena.environment.hit(mesh, amount, onExplosion);
    },
    blastBarrels(point, radius, amount) {
      arena.environment.blast(point, radius, amount, onExplosion);
    },
    hit(
      origin,
      direction,
      pose,
      range = WEAPON_DEFINITIONS.assaultRifle.range,
    ) {
      const hit = sweep(origin, direction, range, pose);
      return hit && ['head', 'body'].includes(hit.kind) ? hit.kind : null;
    },
    visible(origin, target) {
      const delta = target.subtract(origin),
        distance = delta.length();
      if (distance < 0.001) return true;
      return arena.environment.visible(origin, target);
    },
    floor(point) {
      return (
        sweep(point.add(new Vector3(0, 0.15, 0)), Vector3.Down(), 15)?.point ??
        null
      );
    },
    dispose() {
      scene.dispose();
      engine.dispose();
    },
  };
}

function refreshEnergy(player, now) {
  const supply =
    player.supplyWeapon === 'laserCannon'
      ? player
      : player.inventory.laserCannon;
  if (player.energyUpdatedAt !== null) {
    const start = Math.max(
      player.energyUpdatedAt,
      supply.lastShot + LASER_ENERGY.rechargeDelay * 1000,
    );
    supply.ammo = Math.min(
      LASER_ENERGY.capacity,
      supply.ammo +
        (Math.max(0, now - start) / 1000) * LASER_ENERGY.rechargeRate,
    );
  }
  player.energyUpdatedAt = now;
}
export function equipCombatWeapon(player, weapon, now = Date.now()) {
  if (!Object.hasOwn(WEAPON_DEFINITIONS, weapon)) return false;
  refreshEnergy(player, now);
  finishReload(player, now);
  if (player.supplyWeapon !== weapon) {
    const old = player.inventory[player.supplyWeapon];
    Object.assign(old, {
      ammo: player.ammo,
      reserve: player.reserve,
      lastShot: player.lastShot,
      reloadAt: 0,
    });
    Object.assign(player, player.inventory[weapon], { reloadAt: 0 });
    player.supplyWeapon = weapon;
  }
  player.weapon = weapon;
  return true;
}
function finishReload(player, now) {
  if (!player.reloadAt || now < player.reloadAt) return;
  const count = Math.min(
    WEAPON_DEFINITIONS[player.supplyWeapon].magazineSize - player.ammo,
    player.reserve,
  );
  player.ammo += count;
  player.reserve -= count;
  player.reloadAt = 0;
}
function damage(player, target, weapon, zone, origin, sequence, onHit) {
  if (target.health <= 0 || !target.pose) return;
  const before = target.health;
  target.health = Math.max(0, before - getWeaponDamage(weapon, zone));
  target.incomingDamage.record(
    weapon,
    zone,
    before,
    target.health,
    Math.hypot(
      origin.x - target.pose.x,
      origin.y - target.pose.y,
      origin.z - target.pose.z,
    ),
  );
  player.performance.damage(
    before,
    target.health,
    zone === 'head',
    Math.hypot(
      origin.x - target.pose.x,
      origin.y - target.pose.y,
      origin.z - target.pose.z,
    ),
    false,
  );
  onHit(
    zone === 'head' ? 'head' : zone === 'direct' ? 'direct' : 'body',
    sequence,
  );
}
const finiteVector = (value) =>
  value && ['x', 'y', 'z'].every((key) => Number.isFinite(value[key]));

// Only server-owned ammo, timing, collision queries and health determine damage.
export function checkCombatEffect(
  player,
  target,
  effect,
  sequence,
  now,
  world,
  onHit = () => {},
  hitPose = target.pose,
) {
  if (
    !player.ready ||
    !target.ready ||
    player.health <= 0 ||
    target.health <= 0 ||
    effect.weapon !== player.weapon ||
    !Object.hasOwn(WEAPON_DEFINITIONS, effect.weapon)
  )
    return false;
  equipCombatWeapon(player, player.weapon, now);
  finishReload(player, now);
  const stats = WEAPON_DEFINITIONS[player.weapon];
  if (effect.action === 'reload') {
    if (
      !stats.reloadMs ||
      player.reloadAt ||
      player.ammo === stats.magazineSize ||
      !player.reserve
    )
      return false;
    player.reloadAt = now + stats.reloadMs;
    return true;
  }
  if (effect.action === 'reloadEnd')
    return stats.reloadMs > 0 && !player.reloadAt;
  if (
    effect.action !== 'fire' ||
    !Number.isSafeInteger(sequence) ||
    sequence <= player.sequence
  )
    return false;
  player.sequence = sequence; // Rejected shots cannot be retried with the same ID.
  if (
    !player.pose ||
    !target.pose ||
    player.reloadAt ||
    now - player.lastShot < stats.fireDelayMs
  )
    return false;
  const cost =
    player.weapon === 'laserCannon'
      ? LASER_ENERGY.perTick
      : stats.fireMode === 'Melee'
        ? 0
        : 1;
  if (player.ammo < cost) return false;
  const { origin, direction } = effect,
    pose = player.pose;
  if (
    !finiteVector(origin) ||
    !finiteVector(direction) ||
    Math.abs(Math.hypot(direction.x, direction.y, direction.z) - 1) > 0.01
  )
    return false;
  if (
    Math.hypot(origin.x - pose.x, origin.z - pose.z) > 0.05 ||
    origin.y - pose.y < 0.05 ||
    origin.y - pose.y > 1
  )
    return false;
  const facing = {
    x: Math.sin(pose.yaw) * Math.cos(pose.pitch),
    y: -Math.sin(pose.pitch),
    z: Math.cos(pose.yaw) * Math.cos(pose.pitch),
  };
  if (
    direction.x * facing.x + direction.y * facing.y + direction.z * facing.z <
    0.98
  )
    return false;
  player.ammo -= cost;
  player.lastShot = now;
  player.performance.shot();
  const start = new Vector3(pose.x, origin.y, pose.z),
    aim = new Vector3(direction.x, direction.y, direction.z).normalize();
  if (['rocketLauncher', 'grenade', 'molotov'].includes(player.weapon)) {
    const tuning =
      player.weapon === 'rocketLauncher'
        ? ROCKET
        : player.weapon === 'grenade'
          ? GRENADE
          : MOLOTOV;
    player.projectiles.push({
      weapon: player.weapon,
      sequence,
      origin: start.clone(),
      position: start,
      velocity: aim
        .scale(tuning.speed)
        .add(new Vector3(0, player.weapon === 'rocketLauncher' ? 0 : 3, 0)),
      age: 0,
    });
  } else {
    const collision = world.sweep(
      start,
      aim,
      stats.range,
      stats.fireMode === 'Melee' ? target.pose : hitPose,
    );
    if (collision?.kind === 'barrel')
      world.hitBarrel(collision.mesh, getWeaponDamage(player.weapon, 'body'));
    else if (collision && ['head', 'body'].includes(collision.kind))
      damage(
        player,
        world.damageTarget ?? target,
        player.weapon,
        stats.fireMode === 'Melee' ? 'body' : collision.kind,
        pose,
        sequence,
        onHit,
      );
  }
  return true;
}

function blast(player, target, attack, point, direct, world, onHit) {
  if (world.blastDamage) {
    world.blastBarrels(
      point,
      attack.weapon === 'rocketLauncher' ? ROCKET.radius : GRENADE.radius,
      34,
    );
    const directTarget = direct ? world.damageTarget : null;
    world.blastDamage(
      point,
      attack.weapon,
      'splash',
      attack.origin,
      onHit,
      attack.sequence,
      attack.weapon === 'rocketLauncher' ? ROCKET.radius : GRENADE.radius,
      directTarget,
    );
    if (directTarget)
      damage(
        player,
        directTarget,
        attack.weapon,
        'direct',
        attack.origin,
        attack.sequence,
        onHit,
      );
    return;
  }
  const center = new Vector3(target.pose.x, target.pose.y, target.pose.z);
  const radius =
    attack.weapon === 'rocketLauncher' ? ROCKET.radius : GRENADE.radius;
  world.blastBarrels(point, radius, getWeaponDamage(attack.weapon, 'splash'));
  if (
    direct ||
    (Vector3.Distance(point, center) <= radius && world.visible(point, center))
  ) {
    damage(
      player,
      target,
      attack.weapon,
      direct ? 'direct' : 'splash',
      attack.origin,
      attack.sequence,
      onHit,
    );
  }
}
// Advance delayed damage in small steps even when no client sends a new packet.
export function updateCombat(
  player,
  target,
  seconds,
  now,
  world,
  onHit = () => {},
) {
  refreshEnergy(player, now);
  finishReload(player, now);
  if (
    !player.ready ||
    !target.ready ||
    player.health <= 0 ||
    target.health <= 0 ||
    !target.pose
  )
    return;
  let remaining = Math.max(0, seconds);
  while (remaining > 1e-8 && target.health > 0) {
    const dt = Math.min(0.02, remaining);
    remaining -= dt;
    // Existing fires tick before newly landed bottles, matching bot-mode physics.
    for (const fire of player.fires.slice()) {
      fire.age = Math.min(MOLOTOV.duration, fire.age + dt);
      const ticks = Math.floor((fire.age + 1e-8) / MOLOTOV.tick);
      while (fire.ticks < ticks && target.health > 0) {
        fire.ticks++;
        if (world.blastDamage) {
          world.blastBarrels(
            fire.position.add(new Vector3(0, 0.2, 0)),
            MOLOTOV.radius,
            5,
          );
          world.blastDamage(
            fire.position,
            'molotov',
            'body',
            fire.origin,
            onHit,
            fire.sequence,
            MOLOTOV.radius,
          );
          continue;
        }
        world.blastBarrels(
          fire.position.add(new Vector3(0, 0.2, 0)),
          MOLOTOV.radius,
          getWeaponDamage('molotov', 'body'),
        );
        const center = new Vector3(target.pose.x, target.pose.y, target.pose.z);
        if (
          Math.abs(center.y - fire.position.y) <= 2 &&
          Math.hypot(center.x - fire.position.x, center.z - fire.position.z) <=
            MOLOTOV.radius &&
          world.visible(fire.position.add(new Vector3(0, 0.2, 0)), center)
        ) {
          damage(
            player,
            target,
            'molotov',
            'body',
            fire.origin,
            fire.sequence,
            onHit,
          );
        }
      }
      if (fire.age >= MOLOTOV.duration)
        player.fires.splice(player.fires.indexOf(fire), 1);
    }
    for (const attack of player.projectiles.slice()) {
      if (target.health <= 0) break;
      const rocket = attack.weapon === 'rocketLauncher',
        grenade = attack.weapon === 'grenade';
      const step = Math.min(
        dt,
        grenade
          ? GRENADE.fuse - attack.age
          : rocket
            ? ROCKET.lifetime - attack.age
            : dt,
      );
      if (!rocket)
        attack.velocity.y -=
          (grenade ? GRENADE.gravity : MOLOTOV.gravity) * step;
      const motion = attack.velocity.scale(step),
        distance = motion.length();
      const aim =
        distance > 0.00001 ? motion.scale(1 / distance) : Vector3.Zero();
      const hit =
        distance > 0.00001
          ? world.sweep(
              attack.position,
              aim,
              distance + (rocket ? 0 : grenade ? 0.14 : 0.12),
              rocket ? target.pose : null,
            )
          : null;
      attack.age += step;
      if (rocket && hit) {
        if (hit.kind === 'barrel')
          world.hitBarrel(
            hit.mesh,
            getWeaponDamage('rocketLauncher', 'direct'),
          );
        blast(
          player,
          target,
          attack,
          hit.point.subtract(aim.scale(0.04)),
          ['head', 'body'].includes(hit.kind),
          world,
          onHit,
        );
        player.projectiles.splice(player.projectiles.indexOf(attack), 1);
      } else if (!rocket && hit) {
        if (grenade) {
          attack.position.addInPlace(
            aim.scale(Math.max(0, hit.distance - 0.14)),
          );
          attack.velocity.setAll(0);
        } else {
          const floor = world.floor(hit.point.subtract(aim.scale(0.13)));
          if (floor)
            player.fires.push({
              ...attack,
              position: floor.add(new Vector3(0, 0.04, 0)),
              age: 0,
              ticks: 0,
            });
          player.projectiles.splice(player.projectiles.indexOf(attack), 1);
        }
      } else attack.position.addInPlace(motion);
      if (grenade && attack.age + 1e-8 >= GRENADE.fuse) {
        blast(player, target, attack, attack.position, false, world, onHit);
        player.projectiles.splice(player.projectiles.indexOf(attack), 1);
      } else if (!hit && attack.age >= (rocket ? ROCKET.lifetime : 10)) {
        player.projectiles.splice(player.projectiles.indexOf(attack), 1);
      }
    }
  }
}

export function clearCombat(player) {
  player.projectiles.length = 0;
  player.fires.length = 0;
}
