const assert = require('node:assert/strict');
const fs = require('node:fs');
const { settleSnapPoint, ActionFailure } = require('../../electron/engine/actions.cjs');
const state = (x, osnap = true) => ({ point: [x, 100], client: { x, y: 100 }, osnap, tolerance: 2 });
function context(states) {
  const moves = [];
  return {
    moves,
    win: { webContents: { executeJavaScript: async code => code.includes('cursorPoint()') ? states.shift() : { x: 0, y: 0, w: 500, h: 500 } } },
    input: { moveTo: async (x, y) => moves.push([x, y]), frame: async () => {} },
  };
}
(async () => {
  const already = context([state(100)]);
  assert.equal(await settleSnapPoint(already, [100, 100], { x: 100, y: 100 }), null);
  assert.equal(already.moves.length, 0);
  const correctable = context([state(80), state(100)]);
  const correction = await settleSnapPoint(correctable, [100, 100], { x: 100, y: 100 });
  assert.deepEqual(correction.before, [80, 100]);
  assert.deepEqual(correction.after, [100, 100]);
  assert.equal(correctable.moves.length, 2);
  const stuck = context([state(80), state(80)]);
  let clicks = 0;
  await assert.rejects(async () => {
    await settleSnapPoint(stuck, [100, 100], { x: 100, y: 100 });
    clicks++;
  }, error => error instanceof ActionFailure && /dừng trước click/.test(error.message));
  assert.equal(clicks, 0);
  assert.equal(stuck.moves.length, 2);
  const disabled = context([state(80, false)]);
  assert.equal(await settleSnapPoint(disabled, [100, 100], { x: 100, y: 100 }), null);
  assert.equal(disabled.moves.length, 0);
  fs.writeFileSync('docs/handoff/evidence/snap-settle-unit.json', JSON.stringify({ passed: true, alreadyCorrect: true, correctedOnce: true, stuckStopsBeforeClick: true, disabledUntouched: true }, null, 2));
  console.log('PASS: bounded pointer correction and failure before click');
})().catch(error => { console.error(error); process.exitCode = 1; });
