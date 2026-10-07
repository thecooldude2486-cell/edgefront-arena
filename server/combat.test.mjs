import assert from 'node:assert/strict';
import { createHitWorld, newCombatPlayer, checkCombatEffect } from './combat.mjs';
const world = createHitWorld();
const make = () => ({ ...newCombatPlayer(), ready:true, pose:{x:0,y:.9,z:-16,yaw:0,pitch:0} });
const target = () => ({ ...make(), pose:{x:0,y:.9,z:-12,yaw:Math.PI,pitch:0} });
const shot = (y=1.52) => ({action:'fire',weapon:'assaultRifle',origin:{x:0,y,z:-16},direction:{x:0,y:0,z:1}});
try {
  assert.equal(world.hit(shot().origin,shot().direction,target().pose),'head');
  assert.equal(world.hit(shot(1.05).origin,shot().direction,target().pose),'body');
  assert.equal(world.hit(shot().origin,{x:1,y:0,z:0},target().pose),null);
  assert.equal(world.hit({x:0,y:1.52,z:-17},shot().direction,{x:0,y:.9,z:17,yaw:0,pitch:0}),null,'arena cover blocks spawn-to-spawn shots');
  for (const [height,damage,hits] of [[1.05,12,9],[1.52,15,7]]) {
    const a=make(),b=target();
    for(let i=0;i<hits;i++) {
      assert.equal(checkCombatEffect(a,b,shot(height),i,1000+i*125,world),true);
      assert.equal(b.health,Math.max(0,100-(i+1)*damage));
    }
    assert.equal(b.health,0);
    const performance=a.performance.read(a.health,2000);
    assert.equal(performance.damageDealt,100,'Only actual health removed contributes to XP');assert.equal(performance.headshot,height===1.52);assert.equal(performance.distance,4);assert.equal(performance.shots,hits);
    assert.equal(checkCombatEffect(b,a,shot(),99,9000,world),false,'eliminated cannot fire');
  }
  const a=make(),b=target();
  assert.equal(checkCombatEffect(a,b,shot(),1,1000,world),true);
  assert.equal(checkCombatEffect(a,b,shot(),1,2000,world),false,'duplicate rejected');
  assert.equal(checkCombatEffect(a,b,shot(),2,1100,world),false,'rate limit');
  assert.equal(b.health,85);
  a.weapon='pistol';assert.equal(checkCombatEffect(a,b,shot(),3,3000,world),false,'wrong equipped weapon');
  a.weapon='assaultRifle';a.ammo=0;
  assert.equal(checkCombatEffect(a,b,shot(),4,4000,world),false,'empty magazine');
  assert.equal(checkCombatEffect(a,b,{action:'reload',weapon:'assaultRifle'},5,4000,world),true);
  assert.equal(checkCombatEffect(a,b,shot(),6,5000,world),false,'cannot shoot during reload');
  assert.equal(checkCombatEffect(a,b,shot(1.05),7,5650,world),true);
  assert.equal(a.ammo,19);assert.equal(a.reserve,80);assert.equal(b.health,73,'mixed head/body');
  a.ammo=7;a.reserve=8;
  checkCombatEffect(a,b,{action:'reload',weapon:'assaultRifle'},8,6000,world);
  checkCombatEffect(a,b,{action:'reloadEnd',weapon:'assaultRifle'},9,7650,world);
  assert.equal(a.ammo,15);assert.equal(a.reserve,0);
  assert.equal(checkCombatEffect(a,b,{...shot(),origin:{x:10,y:1.52,z:-16}},10,8000,world),false,'forged origin');
  assert.equal(checkCombatEffect(a,b,{...shot(),direction:{x:0,y:0,z:-1}},11,9000,world),false,'wrong facing');
  const empty=make(), untouched=target();
  const miss={...shot(),direction:{x:0,y:0,z:-1}};
  empty.pose.yaw=Math.PI;
  for(let i=0;i<20;i++) assert.equal(checkCombatEffect(empty,untouched,miss,i,10000+i*125,world),true);
  assert.equal(empty.ammo,0);assert.equal(untouched.health,100);
  assert.equal(checkCombatEffect(empty,untouched,miss,20,14000,world),false);
  empty.weapon='pistol';empty.pose.yaw=0;
  assert.equal(checkCombatEffect(empty,untouched,{...shot(),weapon:'pistol'},21,15000,world),true);
  assert.equal(untouched.health,86,'Pistol head damage is live');
  console.log('PASS: real arena occlusion, head/body/miss, elimination, replay, rate, ammo, reload, identity-bound weapon and origin/facing checks.');
} finally { world.dispose(); }
