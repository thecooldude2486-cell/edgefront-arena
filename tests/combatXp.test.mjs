import assert from 'node:assert/strict';
import {createCombatPerformance,eliminationXp} from '../game/combatXp.ts';
import {createMatchXpTracker} from '../game/progression.ts';
const ordinary={damageDealt:100,healthRemaining:55,headshot:false,distance:10,airborne:false,shots:10,hits:7,seconds:12};
const normal=eliminationXp(ordinary);
assert.equal(normal.amount,91);assert.deepEqual(normal.bonuses,[]);
assert.ok(eliminationXp({...ordinary,damageDealt:35}).amount<normal.amount);
assert.ok(eliminationXp({...ordinary,healthRemaining:80}).amount>normal.amount);
for(const change of [{headshot:true},{distance:24},{airborne:true},{healthRemaining:15},{healthRemaining:100},{shots:10,hits:9},{seconds:5}]) {
  const award=eliminationXp({...ordinary,...change});assert.ok(award.amount>normal.amount);assert.ok(award.bonuses.length>0);
}
assert.equal(eliminationXp({...ordinary,headshot:false,distance:23.9}).amount,normal.amount);
assert.equal(eliminationXp({...ordinary,damageDealt:10000}).amount,normal.amount,'Overkill capped');
const performance=createCombatPerformance(1000);
performance.shot();performance.damage(100,88,true,30,true);
performance.shot();performance.damage(88,0,false,8,false);
const record=performance.read(24,11000);
assert.equal(record.damageDealt,100);assert.equal(record.headshot,false,'Only the killing blow qualifies');assert.equal(record.distance,8);assert.equal(record.airborne,false);assert.equal(record.seconds,10);
const tracker=createMatchXpTracker();tracker.begin();
assert.equal(tracker.update([1,0],'none','online',record),eliminationXp(record).amount*2);
assert.equal(tracker.update([1,0],'none','online',record),0,'Repeated HUD/network events cannot pay twice');
tracker.update([1,1],'none','online',{...ordinary,damageDealt:40});assert.equal(tracker.bonuses.length,0);
performance.reset(12000);assert.equal(performance.read(100,13000).damageDealt,0);assert.equal(performance.read(100,13000).shots,0);
for(const invalid of [NaN,Infinity,-100]) assert.ok(Number.isSafeInteger(eliminationXp({...ordinary,damageDealt:invalid,healthRemaining:invalid,distance:invalid,seconds:invalid}).amount));
console.log('PASS: damage/health-based XP, seven special bonuses, killing-blow metadata, capped overkill, multipliers, duplicates and round reset.');
