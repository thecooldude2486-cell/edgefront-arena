import {
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  GlowLayer,
  HemisphericLight,
  ImageProcessingConfiguration,
  Mesh,
  MeshBuilder,
  Ray,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  UniversalCamera,
  Vector3,
} from '@babylonjs/core';
import {
  applyWeaponDamage,
  type WeaponHitZone,
  type WeaponId,
} from './weaponDefinitions';
import { createArena } from './createArena';
import {
  BOT,
  MATCH,
  MAX_HEALTH,
  PLAYER,
  REGEN_DELAY,
  REGEN_RATE,
  SPAWNS,
} from './config';
import { createHealthRegeneration } from './createHealthRegeneration';
import { createWeapon } from './createWeapon';
import type { GameHudUpdate } from './types';
import { createBot } from './createBot';

export function createGame(
  canvas: HTMLCanvasElement,
  onHudUpdate: (update: GameHudUpdate) => void,
) {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    adaptToDeviceRatio: true,
  });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.035, 0.09, 0.13, 1);
  scene.collisionsEnabled = true;
  scene.gravity = new Vector3(0, -0.42, 0);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.006;
  scene.fogColor = new Color3(0.035, 0.09, 0.13);
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType =
    ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.contrast = 1.12;
  scene.imageProcessingConfiguration.exposure = 1.04;
  scene.imageProcessingConfiguration.vignetteEnabled = true;
  scene.imageProcessingConfiguration.vignetteWeight = 1.1;
  scene.imageProcessingConfiguration.vignetteColor = new Color4(
    0.01,
    0.025,
    0.04,
    1,
  );

  const camera = new UniversalCamera(
    'player camera',
    SPAWNS.player.clone(),
    scene,
  );
  camera.minZ = 0.05;
  camera.fov = 1.05;
  // Lower sensitivity numbers turn the camera farther for the same mouse move.
  camera.angularSensibility = PLAYER.lookSensitivity;
  camera.inertia = PLAYER.lookInertia;
  camera.checkCollisions = false;
  camera.applyGravity = false;
  // Movement is handled below so sprinting and jumping cannot fight camera inertia.
  camera.keysUp = [];
  camera.keysDown = [];
  camera.keysLeft = [];
  camera.keysRight = [];
  camera.attachControl(canvas, true);
  scene.activeCamera = camera;

  const skyLight = new HemisphericLight(
    'soft arena light',
    new Vector3(0, 1, 0),
    scene,
  );
  skyLight.intensity = 0.78;
  skyLight.diffuse = new Color3(0.58, 0.8, 0.92);
  skyLight.groundColor = new Color3(0.08, 0.12, 0.16);

  const keyLight = new DirectionalLight(
    'stadium key light',
    new Vector3(-0.35, -1, 0.28),
    scene,
  );
  keyLight.position = new Vector3(10, 24, -12);
  keyLight.intensity = 0.9;

  const glow = new GlowLayer('arena accent glow', scene, {
    blurKernelSize: 24,
  });
  glow.intensity = 0.36;

  const arena = createArena(scene);
  const playerCollider = MeshBuilder.CreateCapsule(
    'player movement collider',
    { height: PLAYER.colliderHalfHeight * 2, radius: 0.42, tessellation: 10 },
    scene,
  );
  playerCollider.position = new Vector3(
    SPAWNS.player.x,
    PLAYER.colliderHalfHeight,
    SPAWNS.player.z,
  );
  playerCollider.ellipsoid = new Vector3(
    0.42,
    PLAYER.colliderHalfHeight,
    0.42,
  );
  playerCollider.checkCollisions = true;
  playerCollider.isPickable = false;
  playerCollider.visibility = 0;
  playerCollider.metadata = { owner: 'player' };

  let horizontalVelocity = Vector3.Zero();
  let verticalVelocity = 0;
  let grounded = true;
  let jumpQueued = false;
  let currentEyeHeight = PLAYER.eyeHeight;
  let crouchToggled = false;
  let lastForwardPressAt = -Infinity;
  let sprintArmed = false;

  function resetPlayerPosition() {
    playerCollider.position.set(
      SPAWNS.player.x,
      PLAYER.colliderHalfHeight,
      SPAWNS.player.z,
    );
    camera.position.copyFrom(SPAWNS.player);
    camera.rotation.set(0, SPAWNS.playerYaw, 0);
    horizontalVelocity.setAll(0);
    verticalVelocity = 0;
    grounded = true;
    currentEyeHeight = PLAYER.eyeHeight;
    crouchToggled = false;
    lastForwardPressAt = -Infinity;
    sprintArmed = false;
  }

  let playerHealth = PLAYER.maxHealth;
  let displayedPlayerHealth = PLAYER.maxHealth;
  let playerRegenerating = false;
  const healthRegeneration = createHealthRegeneration({
    maxHealth: MAX_HEALTH,
    delaySeconds: REGEN_DELAY,
    ratePerSecond: REGEN_RATE,
  });
  let playerAlive = true;
  let playerRespawnTimer: ReturnType<typeof setTimeout> | null = null;
  let damageId = 0;
  let weapon: ReturnType<typeof createWeapon> | null = null;
  let bot!: ReturnType<typeof createBot>;
  let playerScore = 0;
  let botScore = 0;
  let matchActive = false;
  let gameOver = false;
  onHudUpdate({
    health: playerHealth,
    maxHealth: MAX_HEALTH,
    regenerating: false,
    dead: false,
    roundWon: false,
    playerScore,
    botScore,
    result: 'none',
    paused: false,
  });

  function requestMouseLock() {
    // Embedded preview browsers may reject pointer lock. Keep that failure graceful.
    void canvas.requestPointerLock().catch(() => onHudUpdate({ paused: true }));
  }

  function restorePlayerHealth() {
    playerHealth = PLAYER.maxHealth;
    displayedPlayerHealth = PLAYER.maxHealth;
    playerRegenerating = false;
    healthRegeneration.reset();
  }

  function endMatch(result: 'victory' | 'defeat') {
    gameOver = true;
    matchActive = false;
    restorePlayerHealth();
    playerAlive = true;
    resetPlayerPosition();
    bot.reset();
    weapon?.setActive(false);
    camera.detachControl();
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }
    onHudUpdate({
      result,
      dead: false,
      roundWon: false,
      paused: false,
      health: playerHealth,
      regenerating: false,
      botHealth: BOT.maxHealth,
    });
  }

  function damagePlayer(weaponId: WeaponId, hitZone: WeaponHitZone) {
    if (!playerAlive || gameOver) return;
    healthRegeneration.registerDamage();
    playerRegenerating = false;
    playerHealth = applyWeaponDamage(playerHealth, weaponId, hitZone);
    displayedPlayerHealth = Math.floor(playerHealth);
    onHudUpdate({
      health: displayedPlayerHealth,
      regenerating: false,
      damageId: ++damageId,
    });
    if (playerHealth > 0) return;

    playerAlive = false;
    botScore += 1;
    arena.updateScore(playerScore, botScore);
    weapon?.setActive(false);
    camera.detachControl();
    onHudUpdate({ dead: true, roundWon: false, botScore, paused: false });
    if (botScore >= MATCH.scoreToWin) {
      endMatch('defeat');
      return;
    }
    playerRespawnTimer = setTimeout(() => {
      playerRespawnTimer = null;
      restorePlayerHealth();
      playerAlive = true;
      resetPlayerPosition();
      bot.reset();
      if (document.pointerLockElement === canvas)
        camera.attachControl(canvas, true);
      weapon?.reset();
      weapon?.setActive(true);
      onHudUpdate({
        health: playerHealth,
        regenerating: false,
        botHealth: BOT.maxHealth,
        dead: false,
        roundWon: false,
        paused: document.pointerLockElement !== canvas,
      });
    }, 2000);
  }

  bot = createBot(scene, camera, {
    onEliminated: () => {
      if (gameOver) return;
      playerScore += 1;
      arena.updateScore(playerScore, botScore);
      if (playerScore >= MATCH.scoreToWin) {
        onHudUpdate({ playerScore });
        endMatch('victory');
        return;
      }

      onHudUpdate({ playerScore, roundWon: true });

      // The player won this round. Reset both rivals together after the
      // same two-second round break used when the player is eliminated.
      playerAlive = false;
      weapon?.setActive(false);
      camera.detachControl();
      playerRespawnTimer = setTimeout(() => {
        playerRespawnTimer = null;
        restorePlayerHealth();
        playerAlive = true;
        resetPlayerPosition();
        bot.reset();
        if (document.pointerLockElement === canvas)
          camera.attachControl(canvas, true);
        weapon?.reset();
        weapon?.setActive(true);
        onHudUpdate({
          health: playerHealth,
          regenerating: false,
          botHealth: BOT.maxHealth,
          dead: false,
          roundWon: false,
          paused: document.pointerLockElement !== canvas,
        });
      }, BOT.respawnMs);
    },
    onHealthChange: (botHealth) => onHudUpdate({ botHealth }),
    onPlayerHit: damagePlayer,
    isPlayerAlive: () => playerAlive,
  });

  const shadows = new ShadowGenerator(1024, keyLight);
  shadows.useBlurExponentialShadowMap = true;
  shadows.blurKernel = 18;
  bot.root.getChildMeshes().forEach((mesh) => shadows.addShadowCaster(mesh));

  let hitId = 0;
  weapon = createWeapon(scene, camera, canvas, {
    onAmmoChange: (
      ammo,
      reserveAmmo,
      reloading,
      weaponId,
      weaponName,
      fireMode,
    ) =>
      onHudUpdate({
        ammo,
        reserveAmmo,
        reloading,
        weaponId,
        weaponName,
        fireMode,
      }),
    onImpact: (mesh, weaponId) => {
      if (!bot.ownsMesh(mesh)) return 'none';
      const hitZone = mesh.metadata?.hitZone === 'head' ? 'head' : 'body';
      bot.takeDamage(weaponId, hitZone);
      return hitZone;
    },
    onHitMarker: (hitMarker) => onHudUpdate({ hitMarker, hitId: ++hitId }),
  });

  // A subtle dome keeps the horizon clean without requiring downloaded assets.
  const sky = MeshBuilder.CreateSphere(
    'arena sky',
    { diameter: 180, segments: 20, sideOrientation: Mesh.BACKSIDE },
    scene,
  );
  const skyMaterial = scene
    .getMaterialByName('midnight structure')
    ?.clone('sky material') as StandardMaterial | undefined;
  if (skyMaterial) {
    skyMaterial.backFaceCulling = false;
    skyMaterial.diffuseColor = Color3.FromHexString('#071926');
    skyMaterial.emissiveColor = Color3.FromHexString('#071926');
    sky.material = skyMaterial;
  }
  sky.isPickable = false;

  const pressed = new Set<string>();

  const onKeyDown = (event: KeyboardEvent) => {
    pressed.add(event.code);
    if (
      event.code === 'KeyW' &&
      !event.repeat &&
      matchActive &&
      playerAlive &&
      !gameOver &&
      document.pointerLockElement === canvas
    ) {
      const now = performance.now();
      sprintArmed = now - lastForwardPressAt <= 320;
      lastForwardPressAt = now;
    }
    const isCrouchKey =
      event.code === 'KeyC' ||
      event.code === 'ControlLeft' ||
      event.code === 'ControlRight';
    if (
      isCrouchKey &&
      !event.repeat &&
      matchActive &&
      playerAlive &&
      !gameOver &&
      document.pointerLockElement === canvas
    ) {
      event.preventDefault();
      crouchToggled = !crouchToggled;
    }
    if (event.code === 'Space' && !event.repeat) {
      event.preventDefault();
      jumpQueued = true;
    }
  };
  const onKeyUp = (event: KeyboardEvent) => {
    pressed.delete(event.code);
    if (event.code === 'KeyW') sprintArmed = false;
  };
  const onCanvasClick = () => {
    if (matchActive && !gameOver && document.pointerLockElement !== canvas) {
      requestMouseLock();
    }
  };
  const onPointerLockChange = () => {
    const locked = document.pointerLockElement === canvas;
    if (locked) {
      camera.attachControl(canvas, true);
      onHudUpdate({ paused: false });
    } else if (matchActive && !gameOver && playerAlive) {
      camera.detachControl();
      onHudUpdate({ paused: true });
    }
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('click', onCanvasClick);
  document.addEventListener('pointerlockchange', onPointerLockChange);

  scene.onBeforeRenderObservable.add(() => {
    const now = performance.now();
    const deltaSeconds = Math.min(engine.getDeltaTime() / 1000, 0.05);

    const regenerated = healthRegeneration.update(
      playerHealth,
      deltaSeconds,
      matchActive && playerAlive && !gameOver,
    );
    playerHealth = regenerated.health;
    const nextDisplayedHealth = Math.floor(playerHealth);
    if (
      nextDisplayedHealth !== displayedPlayerHealth ||
      regenerated.regenerating !== playerRegenerating
    ) {
      displayedPlayerHealth = nextDisplayedHealth;
      playerRegenerating = regenerated.regenerating;
      onHudUpdate({
        health: displayedPlayerHealth,
        regenerating: playerRegenerating,
      });
    }

    const canMove =
      matchActive &&
      playerAlive &&
      !gameOver &&
      document.pointerLockElement === canvas;

    let inputX = 0;
    let inputZ = 0;
    if (canMove) {
      if (pressed.has('KeyD')) inputX += 1;
      if (pressed.has('KeyA')) inputX -= 1;
      if (pressed.has('KeyW')) inputZ += 1;
      if (pressed.has('KeyS')) inputZ -= 1;
    }

    const hasMovementInput = inputX !== 0 || inputZ !== 0;
    const crouching = canMove && crouchToggled;
    // Double-tap W, then hold the second press, to sprint.
    // Crouching always overrides sprint, even while W remains held.
    const sprinting =
      canMove &&
      !crouching &&
      sprintArmed &&
      pressed.has('KeyW') &&
      inputZ > 0;
    let desiredVelocity = Vector3.Zero();

    if (hasMovementInput) {
      const inputLength = Math.hypot(inputX, inputZ);
      inputX /= inputLength;
      inputZ /= inputLength;
      const yaw = camera.rotation.y;
      const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const direction = forward.scale(inputZ).add(right.scale(inputX));
      const speed = crouching
        ? PLAYER.crouchSpeed
        : sprinting
          ? PLAYER.sprintSpeed
          : PLAYER.walkSpeed;
      desiredVelocity = direction.normalize().scale(speed);
    }

    // Acceleration and deceleration make movement responsive without feeling abrupt.
    const acceleration = grounded
      ? PLAYER.groundAcceleration
      : PLAYER.airAcceleration;
    const movementBlend = 1 - Math.exp(-acceleration * deltaSeconds);
    horizontalVelocity = Vector3.Lerp(
      horizontalVelocity,
      desiredVelocity,
      movementBlend,
    );

    if (jumpQueued && grounded && canMove) {
      verticalVelocity = PLAYER.jumpSpeed;
      grounded = false;
    }
    jumpQueued = false;
    verticalVelocity = Math.max(
      -30,
      verticalVelocity + PLAYER.gravity * deltaSeconds,
    );

    playerCollider.moveWithCollisions(
      new Vector3(
        horizontalVelocity.x * deltaSeconds,
        verticalVelocity * deltaSeconds,
        horizontalVelocity.z * deltaSeconds,
      ),
    );

    const groundRay = new Ray(
      playerCollider.position,
      Vector3.Down(),
      PLAYER.colliderHalfHeight + 0.14,
    );
    const groundHit = scene.pickWithRay(
      groundRay,
      (mesh) => mesh.checkCollisions && mesh !== playerCollider,
    );
    grounded = verticalVelocity <= 0 && Boolean(groundHit?.hit);
    if (grounded) verticalVelocity = -0.8;

    camera.position.copyFrom(playerCollider.position);
    const targetEyeHeight = crouching
      ? PLAYER.crouchEyeHeight
      : PLAYER.eyeHeight;
    const crouchBlend = Math.min(1, deltaSeconds * 12);
    currentEyeHeight +=
      (targetEyeHeight - currentEyeHeight) * crouchBlend;
    camera.position.y += currentEyeHeight - PLAYER.colliderHalfHeight;
    if (sprinting && grounded) {
      // A small vertical stride motion makes sprinting feel faster without
      // making the view difficult to control.
      camera.position.y += Math.sin(now * 0.016) * 0.035;
    }
    weapon?.update(now, sprinting);
    if (matchActive && document.pointerLockElement === canvas) {
      bot.update(deltaSeconds, now);
    }

    // Safety reset in case the player ever slips outside the arena.
    if (playerCollider.position.y < -8) {
      resetPlayerPosition();
    }
  });

  engine.runRenderLoop(() => scene.render());
  const onResize = () => engine.resize();
  window.addEventListener('resize', onResize);

  return {
    selectWeapon: (weaponId: WeaponId) => {
      if (gameOver || !playerAlive) return;
      weapon?.selectWeapon(weaponId);
    },
    requestPointerLock: () => {
      if (gameOver) return;
      matchActive = true;
      requestMouseLock();
    },
    playAgain: () => {
      if (playerRespawnTimer) clearTimeout(playerRespawnTimer);
      playerRespawnTimer = null;
      restorePlayerHealth();
      playerAlive = true;
      playerScore = 0;
      botScore = 0;
      arena.updateScore(playerScore, botScore);
      gameOver = false;
      matchActive = true;
      resetPlayerPosition();
      camera.attachControl(canvas, true);
      bot.reset();
      weapon?.reset();
      weapon?.setActive(true);
      onHudUpdate({
        health: playerHealth,
        regenerating: false,
        dead: false,
        roundWon: false,
        playerScore,
        botScore,
        result: 'none',
        paused: false,
      });
      requestMouseLock();
    },
    dispose: () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('click', onCanvasClick);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      if (playerRespawnTimer) clearTimeout(playerRespawnTimer);
      weapon?.dispose();
      bot.dispose();
      playerCollider.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
