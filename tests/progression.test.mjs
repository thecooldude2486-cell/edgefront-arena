import assert from 'node:assert/strict';
import { createProgression, createMatchXpTracker, levelFromXp, xpForLevel, rewardAt, readPlayerProfile, PROGRESSION_KEY } from '../game/progression.ts';
const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key,value) => data.set(key,value) };
for (const level of [1,2,5,15,100,1000,1000000]) {
  assert.equal(levelFromXp(xpForLevel(level)), level);
  if (level > 1) assert.equal(levelFromXp(xpForLevel(level)-1), level-1);
  assert.equal(levelFromXp(xpForLevel(level+1)-1), level);
}
for (const level of [2,3,4,5,10,15,1000000,1000005,1000010]) assert.ok(rewardAt(level));
assert.notDeepEqual(rewardAt(5), rewardAt(95));
const progress = createProgression(storage);
assert.equal(progress.equip('skin',5), false);
const paid = progress.award(xpForLevel(16));
assert.equal(paid.orbs,225); assert.equal(progress.state.level,16);
assert.equal(progress.equip('skin',5),true); assert.equal(progress.equip('wrap',10),true); assert.equal(progress.equip('charm',15),true);
assert.equal(progress.equip('skin',10),false); assert.equal(progress.equip('charm',30),false);
assert.deepEqual(createProgression(storage).state.cosmetics,{skin:5,wrap:10,charm:15});
assert.equal(createProgression(storage).state.xp,xpForLevel(16));
assert.equal(progress.equip('skin',null),true);
assert.equal(progress.award(-1).orbs,0);
assert.equal(progress.award(NaN).orbs,0);
data.set(PROGRESSION_KEY,'{bad'); assert.equal(createProgression(storage).state.level,1);
data.set(PROGRESSION_KEY,JSON.stringify({version:2,xp:xpForLevel(5),cosmetics:{skin:20,wrap:5,charm:-1}}));
assert.deepEqual(createProgression(storage).state.cosmetics,{skin:null,wrap:null,charm:null});
const failed=createProgression({getItem:()=>null,setItem:()=>{throw Error('Blocked');}});failed.award(1000);assert.equal(failed.state.saved,false);assert.ok(failed.state.level>1);
assert.equal(readPlayerProfile({level:Infinity}),null);assert.equal(readPlayerProfile({level:0}),null);
assert.deepEqual(readPlayerProfile({level:10,cosmetics:{skin:5,wrap:25,charm:15},player:2,health:999}),{level:10,cosmetics:{skin:5,wrap:null,charm:null}});
for (const mode of ['easy','normal','hard','extreme','nightmare','online']) {
  const match=createMatchXpTracker();assert.equal(match.update([1,0],'none',mode),0);match.begin();
  const first=match.update([1,0],'none',mode); assert.ok(first>0);
  assert.equal(match.update([1,0],'none',mode),0);assert.equal(match.update([0,0],'none',mode),0);
  assert.ok(match.update([1,1],'none',mode)>0);
  assert.ok(match.update([5,1],'none',mode)>0);assert.ok(match.update([5,1],'victory',mode)>0);
  assert.equal(match.update([5,1],'victory',mode),0);
  match.begin();assert.ok(match.update([0,5],'defeat',mode)>0);assert.equal(match.update([0,5],'defeat',mode),0);
  match.begin();match.stop();assert.equal(match.update([1,0],'none',mode),0);
}
console.log('PASS: unlimited thresholds/rewards, persistence, locked/equipped cosmetics, safe profiles, difficulty XP, duplicates, losses and replay.');

for(let level=2;level<=360;level++) assert.ok(rewardAt(level), 'Reward on every level');
assert.equal(new Set(Array.from({length:120},(_,i)=>rewardAt(i+2).name)).size,120);
assert.equal(new Set(Array.from({length:24},(_,i)=>rewardAt((i+1)*15).color)).size,24);
assert.equal(new Set(Array.from({length:8},(_,i)=>rewardAt((i+1)*15).pattern)).size,8);
assert.equal(progress.state.nextReward.level,progress.state.level+1);

assert.equal(xpForLevel(2),1000,'First level requires four times as much XP');
assert.equal(xpForLevel(11)-xpForLevel(10),2800,'Later levels also take four times as much XP');
for (const version of [undefined,1]) {
  const oldXp=25*9*9+225*9+524;
  data.set(PROGRESSION_KEY,JSON.stringify({version,xp:oldXp,cosmetics:{skin:2,wrap:3,charm:7}}));
  const migrated=createProgression(storage);
  assert.equal(migrated.state.level,10,'Existing level retained');
  assert.equal(migrated.state.earned,524*4,'Progress percentage retained');
  assert.deepEqual(migrated.state.cosmetics,{skin:2,wrap:3,charm:7},'Equipped unlocks retained');
  assert.equal(JSON.parse(data.get(PROGRESSION_KEY)).version,2);
  assert.equal(createProgression(storage).state.xp,migrated.state.xp,'Migration happens only once');
  const untilNext=migrated.state.required-migrated.state.earned;
  assert.equal(migrated.award(untilNext-1).orbs,0,'Migration grants no extra level rewards');
  assert.deepEqual(migrated.award(1),{before:10,after:11,orbs:15});
}
const blockedMigration=createProgression({getItem:()=>JSON.stringify({xp:250,cosmetics:{skin:2}}),setItem:()=>{throw Error('Blocked');}});
assert.equal(blockedMigration.state.level,2);assert.equal(blockedMigration.state.cosmetics.skin,2);assert.equal(blockedMigration.state.saved,false);
console.log('PASS: harder uncapped leveling, saved level/fraction/unlock migration, one-time conversion and no duplicate Orbs.');
