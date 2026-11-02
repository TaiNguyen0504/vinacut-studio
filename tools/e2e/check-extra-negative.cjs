const assert = require('node:assert/strict');
const fs = require('node:fs');
const { verifyCommand, pixelTowardTarget, ActionFailure, assertCleanStateSnapshot } = require('../../electron/engine/actions.cjs');
const rows = [];
const mtext = { id: 'T', type: 'MText', height: 180, text: '{\\fArial Unicode MS|b0|i0|c0;\\pxi0,l0,r0,b0,a0,ql;{\\C256;\\fArial Unicode MS|b0|i0;Xin chào VinaCAD}}' };
const textStep = { height: 180, inputs: [{ value: 'Xin chào VinaCAD' }] };
assert.equal(verifyCommand('MTEXT', textStep, [], [mtext], [], 1).verified, true);
assert.throws(() => verifyCommand('MTEXT', textStep, [], [{ ...mtext, text: mtext.text.replace('VinaCAD', 'VinaCAD sai') }], [], 1), ActionFailure);
function reject(name, fn) {
  assert.throws(fn, ActionFailure); rows.push({ name, result: 'EXPECTED FAIL' });
}
const a = { id: 'A', type: 'Line', bounds: { min: [0, 0], max: [100, 0] } };
const b = { id: 'B', type: 'Line', bounds: { min: [20, 20], max: [120, 20] } };
const copyStep = { inputs: [{ point: [0, 0] }, { point: [20, 20] }] };
reject('MOVE changes size', () => verifyCommand('MOVE', copyStep, [a], [{ ...a, bounds: { min: [20, 20], max: [140, 20] } }], [a], 30));
const another = { ...a, id: 'Another' };
reject('MOVE different vectors in one selection', () => verifyCommand('MOVE', copyStep, [a, another], [{ ...a, bounds: b.bounds }, { ...another, bounds: { min: [25, 20], max: [125, 20] } }], [a, another], 30));
reject('COPY changes original', () => verifyCommand('COPY', copyStep, [a], [{ ...a, bounds: b.bounds }, b], [a], 1));
reject('Duplicate IDs', () => verifyCommand('COPY', copyStep, [a, a], [a, b], [a], 1));
const other = { ...a, id: 'O', bounds: { min: [0, 100], max: [100, 100] } };
reject('COPY duplicates only one selected part', () => verifyCommand('COPY', copyStep, [a, other], [a, other, b, { ...b, id: 'C' }], [a, other], 1));
const offsetSource = { ...a, start: [0, 0], end: [100, 0] };
const wrongOffset = { id: 'F', type: 'Line', start: [50, -30], end: [50, 70], bounds: { min: [50, -30], max: [50, 70] } };
reject('OFFSET right center distance but not parallel', () => verifyCommand('OFFSET', { inputs: [{ value: '20' }] }, [offsetSource], [offsetSource, wrongOffset], [offsetSource], 1));
reject('ROTATE 30 instead of 45 degrees', () => verifyCommand('ROTATE', { inputs: [{ point: [0, 0] }, { value: '45' }] }, [{ id: 'R', type: 'Line', start: [0, 0], end: [100, 0] }], [{ id: 'R', type: 'Line', start: [0, 0], end: [86.6025, 50] }], [{ id: 'R', type: 'Line', start: [0, 0], end: [100, 0] }], 1));
const bg = { r: 33, g: 41, b: 48 }, target = { r: 255, g: 179, b: 71 };
assert.equal(pixelTowardTarget({ r: 77, g: 83, b: 89 }, { r: 77, g: 68, b: 53 }, target, bg), true);
for (const [name, after] of [['unchanged', { r: 77, g: 83, b: 89 }], ['wrong blue', { r: 44, g: 66, b: 144 }], ['background only', bg]]) {
  assert.equal(pixelTowardTarget({ r: 77, g: 83, b: 89 }, after, target, bg), false);
  rows.push({ name: `layer-color ${name}`, result: 'EXPECTED FAIL' });
}
const clean = { command: { active: false, prompt: '' }, selectionCount: 2, menus: [], picker: false, editor: false };
assertCleanStateSnapshot(clean, { allowSelection: true });
reject('Selection not allowed', () => assertCleanStateSnapshot(clean));
fs.writeFileSync('docs/handoff/evidence/extra-negative.json', JSON.stringify({ rows, passed: true }, null, 2));
console.log(JSON.stringify({ rows, passed: true }));
