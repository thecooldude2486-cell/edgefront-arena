import assert from 'node:assert/strict';
import { describePreviewFailure } from '../game/previewErrors.ts';
for(const message of ['Failed to fetch dynamically imported module: http://localhost:3000/game/createShopPreview.ts','Importing a module script failed.','Loading chunk 21 failed.','NetworkError when attempting to fetch resource.']) {
  const failure=describePreviewFailure(new TypeError(message));
  assert.equal(failure.kind,'download');assert.match(failure.message,/server/);assert.equal(failure.detail,message);
  assert.doesNotMatch(failure.message,/device|computer|hardware/);
}
assert.equal(describePreviewFailure(new Error('WebGL not supported')).kind,'renderer');
assert.equal(describePreviewFailure(new Error('No WebGL context available')).kind,'renderer');
const unexpected=describePreviewFailure(new Error('Invalid model data'));
assert.equal(unexpected.kind,'unknown');assert.equal(unexpected.detail,'Invalid model data');assert.doesNotMatch(unexpected.message,/device|computer|hardware/);
assert.equal(describePreviewFailure('Load failed').kind,'download');
console.log('PASS: module outages distinguish download errors from graphics errors; unknown bugs retain diagnostics without blaming hardware.');
