import { createSpectator, type SpectatorActor } from './createSpectator';
import {teamSpawn,teamOf,mapScale,type TeamSize} from './teams';
import {createReplayBuffer} from './killReplay';
import {FALL_DEATH_Y,barrelDamage,type EnvironmentState} from './arenaEnvironment';
import {createDeathRecap} from './deathRecap';
import {ARENA_MAPS,DEFAULT_MAP,isArenaMapId,type ArenaMapId} from './maps';
import { createMatchEntry } from './createMatchEntry';
import { createCombatPerformance } from './combatXp';
import { EMPTY_COSMETICS, type Cosmetics } from './progression';
/// <reference types="vite/client" />
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
  getWeaponDamage,
  applyWeaponDamage,
  type WeaponHitZone,
  type WeaponId,
  type PrimaryWeaponId,
} from './weaponDefinitions';
import { createRemotePlayer } from './createRemotePlayer';
import type { GrenadeThrow, PlayerPose } from './onlineMovement';
import type { OnlineEffect } from './onlineEffects';
import { createOnlineTracers } from './createOnlineTracers';
import { createArena } from './createArena';
import { createLobby, LOBBY_SPAWN } from './createLobby';
import { nearbyLobbyStation, type LobbyStationId } from './lobbyStations';
import { createLaserPartsProgress } from './laserParts';
import {
  BOT,
  MATCH,
  MAX_HEALTH,
  PLAYER,
  SPAWNS,
} from './config';
import { createWeapon } from './createWeapon';
import type { GameHudUpdate } from './types';
import { createSwordBoost, SWORD_BOOST } from './createSwordBoost';
import { createRockets } from './createRockets';
import { getBlastImpulse, steerBlast } from './blastJump';
import { createCharacterHands } from './createCharacterHands';
import { DEFAULT_CHARACTER, type CharacterAppearance } from './storeCatalog';
import { classifyBotHit } from './headshots';
import { createMolotovs } from './createMolotov';
import { createGrenades } from './createGrenade';
import { createBot } from './createBot';
import { createBotNavigation } from './createBotNavigation';
import type { Difficulty } from './difficulty';
import { createSlide, SLIDE } from './createSlide';
import { createGrapple } from './createGrapple';

// React refresh preserves the running Babylon scene. Rebuild the page when
// a game module changes so removed meshes/textures cannot remain on screen.
// Vite removes this development-only branch from production builds.
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
}

