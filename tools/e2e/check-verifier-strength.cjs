const assert = require('node:assert/strict');
const { verifyCommand, ActionFailure } = require('../../electron/engine/actions.cjs');
const line = (id, a, b) => ({ id, type: 'Line', start: a, end: b, bounds: { min: [Math.min(a[0], b[0]), Math.min(a[1], b[1])], max: [Math.max(a[0], b[0]), Math.max(a[1], b[1])] } });
const a = line('A', [0, 0], [100, 0]);
const b = line('B', [0, 100], [100, 100]);
const step = { inputs: [{ point: [0, 0] }, { point: [20, 20] }] };
assert.equal(verifyCommand('COPY', step, [a, b], [a, b, line('C', [25, 20], [125, 20]), line('D', [25, 120], [125, 120])], [a, b], 30).verified, true);
assert.equal(verifyCommand('LINE', { inputs: [{ point: [0, 0] }, { point: [100, 0] }, { point: [100, 100] }] }, [], [a, line('B', [100, 0], [100, 100])], [], 1).verified, true);
assert.equal(verifyCommand('ROTATE', { inputs: [{ point: [0, 0] }, { value: '90' }] }, [a, b], [line('A', [0, 0], [0, 100]), line('B', [-100, 0], [-100, 100])], [a, b], 1).verified, true);
const cases = [
  ['COPY resized copy within pickbox', () => verifyCommand('COPY', step, [a], [a, line('C', [20, 20], [140, 20])], [a], 30)],
  ['COPY different vectors within pickbox', () => verifyCommand('COPY', step, [a, b], [a, b, line('C', [20, 20], [120, 20]), line('D', [25, 120], [125, 120])], [a, b], 30)],
  ['CIRCLE wrong numeric radius within pickbox', () => verifyCommand('CIRCLE', { inputs: [{ point: [0, 0] }, { value: '250' }] }, [], [{ id: 'C', type: 'Circle', center: [0, 0], radius: 290 }], [], 80)],
  ['CIRCLE missing center', () => verifyCommand('CIRCLE', { inputs: [{ point: [0, 0] }, { value: '250' }] }, [], [{ id: 'C', type: 'Circle', radius: 250 }], [], 80)],
  ['MTEXT wrong numeric height within pickbox', () => verifyCommand('MTEXT', { height: 180, inputs: [{ value: 'Nhãn' }] }, [], [{ id: 'T', type: 'MText', text: 'Nhãn', height: 250 }], [], 100)],
  ['LINE second segment wrong', () => verifyCommand('LINE', { inputs: [{ point: [0, 0] }, { point: [100, 0] }, { point: [100, 100] }] }, [], [a, line('B', [100, 0], [200, 100])], [], 1)],
  ['OFFSET removes source', () => verifyCommand('OFFSET', { inputs: [{ value: '20' }] }, [a], [line('C', [0, 20], [100, 20])], [a], 1)],
  ['ROTATE ignores second selected entity', () => verifyCommand('ROTATE', { inputs: [{ point: [0, 0] }, { value: '90' }] }, [a, b], [line('A', [0, 0], [0, 100]), b], [a, b], 1)],
];
const rows = cases.map(([name, run]) => {
  try { assert.throws(run, ActionFailure); return { name, rejected: true }; }
  catch { return { name, rejected: false }; }
});
console.log(JSON.stringify({ passed: rows.every((row) => row.rejected), rows }));
process.exitCode = rows.every((row) => row.rejected) ? 0 : 1;
