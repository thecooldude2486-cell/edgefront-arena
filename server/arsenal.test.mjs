import assert from 'node:assert/strict';
import { createHitWorld, newCombatPlayer, checkCombatEffect, equipCombatWeapon, updateCombat, clearCombat } from './combat.mjs';
import { WEAPON_DEFINITIONS } from '../game/weaponDefinitions.ts';
import { Vector3 } from '@babylonjs/core';
const world=createHitWorld();
const make=(z=-16)=>Object.assign(newCombatPlayer(),{ready:true,pose:{x:0,y:.9,z,yaw:0,pitch:0}});
const shot=(weapon,y=1.05)=>({action:'fire',weapon,origin:{x:0,y,z:-16},direction:{x:0,y:0,z:1}});
try {
  for(const weapon of ['assaultRifle','pistol','uzi','sniper','laserCannon','sword','orbiter']) {
    for(const [height,zone] of [[1.05,'body'],[1.52,'head']]) {
      const a=make(),b=make(WEAPON_DEFINITIONS[weapon].fireMode==='Melee'?-14:-12),hits=[];
      equipCombatWeapon(a,weapon,1000);
      assert.equal(checkCombatEffect(a,b,shot(weapon,height),1,1000,world,(...hit)=>hits.push(hit)),true);
      const damage=WEAPON_DEFINITIONS[weapon][zone==='head' && WEAPON_DEFINITIONS[weapon].fireMode!=='Melee'?'headDamage':'bodyDamage'];
      assert.equal(b.health,100-damage,weapon+' '+zone+' damage');
      assert.equal(hits[0][0],zone==='head' && WEAPON_DEFINITIONS[weapon].fireMode!=='Melee'?'head':'body');
      assert.equal(checkCombatEffect(a,b,shot(weapon,height),1,3000,world),false,'Replayed '+weapon);
    }
    const a=make(),b=make(16);equipCombatWeapon(a,weapon,1000);
    assert.equal(checkCombatEffect(a,b,shot(weapon),1,1000,world),true);
    assert.equal(b.health,100,'Arena cover / melee range blocks '+weapon);
    assert.equal(checkCombatEffect(a,b,shot(weapon),2,1001,world),false,'Server fire rate '+weapon);
    assert.equal(checkCombatEffect(a,b,{...shot(weapon),origin:{x:15,y:1.05,z:-16}},3,3000,world),false,'Forged origin '+weapon);
    assert.equal(checkCombatEffect(a,b,{...shot(weapon),direction:{x:0,y:0,z:-1}},4,4000,world),false,'Wrong facing '+weapon);
  }
  for(const weapon of ['pistol','uzi','sniper','rocketLauncher']) {
    const a=make(),b=make(16);equipCombatWeapon(a,weapon,1000);const stats=WEAPON_DEFINITIONS[weapon];
    for(let i=0;i<stats.magazineSize;i++) assert.equal(checkCombatEffect(a,b,shot(weapon),i,1000+i*stats.fireDelayMs,world),true);
    const time=1000+stats.magazineSize*stats.fireDelayMs;
    assert.equal(a.ammo,0);assert.equal(checkCombatEffect(a,b,shot(weapon),100,time,world),false);
    equipCombatWeapon(a,'assaultRifle',time);equipCombatWeapon(a,weapon,time);
    assert.equal(a.ammo,0,'Switching cannot refill '+weapon);
    assert.equal(checkCombatEffect(a,b,{action:'reload',weapon},101,time,world),true);
    assert.equal(checkCombatEffect(a,b,shot(weapon),102,time+stats.reloadMs-1,world),false);
    assert.equal(checkCombatEffect(a,b,shot(weapon),103,time+stats.reloadMs,world),true);
    assert.equal(a.ammo,stats.magazineSize-1);assert.equal(a.reserve,stats.reserveAmmo-stats.magazineSize);
  }
  const laser=make(),far=make(16);equipCombatWeapon(laser,'laserCannon',1000);
  for(let i=0;i<33;i++) assert.equal(checkCombatEffect(laser,far,shot('laserCannon'),i,1000+i*100,world),true);
  assert.equal(laser.ammo,1);assert.equal(checkCombatEffect(laser,far,shot('laserCannon'),40,4400,world),false);
  assert.equal(checkCombatEffect(laser,far,{action:'reload',weapon:'laserCannon'},41,4500,world),false);
  updateCombat(laser,far,0,6700,world);assert.equal(laser.ammo,13,'Energy recharges after delay');
  assert.equal(checkCombatEffect(laser,far,shot('laserCannon'),42,6700,world),true);

  for(const finished of [false,true]) {
    const a=make(),b=make(16);equipCombatWeapon(a,'pistol',1000);a.ammo=0;
    assert.equal(checkCombatEffect(a,b,{action:'reload',weapon:'pistol'},1,1000,world),true);
    equipCombatWeapon(a,'sword',finished?2500:2000);equipCombatWeapon(a,'pistol',3000);
    assert.equal(a.ammo,finished?8:0,'Switch finalizes completed reloads and cancels unfinished reloads');
    assert.equal(a.reloadAt,0);
  }

  const rocket=make(),direct=make(-12);equipCombatWeapon(rocket,'rocketLauncher',1000);
  assert.equal(checkCombatEffect(rocket,direct,shot('rocketLauncher'),1,1000,world),true);
  assert.equal(direct.health,100,'Rocket damage waits for travel');
  updateCombat(rocket,direct,.1,1100,world);assert.equal(direct.health,33,'67 direct rocket damage');
  assert.equal(rocket.projectiles.length,0);
  const splash=make(),near=make(-12);equipCombatWeapon(splash,'rocketLauncher',1000);
  splash.pose.pitch=Math.atan(.6);
  assert.equal(checkCombatEffect(splash,near,{...shot('rocketLauncher'),direction:new Vector3(0,-.6,1).normalize()},1,1000,world),true);
  updateCombat(splash,near,.2,1200,world);assert.equal(near.health,66,'34 rocket splash from a nearby floor impact');

  for(const weapon of ['grenade','molotov']) {
    const a=make(),b=make(-7.1),position=new Vector3(0,.14,-8.2);
    const attack={weapon,sequence:1,origin:new Vector3(0,1.05,-16),position,velocity:Vector3.Zero(),age:1.99};
    if(weapon==='grenade')a.projectiles.push(attack);
    else a.fires.push({...attack,position:new Vector3(0,.04,-8.2),age:0,ticks:0});
    updateCombat(a,b,weapon==='grenade'?.01:5,6000,world);
    assert.equal(b.health,100,'Real arena barrier blocks '+weapon+' damage inside its radius');
  }
  for(const weapon of ['grenade','molotov']) {
    const a=make(),b=make(-9);equipCombatWeapon(a,weapon,1000);
    assert.equal(checkCombatEffect(a,b,shot(weapon),1,1000,world),true);
    assert.equal(b.health,100,'Throw does not hit instantly');
    assert.equal(checkCombatEffect(a,b,shot(weapon),2,2000,world),false,'One utility per life');
    equipCombatWeapon(a,'assaultRifle',2000);equipCombatWeapon(a,weapon,2000);assert.equal(a.ammo,0,'Switch cannot refill utility');
    if(weapon==='grenade') {
      updateCombat(a,b,1.99,2990,world);assert.equal(b.health,100,'Two-second fuse');
      updateCombat(a,b,.01,3000,world);assert.equal(b.health,66,'34 grenade splash');
      updateCombat(a,b,5,8000,world);assert.equal(b.health,66,'One blast');
    } else {
      updateCombat(a,b,1,2000,world);assert.ok(a.fires.length,'Bottle lands and ignites');
      updateCombat(a,b,5,7000,world);assert.equal(b.health,50,'Ten burn ticks, 50 total damage');
      updateCombat(a,b,2,9000,world);assert.equal(b.health,50,'Fire expires');
    }
    assert.equal(a.health,100,'Utility never damages owner');
    clearCombat(a);assert.equal(a.projectiles.length+a.fires.length,0);
  }
  console.log('PASS: all ten weapons, body/head damage, melee range, arena cover, replay/rate/origin/facing validation, per-weapon ammo and reload, energy, rocket travel/direct, grenade fuse, Molotov burn, owner immunity and cleanup.');
} finally {world.dispose();}
