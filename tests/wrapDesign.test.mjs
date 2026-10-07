import assert from 'node:assert/strict';
import { createWrapPixels } from '../game/wrapDesign.ts';
const recipes=[];
for(let pattern=0;pattern<8;pattern++) {
  const recipe={color:'#75e5cc',accent:'#173842',pattern,edition:1};
  const data=createWrapPixels(recipe,64);
  assert.equal(data.length,64*64*4);
  const colors=new Set();
  for(let i=0;i<data.length;i+=4){assert.equal(data[i+3],255);colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);}
  assert.ok(colors.size>100, 'Layered gradients and motifs, rather than flat one/two-colour bands');
  assert.deepEqual(data,createWrapPixels({...recipe},64),'Stable design across client/player views');
  assert.notDeepEqual(data,createWrapPixels({...recipe,color:'#e8878c',accent:'#3e2834'},64),'Palette changes appear in artwork');
  recipes.push(data);
}
for(let a=0;a<8;a++)for(let b=a+1;b<8;b++)assert.notDeepEqual(recipes[a],recipes[b],'Distinct pattern families');
console.log('PASS: eight distinct multicolour designs, deterministic shared artwork, opaque texture data and theme variants.');