export function createGame(
  canvas: HTMLCanvasElement,
  onHudUpdate: (update: GameHudUpdate) => void,
  canUseWeapon: (weaponId: WeaponId) => boolean = (id) => id === 'assaultRifle' || id === 'pistol',
  getPrimaryWeapon: () => PrimaryWeaponId = () => 'assaultRifle',
  getDifficulty: () => Difficulty = () => 'normal',
  getMeleeWeapon: () => 'sword' | 'orbiter' = () => 'orbiter',
  onLobbyInteract: (station: LobbyStationId) => void = () => {},
  getUtilityWeapon: () => 'grenade' | 'molotov' = () => 'grenade',
  getSecondaryWeapon: () => 'pistol' | 'uzi' = () => 'pistol',
  getCosmetics: () => Cosmetics = () => EMPTY_COSMETICS,
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
  const spectator = createSpectator(scene, state => onHudUpdate({ spectator: state }));

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

  let arena = createArena(scene);
  let arenaMap:ArenaMapId=DEFAULT_MAP;
  const lobby = createLobby(scene);
  let partsStorage: Storage | undefined;
  try { partsStorage = window.localStorage; } catch { /* Session-only collection if browser storage is blocked. */ }
  const laserParts = createLaserPartsProgress(partsStorage);
  lobby.secrets.setCollected(laserParts.state.found);
  onHudUpdate({ laserPartsCount: laserParts.state.count, laserUnlocked: laserParts.state.unlocked, laserProgressSaved: laserParts.state.saved });
  let lastNearbyPart: string | null = null;
  let inLobby = true;
  let opponentCosmetics: Cosmetics = { ...EMPTY_COSMETICS };
  let onlinePlayer: number | null = null;
  let onlineOpponentAlive = true;
  let networkPaused=false;
  let preMatchLocked = false;
  let onlineShotListener: ((id: WeaponId) => void) | null = null;
  let onlineGrenadeListener: ((data: GrenadeThrow) => void) | null = null;
  let onlineEffectListener: ((data: OnlineEffect) => void) | null = null;
  const onlineTracers = createOnlineTracers(scene);
  const remotePlayer = createRemotePlayer(scene);
  const characterHands = createCharacterHands(scene,camera); characterHands.root.setEnabled(false);
  let characterScoped = false;
  let lastLobbyStation: LobbyStationId | null = null;
  // Keep the empty scoreboard screens free of stadium glow.
  arena.scoreMeshes.forEach((mesh) => glow.addExcludedMesh(mesh));
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
  let blastAirborne = false;
  let jumpQueued = false;
  let currentEyeHeight = PLAYER.eyeHeight;
  let crouchToggled = false;
  let lastForwardPressAt = -Infinity;
  let sprintArmed = false;
  const slide = createSlide();

  const swordBoost = createSwordBoost();
  let lastBoostHud = '';
  const roundPerformance = createCombatPerformance(performance.now());
  const incomingDamage=createDeathRecap();
  const replay=createReplayBuffer();
  const enemyReplays=new Map<number,ReturnType<typeof createReplayBuffer>>();
  const enemyPerformance=new Map<number,ReturnType<typeof createCombatPerformance>>();
  let lastKillerSlot=1;
  const botPerformance=createCombatPerformance(performance.now());
  let environmentSeconds=0;
  let environmentRunning=false;
  let oilKillerBot=false;
  let playerAppearance={...DEFAULT_CHARACTER};
  function captureReplay(shot?:import('./killReplay').ReplayFrame['shot'],force=false) {
    if(!bot||inLobby||onlinePlayer)return;
    replay.capture(performance.now(),[
      {pose:{x:playerCollider.position.x,y:playerCollider.position.y,z:playerCollider.position.z,yaw:camera.rotation.y,pitch:camera.rotation.x},health:playerHealth,weapon:weapon?.id??'assaultRifle'},
      {pose:{x:bot.root.position.x,y:bot.root.position.y,z:bot.root.position.z,yaw:bot.root.rotation.y+Math.PI,pitch:0},health:bot.health,weapon:'assaultRifle'},
    ],shot,arena.environment.state,force);
    for(const u of teamUnits.filter(u=>u.slot>=botTeamSize)){
      let buffer=enemyReplays.get(u.slot);if(!buffer){buffer=createReplayBuffer();enemyReplays.set(u.slot,buffer);}
      buffer.capture(performance.now(),[
        {pose:{x:playerCollider.position.x,y:playerCollider.position.y,z:playerCollider.position.z,yaw:camera.rotation.y,pitch:camera.rotation.x},health:playerHealth,weapon:weapon?.id??'assaultRifle'},
        {pose:{x:u.bot.root.position.x,y:u.bot.root.position.y,z:u.bot.root.position.z,yaw:u.bot.root.rotation.y+Math.PI,pitch:0},health:u.bot.health,weapon:'assaultRifle'},
      ],shot?.actor===0?shot:undefined,arena.environment.state,force);
    }
  }
  function resetPlayerPosition() {
    spectator.stop();
    roundPerformance.reset(performance.now());
    incomingDamage.reset();replay.reset();botPerformance.reset(performance.now());enemyReplays.forEach(b=>b.reset());enemyPerformance.forEach(p=>p.reset(performance.now()));
    blastAirborne = false;
    swordBoost.reset();
    grenades.clear(); molotovs.clear();
    rockets.clear();
    grapple.cancel();
    playerCollider.position.set(
      inLobby ? LOBBY_SPAWN.x : onlinePlayer === 2 ? SPAWNS.bot.x : SPAWNS.player.x,
      PLAYER.colliderHalfHeight,
      inLobby ? LOBBY_SPAWN.z : onlinePlayer === 2 ? SPAWNS.bot.z : SPAWNS.player.z,
    );
    camera.position.copyFrom(inLobby ? LOBBY_SPAWN : SPAWNS.player);
    if (onlinePlayer === 2 && !inLobby) camera.position.set(SPAWNS.bot.x, PLAYER.eyeHeight, SPAWNS.bot.z);
    camera.rotation.set(0, onlinePlayer === 2 && !inLobby ? SPAWNS.botYaw : SPAWNS.playerYaw, 0);
    horizontalVelocity.setAll(0);
    verticalVelocity = 0;
    grounded = true;
    currentEyeHeight = PLAYER.eyeHeight;
    crouchToggled = false;
    lastForwardPressAt = -Infinity;
    sprintArmed = false;
    slide.reset();
    jumpQueued = false;
  }

  let playerHealth = PLAYER.maxHealth;
  let displayedPlayerHealth = PLAYER.maxHealth;
  let playerAlive = true;
  let playerRespawnTimer: ReturnType<typeof setTimeout> | null = null;
  let damageId = 0;
  let weapon: ReturnType<typeof createWeapon> | null = null;
  let bot!: ReturnType<typeof createBot>;
  let playerScore = 0;
  let botScore = 0;
  let botTeamSize:TeamSize=1,teamIntermission=false;
  type Unit={bot:ReturnType<typeof createBot>;slot:number;target:number;name:string};
  const teamUnits:Unit[]=[];
  let rookTarget=-1,lastAttacker='Rook';
  let teamOnlineSlot:number|null=null,teamOnlineSize=1;
  const teamRemoteVisible=new Set<number>();
  const teamRemotes=new Map<number,ReturnType<typeof createRemotePlayer>>();
  let onlineRoster:import('./teamProtocol').TeamPlayer[]=[];
  let onlineRoundOver=false;
  function botRoster():SpectatorActor[]{
    return [{slot:0,team:0,name:'Player1',health:playerHealth,connected:true,weapon:weapon?.id??'assaultRifle',pose:()=>({x:playerCollider.position.x,y:playerCollider.position.y,z:playerCollider.position.z,yaw:camera.rotation.y,pitch:camera.rotation.x})},
      ...[{bot,slot:botTeamSize,name:'Rook'},...teamUnits].map(u=>({slot:u.slot,team:teamOf(u.slot,botTeamSize),name:u.name,health:u.bot.health,connected:true,weapon:'assaultRifle' as WeaponId,pose:()=>({x:u.bot.root.position.x,y:u.bot.root.position.y,z:u.bot.root.position.z,yaw:u.bot.root.rotation.y+Math.PI,pitch:0})}))].sort((a,b)=>a.slot-b.slot);
  }
  function updateSpectatorRoster(){
    if(teamOnlineSlot!==null){
      spectator.setRoster(onlineRoster.map(p=>({slot:p.slot,team:teamOf(p.slot,teamOnlineSize),name:p.name,health:p.health,connected:p.connected,weapon:p.weapon,level:p.profile.level,kills:p.kills,deaths:p.deaths,pose:()=>p.slot===teamOnlineSlot?p.pose:teamRemotes.get(p.slot)?.readPose()??null})),teamOnlineSlot,onlineRoundOver);
    }else if(bot&&!inLobby){spectator.setRoster(botRoster(),0,teamIntermission||botTeamSize===1);}
  }
  function beginSpectating(){
    if(inLobby||playerHealth>0)return;
    pressed.clear();jumpQueued=false;horizontalVelocity.setAll(0);verticalVelocity=0;slide.cancel();grapple.cancel();
    weapon?.setActive(false);characterHands.root.setEnabled(false);camera.detachControl();camera.cameraRotation.setAll(0);
    if(document.pointerLockElement===canvas)document.exitPointerLock();
    updateSpectatorRoster();spectator.start();spectator.update(0);
  }
  function unitHealth(){return [playerHealth,...teamUnits.filter(u=>u.slot<botTeamSize).map(u=>u.bot.health),bot.health,...teamUnits.filter(u=>u.slot>=botTeamSize).map(u=>u.bot.health)];}
  function updateTeamHud(){
    if(!bot||inLobby||onlinePlayer)return;
    onHudUpdate({teamIntermission,teamAlive:unitHealth().map(h=>h>0),teamSize:botTeamSize,participants:botRoster().map(({pose:_pose,...p})=>p)});
    updateSpectatorRoster();
  }
  function finishTeamRound(winner:number){
    if(teamIntermission||gameOver||inLobby)return;teamIntermission=true;
    if(winner===0)playerScore++;else botScore++;
    updateSpectatorRoster();
    playerAlive=false;weapon?.setActive(false);camera.detachControl();
    onHudUpdate({teamIntermission:true,playerScore,botScore,roundWon:winner===0,dead:winner!==0,elimination:roundPerformance.read(playerHealth,performance.now())});
    if(playerScore>=5||botScore>=5){endMatch(winner===0?'victory':'defeat');return;}
    playerRespawnTimer=setTimeout(()=>{playerRespawnTimer=null;teamIntermission=false;restorePlayerHealth();playerAlive=true;resetPlayerPosition();resetTeamUnits();arena.cover.reset();arena.environment.reset();environmentSeconds=0;if(document.pointerLockElement===canvas)camera.attachControl(canvas,true);weapon?.reset();weapon?.setActive(true);onHudUpdate({teamIntermission:false,dead:false,roundWon:false,health:100,paused:document.pointerLockElement!==canvas});updateTeamHud();},3000);
  }
  function checkTeamRound(){
    updateTeamHud();if(botTeamSize===1||teamIntermission||gameOver)return;
    const allyAlive=playerAlive||teamUnits.some(u=>u.slot<botTeamSize&&u.bot.alive);
    const enemyAlive=bot.alive||teamUnits.some(u=>u.slot>=botTeamSize&&u.bot.alive);
    if(!enemyAlive)finishTeamRound(0);else if(!allyAlive)finishTeamRound(1);
  }
  function resetTeamUnits(){
    const spawn=teamSpawn(0,botTeamSize,arenaMap);playerCollider.position.set(spawn.x,.9,spawn.z);camera.position.copyFrom(playerCollider.position);camera.position.y+=.82;
    bot.setSpawn(new Vector3(...[teamSpawn(botTeamSize,botTeamSize,arenaMap).x,1,teamSpawn(botTeamSize,botTeamSize,arenaMap).z]));bot.setAutoRespawn(botTeamSize===1);bot.reset();bot.setTarget(null);
    teamUnits.forEach(u=>{const p=teamSpawn(u.slot,botTeamSize,arenaMap);u.bot.setSpawn(new Vector3(p.x,1,p.z));u.bot.reset();});
  }
  function buildTeamUnits(size:TeamSize){
    teamUnits.splice(0).forEach(u=>u.bot.dispose());enemyPerformance.clear();enemyReplays.clear();botTeamSize=size;lastKillerSlot=size;teamIntermission=false;
    const navigation = size > 1 ? createBotNavigation(scene, mapScale(arenaMap)) : null;
    bot.configureTeam(size, size, mapScale(arenaMap), navigation);
    for(let slot=1;slot<size*2;slot++){
      if(slot===size)continue;
      enemyPerformance.set(slot,createCombatPerformance(performance.now()));
      const unit:Unit={slot,target:-1,name:slot<size?`Ally ${slot}`:`Rook ${slot-size+1}`,bot:null!};
      unit.bot=createBot(scene,camera,{onEliminated:checkTeamRound,onHealthChange:()=>updateTeamHud(),isPlayerAlive:()=>true,onPlayerHit:(id,zone)=>hitUnitTarget(unit.target,id,zone,unit.name),onShot:(origin,direction)=>{enemyPerformance.get(slot)?.shot();captureReplay();enemyReplays.get(slot)?.capture(performance.now(),[{pose:{x:playerCollider.position.x,y:playerCollider.position.y,z:playerCollider.position.z,yaw:camera.rotation.y,pitch:camera.rotation.x},health:playerHealth,weapon:weapon?.id??'assaultRifle'},{pose:{x:unit.bot.root.position.x,y:unit.bot.root.position.y,z:unit.bot.root.position.z,yaw:unit.bot.root.rotation.y+Math.PI,pitch:0},health:unit.bot.health,weapon:'assaultRifle'}],{actor:1,origin:{x:origin.x,y:origin.y,z:origin.z},direction:{x:direction.x,y:direction.y,z:direction.z}},arena.environment.state);},onEnvironmentHit:(mesh,id)=>arena.environment.hit(mesh,getWeaponDamage(id,'body'),p=>oilExplosion(p,true))},getDifficulty);
      unit.bot.setTeam(teamOf(slot,size));unit.bot.configureTeam(slot,size,mapScale(arenaMap),navigation);unit.bot.setAutoRespawn(false);unit.bot.setPatrolRoute(ARENA_MAPS[arenaMap].patrol);teamUnits.push(unit);
    }
    resetTeamUnits();updateTeamHud();
  }
  function hitUnitTarget(target:number,id:WeaponId,zone:WeaponHitZone,name:string){
    if(target===0){lastAttacker=name;lastKillerSlot=teamUnits.find(u=>u.name===name)?.slot??botTeamSize;damagePlayer(id,zone);}else if(target===botTeamSize)bot.takeDamage(id,zone);else teamUnits.find(u=>u.slot===target)?.bot.takeDamage(id,zone);checkTeamRound();
  }
  function updateTeamBots(dt:number,now:number){
    if(teamIntermission)return;
    const bots = [{bot,slot:botTeamSize,target:rookTarget},...teamUnits];
    const units = [{slot:0,alive:playerAlive,position:playerCollider.position.clone()},
      ...bots.map(u=>({slot:u.slot,alive:u.bot.alive,position:u.bot.root.position.clone(),target:u.target}))];
    // Decide from one frame snapshot before anyone moves or fires.
    for(const u of bots){
      if(!u.bot.alive)continue;
      u.target=u.bot.planTeamStep(units,now);
      if(u.bot===bot)rookTarget=u.target;
    }
    for(const u of bots){
      if(!u.bot.alive||teamIntermission)continue;
      u.bot.update(dt,now);
      if(u.bot.root.position.y<FALL_DEATH_Y)u.bot.takeHazardDamage(100);
    }
    checkTeamRound();
  }
  let matchActive = false;
  let gameOver = false;
  const grapple = createGrapple(scene, camera, canvas, playerCollider,
    PLAYER.colliderHalfHeight + .25,
    () => !inLobby && matchActive && playerAlive && !gameOver && weapon?.id === 'orbiter' && canUseWeapon('orbiter'),
    (mesh) => mesh.checkCollisions && mesh !== playerCollider && mesh !== bot?.root && mesh.metadata?.owner !== 'bot',
    (grappleState) => onHudUpdate({ grappleState }));
  let wasGrappling = false;
  onHudUpdate({
    health: playerHealth,
    maxHealth: MAX_HEALTH,
    dead: false,
    roundWon: false,
    playerScore,
    botScore,
    result: 'none',
    paused: false,
  });

  const botEntry=createMatchEntry(()=>document.pointerLockElement===canvas,()=>canvas.requestPointerLock(),onHudUpdate);
  function requestMouseLock() {
    if (preMatchLocked || networkPaused || !playerAlive) return;
    // Embedded preview browsers may reject pointer lock. Keep that failure graceful.
    if (document.pointerLockElement===canvas) return;
    try { Promise.resolve(canvas.requestPointerLock()).catch(() => onHudUpdate({ paused: true })); }
    catch { onHudUpdate({ paused: true }); }
  }

  function restorePlayerHealth() {
    playerHealth = PLAYER.maxHealth;
    displayedPlayerHealth = PLAYER.maxHealth;
  }

  function endMatch(result: 'victory' | 'defeat') {
    gameOver = true;
    matchActive = false;
    restorePlayerHealth();
    playerAlive = true;
    resetPlayerPosition();
    bot.reset();
    arena.cover.reset();arena.environment.reset();environmentSeconds=0;
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
      botHealth: BOT.maxHealth,
    });
  }

  function damagePlayer(weaponId: WeaponId, hitZone: WeaponHitZone) {
    const attackerRoot=teamUnits.find(u=>u.slot===lastKillerSlot)?.bot.root??bot.root;
    (enemyPerformance.get(lastKillerSlot)??botPerformance).damage(playerHealth,Math.max(0,playerHealth-getWeaponDamage(weaponId,hitZone)),hitZone==='head',Vector3.Distance(camera.position,attackerRoot.position));
    hurtPlayer(weaponId,getWeaponDamage(weaponId,hitZone),hitZone,Vector3.Distance(camera.position,attackerRoot.position));
  }
  function hurtPlayer(source:import('./deathRecap').DamageSource,amount:number,hitZone:WeaponHitZone,distance:number) {
    if (inLobby || !playerAlive || gameOver) return;
    const before=playerHealth;
    playerHealth = Math.max(0,playerHealth-amount);
    incomingDamage.record(source,hitZone,before,playerHealth,distance);
    displayedPlayerHealth = Math.floor(playerHealth);
    onHudUpdate({
      health: displayedPlayerHealth,
      damageId: ++damageId,
    });
    updateTeamHud();
    if (playerHealth > 0) return;

    playerAlive = false;
    if(botTeamSize===1)botScore += 1;
    weapon?.setActive(false);
    camera.detachControl();
    captureReplay(undefined,true);
    const killerHealth=teamUnits.find(u=>u.slot===lastKillerSlot)?.bot.health??bot.health;
    const recap={...incomingDamage.read(source==='fall'?'The void':source==='oilBarrel'?'Oil barrel':lastAttacker,killerHealth,roundPerformance.read(0,performance.now()).damageDealt),killerStats:(enemyPerformance.get(lastKillerSlot)??botPerformance).read(killerHealth,performance.now()),replay:(enemyReplays.get(lastKillerSlot)??replay).read(arenaMap,source==='fall'||source==='oilBarrel'&&!oilKillerBot?0:1,arena.environment.state.barrelHealth,arena.environment.state.seconds)};
    if(recap.replay)recap.replay.botActor=1;
    onHudUpdate({ deathRecap:{...recap,replayProfiles:[{level:1,cosmetics:getCosmetics(),character:playerAppearance},{level:1,cosmetics:EMPTY_COSMETICS}]}, dead: true, roundWon: false, botScore, paused: false, elimination:roundPerformance.read(0,performance.now()) });
    beginSpectating();
    if(botTeamSize>1){checkTeamRound();return;}
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
      arena.cover.reset();arena.environment.reset();environmentSeconds=0;
      if (document.pointerLockElement === canvas)
        camera.attachControl(canvas, true);
      weapon?.reset();
      weapon?.setActive(true);
      onHudUpdate({
        health: playerHealth,
        botHealth: BOT.maxHealth,
        dead: false,
        roundWon: false,
        paused: document.pointerLockElement !== canvas,
      });
    }, 3000);
  }

  bot = createBot(scene, camera, {
    onEliminated: () => {
      if (inLobby || gameOver) return;
      if(botTeamSize>1){checkTeamRound();return;}
      playerScore += 1;
      if (playerScore >= MATCH.scoreToWin) {
        onHudUpdate({ playerScore, elimination:roundPerformance.read(playerHealth,performance.now()) });
        endMatch('victory');
        return;
      }

      onHudUpdate({ playerScore, roundWon: true, elimination:roundPerformance.read(playerHealth,performance.now()) });

      // The player won this round. Reset both rivals together after the
      // same three-second round break used when the player is eliminated.
      playerAlive = false;
      weapon?.setActive(false);
      camera.detachControl();
      playerRespawnTimer = setTimeout(() => {
        playerRespawnTimer = null;
        restorePlayerHealth();
        playerAlive = true;
        resetPlayerPosition();
        bot.reset();
        arena.cover.reset();arena.environment.reset();environmentSeconds=0;
        if (document.pointerLockElement === canvas)
          camera.attachControl(canvas, true);
        weapon?.reset();
        weapon?.setActive(true);
        onHudUpdate({
          health: playerHealth,
          botHealth: BOT.maxHealth,
          dead: false,
          roundWon: false,
          paused: document.pointerLockElement !== canvas,
        });
      }, BOT.respawnMs);
    },
    onHealthChange: (botHealth) => {onHudUpdate({ botHealth });updateTeamHud();},
    onPlayerHit: (id,zone)=>{if(botTeamSize>1)hitUnitTarget(rookTarget,id,zone,'Rook');else {lastAttacker='Rook';damagePlayer(id,zone);}},
    onShot:(origin,direction)=>{botPerformance.shot();captureReplay({actor:1,origin:{x:origin.x,y:origin.y,z:origin.z},direction:{x:direction.x,y:direction.y,z:direction.z}});},
    onEnvironmentHit:(mesh,id)=>{if(matchActive&&(playerAlive||botTeamSize>1)&&!gameOver)arena.environment.hit(mesh,getWeaponDamage(id,'body'),point=>oilExplosion(point,true));},
    isPlayerAlive: () => playerAlive,
  }, getDifficulty);

  const shadows = new ShadowGenerator(1024, keyLight);
  shadows.useBlurExponentialShadowMap = true;
  shadows.blurKernel = 18;
  bot.root.getChildMeshes().forEach((mesh) => shadows.addShadowCaster(mesh));

  function launchPlayerFromBlast(position: Vector3) {
    if (!playerAlive || gameOver || !grenades.canDamage(position, playerCollider.position)) return;
    const impulse = getBlastImpulse(position, playerCollider.position, camera.rotation.y);
    if (!impulse) return;
    // Release clinging/sliding so these systems cannot overwrite the launch.
    grapple.cancel(); wasGrappling = false; slide.cancel();
    crouchToggled = false; jumpQueued = false;
    horizontalVelocity = steerBlast(horizontalVelocity.add(new Vector3(impulse.x, 0, impulse.z)), Vector3.Zero(), 0);
    verticalVelocity = Math.max(verticalVelocity, impulse.y);
    grounded = false; blastAirborne = true;
  }
  function oilExplosion(point:Vector3,byBot=false) {
    if(inLobby||onlinePlayer||!matchActive||gameOver||!playerAlive&&botTeamSize===1)return;
    oilKillerBot=byBot;
    const distance=Vector3.Distance(point,playerCollider.position),amount=barrelDamage(distance);
    if(amount&&arena.environment.visible(point,playerCollider.position)){
      if(byBot)botPerformance.damage(playerHealth,Math.max(0,playerHealth-amount),false,distance);
      hurtPlayer('oilBarrel',amount,'splash',distance);
    }
    if(!playerAlive&&botTeamSize===1)return;
    for(const u of teamUnits){const d=Vector3.Distance(point,u.bot.root.position),amount=barrelDamage(d);if(u.bot.alive&&amount&&arena.environment.visible(point,u.bot.root.position))u.bot.takeHazardDamage(amount);}
    const botDistance=Vector3.Distance(point,bot.root.position),botAmount=barrelDamage(botDistance);
    if(bot.alive&&botAmount&&arena.environment.visible(point,bot.root.position)){
      if(!byBot){roundPerformance.damage(bot.health,Math.max(0,bot.health-botAmount),false,botDistance,!grounded);onHudUpdate({hitMarker:'body',hitId:++hitId});}
      bot.takeHazardDamage(botAmount);
    }
  }
  const grenades = createGrenades(scene, (position, self) => {
    if (!matchActive || gameOver || !playerAlive) return;
    if (self) launchPlayerFromBlast(position);
    if (onlinePlayer) return; // Online health is determined by the server.
    arena.environment.blast(position,4,34,oilExplosion);
    if(!playerAlive)return;
    for(const b of [bot,...teamUnits.filter(u=>u.slot>=botTeamSize).map(u=>u.bot)])if(b.alive&&grenades.canDamage(position,b.root.position)){currentHitUnit=b;damageBot('grenade','splash');currentHitUnit=null;onHudUpdate({hitMarker:'body',hitId:++hitId});}
    // Player-owned explosions never damage their thrower.
  });
  const molotovs = createMolotovs(scene, (position) => {
    if (onlinePlayer) return;
    if (inLobby || !matchActive || gameOver || !playerAlive) return;
    arena.environment.blast(position,3,5,oilExplosion);
    if(!playerAlive)return;
    for(const b of [bot,...teamUnits.filter(u=>u.slot>=botTeamSize).map(u=>u.bot)])if(b.alive&&molotovs.canDamage(position,b.root.position)){currentHitUnit=b;damageBot('molotov','body');currentHitUnit=null;onHudUpdate({hitMarker:'body',hitId:++hitId});}
  });
  const rockets = createRockets(scene, (position, direct, self) => {
    if (!matchActive || gameOver || !playerAlive) return;
    if (self) launchPlayerFromBlast(position);
    if (onlinePlayer) return;
    if(direct)arena.environment.hit(direct,getWeaponDamage('rocketLauncher','direct'),oilExplosion);
    arena.environment.blast(position,4,34,oilExplosion);
    if(!playerAlive)return;
    for(const b of [bot,...teamUnits.filter(u=>u.slot>=botTeamSize).map(u=>u.bot)]){const directBot=direct!==null&&b.ownsMesh(direct);if(b.alive&&(directBot||grenades.canDamage(position,b.root.position))){currentHitUnit=b;damageBot('rocketLauncher',directBot?'direct':'splash');currentHitUnit=null;onHudUpdate({hitMarker:directBot?'direct':'body',hitId:++hitId});}}
    if(direct&&[bot,...teamUnits.filter(u=>u.slot>=botTeamSize).map(u=>u.bot)].some(b=>b.ownsMesh(direct)))onHudUpdate({hitMarker:'direct',hitId:++hitId});
    // Player-owned rockets never damage their shooter.
  });
  function damageBot(id:WeaponId, zone:WeaponHitZone) {
    const actual=currentHitUnit??bot;
    if (!actual.alive) return;
    const after=applyWeaponDamage(actual.health,id,zone);
    roundPerformance.damage(actual.health,after,zone==='head',Vector3.Distance(camera.position,actual.root.position),!grounded);
    actual.takeDamage(id,zone);
    checkTeamRound();
  }
  let currentHitUnit:ReturnType<typeof createBot>|null=null;
  let hitId = 0;
  function onlineFire(id: WeaponId, origin: Vector3, direction: Vector3, remote = false) {
    if (remote) remotePlayer.fire(id);
    if (id === 'rocketLauncher') rockets.fire(origin,direction,remote ? [playerCollider] : (teamOnlineSlot!==null?[...teamRemotes.entries()].filter(([id])=>teamOf(id,teamOnlineSize)!==teamOf(teamOnlineSlot!,teamOnlineSize)).flatMap(([,r])=>r.projectileTargets):remotePlayer.projectileTargets),!remote);
    else if (id === 'molotov') molotovs.throw(origin,direction);
    else if (id === 'grenade') grenades.throw(origin,direction,remote ? opponentCosmetics : getCosmetics(),!remote);
    else onlineTracers.fire(id,origin,direction);
    if (!remote) onlineEffectListener?.({ action:'fire', weapon:id,
      origin:{ x:origin.x,y:origin.y,z:origin.z }, direction:{ x:direction.x,y:direction.y,z:direction.z } });
  }
  weapon = createWeapon(scene, camera, canvas, {
    onVisualShot: (id,origin,direction) => { if (!onlinePlayer) {roundPerformance.shot();captureReplay({actor:0,origin:{x:origin.x,y:origin.y,z:origin.z},direction:{x:direction.x,y:direction.y,z:direction.z}});} if (onlinePlayer) onlineFire(id,origin,direction); },
    onReloadVisual: (id,active) => { if (onlinePlayer) onlineEffectListener?.({ action:active?'reload':'reloadEnd',weapon:id }); },
    canUseWeapon: (id) => id === 'laserCannon' ? laserParts.state.unlocked : canUseWeapon(id),
    getCosmetics,
    getPrimaryWeapon,
    getMeleeWeapon, getUtilityWeapon, getSecondaryWeapon,
    onThrowMolotov: (origin, direction) => {
      if (!onlinePlayer) {roundPerformance.shot();captureReplay({actor:0,origin:{x:origin.x,y:origin.y,z:origin.z},direction:{x:direction.x,y:direction.y,z:direction.z}});}
      if (onlinePlayer) onlineFire('molotov',origin,direction);
      else molotovs.throw(origin,direction);
    },
    onFireRocket: (origin, direction) => rockets.fire(origin, direction),
    onThrowGrenade: (origin, direction) => {
      if (!onlinePlayer) {roundPerformance.shot();captureReplay({actor:0,origin:{x:origin.x,y:origin.y,z:origin.z},direction:{x:direction.x,y:direction.y,z:direction.z}});}
      if (onlinePlayer) onlineFire('grenade',origin,direction);
      else grenades.throw(origin,direction,getCosmetics());
    },
    onScopeChange: (scoped) => { characterScoped=scoped;onHudUpdate({ scoped }); },
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
    onImpact: (mesh, weaponId, point) => {
      if (onlinePlayer) return 'none';
      if(!inLobby&&matchActive&&playerAlive&&!gameOver&&arena.environment.hit(mesh,getWeaponDamage(weaponId,'body'),oilExplosion))return 'none';
      if (!inLobby && matchActive && playerAlive && !gameOver && arena.cover.hit(mesh, weaponId, point)) return 'none';
      const candidate=[{bot,slot:botTeamSize},...teamUnits].find(u=>u.bot.ownsMesh(mesh));
      if(!candidate||candidate.slot<botTeamSize)return 'none';
      currentHitUnit=candidate.bot;
      const hitZone = classifyBotHit(mesh, point);
      damageBot(weaponId, hitZone);currentHitUnit=null;
      return hitZone;
    },
    onHitMarker: (hitMarker) => onHudUpdate({ hitMarker, hitId: ++hitId }),
  });

  weapon.setCosmetics(getCosmetics());

  // A subtle dome keeps the horizon clean without requiring downloaded assets.
  const sky = MeshBuilder.CreateSphere(
    'arena sky',
    { diameter: 360, segments: 20, sideOrientation: Mesh.BACKSIDE },
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

  function interactLobby() {
    if (!inLobby) return;
    const part = lobby.secrets.nearby(camera.position);
    if (part && laserParts.collect(part.id)) {
      const progress = laserParts.state;
      lobby.secrets.setCollected(progress.found);
      onHudUpdate({
        nearbyLaserPart: null, laserPartsCount: progress.count,
        laserUnlocked: progress.unlocked, laserProgressSaved: progress.saved,
        laserNotice: progress.unlocked ? 'Helion unlocked! Equip it in the Armory.' : `${part.name} recovered · ${progress.count}/5 parts`,
      });
      return;
    }
    const station = nearbyLobbyStation(playerCollider.position);
    if (!station) return;
    // Pause exploration before opening UI. E never also activates a weapon.
    matchActive = false;
    pressed.clear();
    camera.detachControl();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    onHudUpdate({ paused: true });
    onLobbyInteract(station.id);
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (preMatchLocked || networkPaused) return;
    if (inLobby && event.code === 'KeyE') {
      if (!event.repeat && document.pointerLockElement === canvas) interactLobby();
      event.preventDefault();
      return;
    }
    if (!onlinePlayer && event.code === 'KeyE' && !event.repeat && !inLobby && matchActive && playerAlive && !gameOver && document.pointerLockElement === canvas && weapon?.id === 'sword') {
      event.preventDefault(); swordBoost.activate();
    }
    pressed.add(event.code);
    if (
      (event.code === 'ShiftLeft' || event.code === 'ShiftRight') &&
      !event.repeat && matchActive && playerAlive && !gameOver &&
      document.pointerLockElement === canvas
    ) {
      event.preventDefault();
    }
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
      slide.cancel();
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
    botEntry.changed();
    const locked = document.pointerLockElement === canvas;
    if (!locked) {
      slide.cancel();
      jumpQueued = false;
      pressed.clear();
      sprintArmed = false;
      camera.rotation.z = 0;
    }
    if (locked) {
      if (preMatchLocked || networkPaused || !playerAlive) { document.exitPointerLock(); return; }
      camera.attachControl(canvas, true);
      onHudUpdate({ paused: false, awaitingFirstInput: false });
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
    const frameSeconds = engine.getDeltaTime() / 1000;
    const deltaSeconds = Math.min(frameSeconds, 0.05);
    if (preMatchLocked || networkPaused) { spectator.update(frameSeconds); return; }
    const now = performance.now();
    if (inLobby) lobby.update(now);
    if (onlinePlayer) {remotePlayer.update(deltaSeconds);teamRemotes.forEach(r=>r.update(deltaSeconds));}
    const nearbyPart = inLobby ? lobby.secrets.nearby(camera.position)?.name ?? null : null;
    if (nearbyPart !== lastNearbyPart) {
      lastNearbyPart = nearbyPart;
      onHudUpdate({ nearbyLaserPart: nearbyPart });
    }
    const station = inLobby ? nearbyLobbyStation(playerCollider.position)?.id ?? null : null;
    if (station !== lastLobbyStation) {
      lastLobbyStation = station;
      onHudUpdate({ lobbyStation: station });
    }

    const canMove =
      !preMatchLocked &&
      matchActive &&
      playerAlive &&
      !gameOver &&
      document.pointerLockElement === canvas;

    swordBoost.update(canMove ? deltaSeconds : 0, !onlinePlayer && canMove && weapon?.id === 'sword');
    const boostHud = swordBoost.state + swordBoost.seconds;
    if (boostHud !== lastBoostHud) {
      lastBoostHud = boostHud;
      onHudUpdate({ swordBoostState: swordBoost.state, swordBoostSeconds: swordBoost.seconds });
    }
    if(!inLobby&&matchActive&&!gameOver&&(playerAlive||!onlinePlayer&&botTeamSize>1&&!teamIntermission)&&(onlinePlayer?environmentRunning:canMove||botTeamSize>1&&!playerAlive)){
      environmentSeconds+=deltaSeconds;
      arena.environment.update(environmentSeconds,deltaSeconds);
      if(playerAlive&&grounded&&verticalVelocity<=0){const carry=arena.environment.carry(playerCollider.position,PLAYER.colliderHalfHeight);playerCollider.moveWithCollisions(carry);}
    }
    const grappleVelocity = grapple.update(deltaSeconds);
    if (wasGrappling && !grapple.active) { horizontalVelocity.setAll(0); verticalVelocity = 0; }
    wasGrappling = grapple.active;
    if (grapple.active) { slide.cancel(); sprintArmed = false; crouchToggled = false; jumpQueued = false; }

    const holdingSlide = canMove && !grapple.active &&
      (pressed.has('ShiftLeft') || pressed.has('ShiftRight'));
    slide.update(deltaSeconds, holdingSlide);
    if (!canMove || !grounded) slide.cancel();

    let inputX = 0;
    let inputZ = 0;
    if (canMove) {
      if (pressed.has('KeyD')) inputX += 1;
      if (pressed.has('KeyA')) inputX -= 1;
      if (pressed.has('KeyW')) inputZ += 1;
      if (pressed.has('KeyS')) inputZ -= 1;
    }

    const hasMovementInput = inputX !== 0 || inputZ !== 0;
    // Capture the slide direction once, so mouse aiming doesn't steer the boost.
    if (holdingSlide) {
      const yaw = camera.rotation.y;
      // Standing still: slide forward. WASD can select another direction.
      const slideInputX = hasMovementInput ? inputX : 0;
      const slideInputZ = hasMovementInput ? inputZ : 1;
      if (slide.tryStart(
        Math.sin(yaw) * slideInputZ + Math.cos(yaw) * slideInputX,
        Math.cos(yaw) * slideInputZ - Math.sin(yaw) * slideInputX,
        grounded,
      )) {
        crouchToggled = false;
      }
    }
    if (jumpQueued && grounded && canMove) slide.cancel();
    const crouching = canMove && (crouchToggled || slide.active);
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
      desiredVelocity = direction.normalize().scale(speed * (swordBoost.active ? SWORD_BOOST.multiplier : 1));
    }

    // Acceleration and deceleration make movement responsive without feeling abrupt.
    const acceleration = grounded
      ? PLAYER.groundAcceleration
      : PLAYER.airAcceleration;
    const movementBlend = 1 - Math.exp(-acceleration * deltaSeconds);
    if (grapple.active) blastAirborne = false;
    horizontalVelocity = blastAirborne && !grounded
      ? steerBlast(horizontalVelocity, desiredVelocity, canMove ? deltaSeconds : 0)
      : Vector3.Lerp(
      horizontalVelocity,
      desiredVelocity,
      movementBlend,
    );
    if (slide.active) {
      horizontalVelocity.set(
        slide.direction.x * slide.speed * (swordBoost.active ? SWORD_BOOST.multiplier : 1),
        0,
        slide.direction.z * slide.speed * (swordBoost.active ? SWORD_BOOST.multiplier : 1),
      );
    }

    if (jumpQueued && grounded && canMove) {
      verticalVelocity = PLAYER.jumpSpeed;
      grounded = false;
    }
    jumpQueued = false;
    verticalVelocity = Math.max(
      -30,
      verticalVelocity + PLAYER.gravity * deltaSeconds,
    );

    if (grappleVelocity) {
      horizontalVelocity.set(grappleVelocity.x, 0, grappleVelocity.z);
      verticalVelocity = grappleVelocity.y;
    }
    const positionBeforeMove = playerCollider.position.clone();
    if(playerAlive) playerCollider.moveWithCollisions(
      new Vector3(
        horizontalVelocity.x * deltaSeconds,
        verticalVelocity * deltaSeconds,
        horizontalVelocity.z * deltaSeconds,
      ),
    );

    if (slide.active) {
      const travelled = playerCollider.position.subtract(positionBeforeMove);
      const forwardDistance = travelled.x * slide.direction.x + travelled.z * slide.direction.z;
      // Stop the boost on a blocking wall instead of pushing against it.
      if (forwardDistance < slide.speed * deltaSeconds * 0.2) slide.cancel();
    }

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
    if (grounded) { verticalVelocity = -0.8; blastAirborne = false; }

    // Small, smoothed roll: left/right slides lean toward travel; forward
    // slides get a gentler lean. Looking around updates the relative direction.
    const sideAmount = slide.direction.x * Math.cos(camera.rotation.y)
      - slide.direction.z * Math.sin(camera.rotation.y);
    const forwardAmount = slide.direction.x * Math.sin(camera.rotation.y)
      + slide.direction.z * Math.cos(camera.rotation.y);
    const leanDirection = Math.abs(sideAmount) > 0.15
      ? -sideAmount : Math.sign(forwardAmount) * 0.3;
    const targetRoll = slide.active
      ? leanDirection * SLIDE.cameraTilt
      : 0;
    camera.rotation.z += (targetRoll - camera.rotation.z) * (1 - Math.exp(-14 * deltaSeconds));

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
    characterHands.root.setEnabled(!inLobby && matchActive && playerAlive && !characterScoped);
    if (onlinePlayer) { grenades.update(deltaSeconds); molotovs.update(deltaSeconds); rockets.update(deltaSeconds); onlineTracers.update(deltaSeconds); }
    grapple.draw();
    if (!onlinePlayer && !inLobby && matchActive && !gameOver && !teamIntermission && (document.pointerLockElement === canvas||botTeamSize>1&&!playerAlive)) {
      grenades.update(deltaSeconds); molotovs.update(deltaSeconds);
      arena.cover.update(deltaSeconds);
      rockets.update(deltaSeconds);
      if(botTeamSize>1)updateTeamBots(deltaSeconds,now);else bot.update(deltaSeconds, now);
      if(bot.alive&&bot.root.position.y<FALL_DEATH_Y)bot.takeHazardDamage(100);
      captureReplay();
    }

    spectator.update(frameSeconds);
    if(playerCollider.position.y<FALL_DEATH_Y){
      if(inLobby)resetPlayerPosition();
      else if(onlinePlayer)playerCollider.position.y=Math.max(-12,playerCollider.position.y);
      else if(matchActive&&playerAlive&&!gameOver)hurtPlayer('fall',100,'body',0);
    }
  });

  function enterLobby() {
    networkPaused=false;
    botEntry.reset();
    onlineTracers.clear();
    onlinePlayer = null;teamOnlineSlot=null;onlineRoster=[];teamRemotes.forEach(r=>r.hide());teamUnits.forEach(u=>u.bot.root.setEnabled(false)); remotePlayer.hide();
    weapon?.setVisualOnly(false);
    weapon?.setCombatEnabled(true);
    if (playerRespawnTimer) clearTimeout(playerRespawnTimer);
    playerRespawnTimer = null;
    inLobby = true;
    gameOver = false;
    matchActive = true; // Enables exploration, not combat.
    playerAlive = true;
    restorePlayerHealth();
    resetPlayerPosition();
    pressed.clear();
    weapon?.reset();
    weapon?.setActive(false);
    bot.reset(); // Cancels any pending round-respawn timer before hiding Rook.
    arena.cover.reset();arena.environment.reset();environmentSeconds=0;
    bot.root.setEnabled(false);
    camera.detachControl();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    onHudUpdate({ result: 'none', teamIntermission:false, dead: false, roundWon: false, paused: true, awaitingFirstInput: false, scoped: false, health: playerHealth, lobbyStation: null });
  }
  enterLobby();
  engine.runRenderLoop(() => scene.render());
  const onResize = () => engine.resize();
  window.addEventListener('resize', onResize);

  return {
    // Called directly by the bot Ready button; movement stays locked during countdown.
    prepareMatch: () => {
      if (!preMatchLocked || document.pointerLockElement===canvas) return;
      botEntry.prepare();
    },
    setPreMatchLocked: (locked: boolean) => {
      preMatchLocked=locked;
      if (!locked) return;
      matchActive=false; pressed.clear();
      horizontalVelocity.setAll(0); verticalVelocity=0; jumpQueued=false;
      weapon?.setActive(false); weapon?.setCombatEnabled(false);
      camera.detachControl();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    },
    enterLobby,
    spectatePlayer: (slot:number) => spectator.select(slot),
    cycleSpectator: (direction:number) => spectator.cycle(direction),
    setBotTeamSize:(size:TeamSize)=>{buildTeamUnits(size);},
    enterTeamOnline:(slot:number,size:number)=>{
      enterLobby();onlinePlayer=slot<size?1:2;teamOnlineSlot=slot;teamOnlineSize=size;teamRemoteVisible.clear();teamRemotes.forEach(r=>r.hide());inLobby=false;matchActive=true;playerAlive=true;gameOver=false;
      restorePlayerHealth();resetPlayerPosition();const p=teamSpawn(slot,size,arenaMap);playerCollider.position.set(p.x,p.y,p.z);camera.position.set(p.x,p.y+.82,p.z);camera.rotation.set(0,p.yaw,0);
      remotePlayer.hide();bot.root.setEnabled(false);teamUnits.forEach(u=>u.bot.root.setEnabled(false));weapon?.setVisualOnly(true);weapon?.setCombatEnabled(true);weapon?.setActive(true);onHudUpdate({paused:true});
    },
    receiveTeamRoster:(players:import('./teamProtocol').TeamPlayer[],roundOver=false)=>{
      if(teamOnlineSlot===null)return;
      onlineRoster=players;onlineRoundOver=roundOver;
      for(const p of players){if(p.slot===teamOnlineSlot)continue;let remote=teamRemotes.get(p.slot);if(!remote){remote=createRemotePlayer(scene);teamRemotes.set(p.slot,remote);}if(!p.pose||p.health<=0||!p.connected){remote.hide();teamRemoteVisible.delete(p.slot);continue;}
        if(teamRemoteVisible.has(p.slot))remote.receive(p.pose);else{remote.show(p.pose);teamRemoteVisible.add(p.slot);}remote.equip(p.weapon);remote.setCosmetics(p.profile.cosmetics);if(p.profile.character)remote.setCharacterAppearance(p.profile.character);
      }
      updateSpectatorRoster();
    },
    receiveTeamEffect:(slot:number,data:OnlineEffect)=>{if(teamOnlineSlot===null||slot===teamOnlineSlot)return;const remote=teamRemotes.get(slot);if(!remote)return;
      if(data.action!=='fire'){remote.reload(data.weapon,data.action==='reload');return;}remote.fire(data.weapon);
      if(data.origin&&data.direction){const o=new Vector3(data.origin.x,data.origin.y,data.origin.z),d=new Vector3(data.direction.x,data.direction.y,data.direction.z);if(data.weapon==='rocketLauncher')rockets.fire(o,d,[playerCollider,...[...teamRemotes.entries()].filter(([id])=>teamOf(id,teamOnlineSize)!==teamOf(slot,teamOnlineSize)).flatMap(([,r])=>r.projectileTargets)],false);else if(data.weapon==='grenade')grenades.throw(o,d,EMPTY_COSMETICS,false);else if(data.weapon==='molotov')molotovs.throw(o,d);else onlineTracers.fire(data.weapon,o,d);}
    },
    setOnlineEnvironment:(state:EnvironmentState,running:boolean)=>{
      environmentSeconds=state.seconds;environmentRunning=running;
      const standing=arena.environment.platforms.find(p=>playerAlive&&grounded&&Math.abs(playerCollider.position.y-PLAYER.colliderHalfHeight-(p.mesh.position.y+.175))<.22&&Math.abs(playerCollider.position.x-p.mesh.position.x)<1.8*mapScale(arenaMap)&&Math.abs(playerCollider.position.z-p.mesh.position.z)<1.8*mapScale(arenaMap));
      const previous=standing?.mesh.position.clone();
      arena.environment.apply(state,true);
      if(standing&&previous)playerCollider.moveWithCollisions(standing.mesh.position.subtract(previous));
    },
    setArenaMap:(id:ArenaMapId)=>{
      if(!isArenaMapId(id)||id===arenaMap)return;
      grenades.clear();rockets.clear();molotovs.clear();grapple.cancel();onlineTracers.clear();
      arena.dispose();arena=createArena(scene,id);arenaMap=id;
      bot.setPatrolRoute(ARENA_MAPS[id].patrol);
    },
    interactLobby,
    enterOnline: (player: number) => {
      networkPaused=false;
      weapon?.setCosmetics(getCosmetics());
      enterLobby();
      onlinePlayer = player === 2 ? 2 : 1;
      onlineOpponentAlive = true;
      inLobby = false; matchActive = true;
      resetPlayerPosition(); arena.cover.reset();arena.environment.reset();environmentSeconds=0;
      bot.root.setEnabled(false); weapon?.setVisualOnly(true); weapon?.setCombatEnabled(true); weapon?.setActive(true);
      const other = onlinePlayer === 1 ? SPAWNS.bot : SPAWNS.player;
      remotePlayer.show({ x: other.x, y: PLAYER.colliderHalfHeight, z: other.z,
        yaw: onlinePlayer === 1 ? SPAWNS.botYaw : SPAWNS.playerYaw, pitch: 0 });
      // Pointer lock needs a deliberate browser click, not a network message.
      onHudUpdate({ paused: true });
    },
    setOnlineNetworkPaused:(paused:boolean)=>{
      networkPaused=paused;
      if(!onlinePlayer)return;
      if(paused){
        matchActive=false;pressed.clear();horizontalVelocity.setAll(0);verticalVelocity=0;jumpQueued=false;
        grenades.clear();rockets.clear();molotovs.clear();onlineTracers.clear();
        weapon?.setActive(false);weapon?.setCombatEnabled(false);camera.detachControl();
        if(document.pointerLockElement===canvas)document.exitPointerLock();
        onHudUpdate({paused:true});
      }else if(!preMatchLocked && playerAlive){matchActive=true;weapon?.setActive(true);weapon?.setCombatEnabled(true);onHudUpdate({paused:true});}
    },
    restoreOnlineCombat:(snapshot:import('./onlineSnapshot').OnlineCombatSnapshot)=>{
      if(!onlinePlayer)return;
      if(snapshot.pose){playerCollider.position.set(snapshot.pose.x,snapshot.pose.y,snapshot.pose.z);camera.position.copyFrom(playerCollider.position);camera.position.y+=currentEyeHeight-PLAYER.colliderHalfHeight;camera.rotation.set(snapshot.pose.pitch,snapshot.pose.yaw,0);}
      weapon?.restoreOnlineInventory(snapshot.inventory,snapshot.weapon);
    },
    readOnlinePose: (): PlayerPose => ({
      x: playerCollider.position.x, y: playerCollider.position.y, z: playerCollider.position.z,
      yaw: camera.rotation.y, pitch: camera.rotation.x,
    }),
    setOnlineHealth: (health: number, opponentHealth: number) => {
      if (!onlinePlayer) return;
      const wasAlive=playerAlive;
      playerHealth = Math.max(0, Math.min(100, health));
      playerAlive = playerHealth > 0;
      onlineOpponentAlive = opponentHealth > 0;
      if (!playerAlive) { weapon?.setActive(false); weapon?.setCombatEnabled(false); pressed.clear(); }
      if(!playerAlive&&teamOnlineSlot!==null)beginSpectating();
      else if(playerAlive&&!wasAlive)spectator.stop();
      if (!onlineOpponentAlive) remotePlayer.hide();
      onHudUpdate({ health: playerHealth, dead: !playerAlive });
    },
    receiveOnlinePose: (pose: PlayerPose) => { if (onlinePlayer && onlineOpponentAlive) remotePlayer.receive(pose); },
    readOnlineWeapon: () => weapon?.id ?? 'assaultRifle',
    setCosmetics: (value: Cosmetics) => weapon?.setCosmetics(value),
    setCharacterAppearance: (value: CharacterAppearance) => {playerAppearance={...value};characterHands.apply(value);},
    receiveOnlineCharacter: (value: CharacterAppearance) => remotePlayer.setCharacterAppearance(value),
    receiveOnlineCosmetics: (value: Cosmetics) => { opponentCosmetics = { ...value }; remotePlayer.setCosmetics(value); },
    receiveOnlineWeapon: (id: WeaponId) => { if (onlinePlayer) remotePlayer.equip(id); },
    receiveOnlineShot: (id: WeaponId) => { if (onlinePlayer) remotePlayer.fire(id); },
    setOnlineEffectListener: (listener: ((data: OnlineEffect) => void) | null) => { onlineEffectListener = listener; },
    receiveOnlineEffect: (data: OnlineEffect) => {
      if (!onlinePlayer || !onlineOpponentAlive) return;
      if (data.action !== 'fire') { remotePlayer.reload(data.weapon,data.action === 'reload'); return; }
      if (data.origin && data.direction) onlineFire(data.weapon,new Vector3(data.origin.x,data.origin.y,data.origin.z),new Vector3(data.direction.x,data.direction.y,data.direction.z),true);
    },
    receiveOnlineGrenade: (data: GrenadeThrow) => {
      if (onlinePlayer) grenades.throw(new Vector3(data.origin.x, data.origin.y, data.origin.z), new Vector3(data.direction.x, data.direction.y, data.direction.z),opponentCosmetics,false);
    },
    setOnlineGrenadeListener: (listener: ((data: GrenadeThrow) => void) | null) => { onlineGrenadeListener = listener; },
    setOnlineShotListener: (listener: ((id: WeaponId) => void) | null) => { onlineShotListener = listener; },
    onlineLoadout: (): WeaponId[] => [getPrimaryWeapon(), getSecondaryWeapon(), getMeleeWeapon(), getUtilityWeapon()],
    selectWeapon: (weaponId: WeaponId) => {
      if (preMatchLocked || inLobby || gameOver || !playerAlive) return;
      weapon?.selectWeapon(weaponId);
    },
    requestPointerLock: () => {
      if (gameOver || networkPaused || preMatchLocked) return;
      matchActive = true;
      requestMouseLock();
    },
    playAgain: () => {
      onHudUpdate({deathRecap:null});
      preMatchLocked=false;
      weapon?.setCosmetics(getCosmetics());
      onlinePlayer = null;teamOnlineSlot=null;onlineRoster=[];teamRemotes.forEach(r=>r.hide());teamUnits.forEach(u=>u.bot.root.setEnabled(false)); remotePlayer.hide();
      weapon?.setVisualOnly(false);
      weapon?.setCombatEnabled(true);
      inLobby = false;
      bot.root.setEnabled(true);
      if (playerRespawnTimer) clearTimeout(playerRespawnTimer);
      playerRespawnTimer = null;
      restorePlayerHealth();
      playerAlive = true;
      playerScore = 0;
      botScore = 0;
      gameOver = false;
      matchActive = true;
      resetPlayerPosition();
      camera.attachControl(canvas, true);
      bot.reset();
      if(botTeamSize>1)resetTeamUnits();teamIntermission=false;
      arena.cover.reset();arena.environment.reset();environmentSeconds=0;
      weapon?.reset();
      weapon?.setActive(true);
      onHudUpdate({
        health: playerHealth,
        teamIntermission:false,
        dead: false,
        roundWon: false,
        playerScore,
        botScore,
        result: 'none',
        paused: false,
        awaitingFirstInput: document.pointerLockElement!==canvas,
      });
      updateTeamHud();
      botEntry.start();
    },
    dispose: () => {
      spectator.dispose();
      teamUnits.forEach(u=>u.bot.dispose());teamRemotes.forEach(r=>r.dispose());
      remotePlayer.dispose(); characterHands.dispose();
      onlineTracers.dispose();
      arena.environment.dispose();
      arena.cover.dispose();
      rockets.dispose();
      grenades.dispose(); molotovs.dispose();
      grapple.dispose();
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
