// Pure positive/negative checks for command verifiers. This deliberately exercises
// the same verifyCommand implementation used by the Electron runner.
const { verifyCommand, verifyZoomFraction, ActionFailure } = require('../../electron/engine/actions.cjs');

const point = (x, y) => [x, y];
const box = (min, max) => ({ min, max });
const inputPoints = (...points) => points.map((p) => ({ point: p }));
const value = (v) => ({ value: v });
const entity = (id, type, extra = {}) => ({ id, type, ...extra });

const cases = [
  { name: 'LINE', step: { inputs: inputPoints(point(0, 0), point(100, 50)) }, before: [], after: [entity('L1', 'Line', { start: point(0, 0), end: point(100, 50) })] },
  { name: 'RECTANG', step: { inputs: inputPoints(point(0, 0), point(100, 50)) }, before: [], after: [entity('R1', 'Polyline', { closed: true, vertices: [point(0, 0), point(100, 0), point(100, 50), point(0, 50)] })] },
  { name: 'PLINE', step: { inputs: inputPoints(point(0, 0), point(40, 20), point(80, 0)) }, before: [], after: [entity('P1', 'Polyline', { closed: false, vertices: [point(0, 0), point(40, 20), point(80, 0)] })] },
  { name: 'CIRCLE', step: { inputs: [ ...inputPoints(point(20, 30)), value(25) ] }, before: [], after: [entity('C1', 'Circle', { center: point(20, 30), radius: 25 })] },
  { name: 'MTEXT', step: { inputs: [value('Layer demo')], height: 18 }, before: [], after: [entity('T1', 'MText', { text: 'Layer demo', height: 18 })] },
  { name: 'MOVE', step: { inputs: inputPoints(point(10, 10), point(30, 50)) }, before: [entity('M1', 'Line', { bounds: box(point(0, 0), point(100, 20)) })], after: [entity('M1', 'Line', { bounds: box(point(20, 40), point(120, 60)) })], selected: ['M1'] },
  { name: 'COPY', step: { inputs: inputPoints(point(10, 10), point(30, 50)) }, before: [entity('O1', 'Line', { bounds: box(point(0, 0), point(100, 20)) })], after: [entity('O1', 'Line', { bounds: box(point(0, 0), point(100, 20)) }), entity('C2', 'Line', { bounds: box(point(20, 40), point(120, 60)) })], selected: ['O1'] },
  { name: 'ROTATE', step: { inputs: [ ...inputPoints(point(0, 0)), value(90) ] }, before: [entity('G1', 'Line', { start: point(0, 0), end: point(100, 0) })], after: [entity('G1', 'Line', { start: point(0, 0), end: point(0, 100) })], selected: ['G1'] },
  { name: 'ERASE', step: { inputs: [] }, before: [entity('E1', 'Line', { bounds: box(point(0, 0), point(10, 10)) }), entity('E2', 'Line', { bounds: box(point(20, 0), point(30, 10)) })], after: [entity('E2', 'Line', { bounds: box(point(20, 0), point(30, 10)) })], selected: ['E1'] },
  { name: 'OFFSET', step: { inputs: [value(5)] }, before: [entity('F1', 'Line', { start: point(0, 0), end: point(100, 0), bounds: box(point(0, 0), point(100, 0)) })], after: [entity('F1', 'Line', { start: point(0, 0), end: point(100, 0), bounds: box(point(0, 0), point(100, 0)) }), entity('F2', 'Line', { start: point(0, 5), end: point(100, 5), bounds: box(point(0, 5), point(100, 5)) })], selected: ['F1'] },
];

function selectedFrom(ids, before) {
  return (ids || []).map((id) => before.find((item) => item.id === id)).filter(Boolean);
}

function runOne(testCase, mutate) {
  const before = testCase.before.map((item) => ({ ...item }));
  let after = testCase.after.map((item) => ({ ...item }));
  if (mutate) after = mutate(after);
  return verifyCommand(testCase.name, testCase.step, before, after, selectedFrom(testCase.selected, before), 1.5);
}

const rows = [];
for (const testCase of cases) {
  try {
    runOne(testCase);
    rows.push({ name: testCase.name, kind: 'positive', result: 'PASS' });
  } catch (error) {
    rows.push({ name: testCase.name, kind: 'positive', result: 'FAIL', error: error.message });
  }
  try {
    runOne(testCase, (after) => {
      if (testCase.name === 'LINE') after[0].end = point(100, 70);
      else if (testCase.name === 'RECTANG') after[0].closed = false;
      else if (testCase.name === 'PLINE') after[0].vertices = [point(0, 0), point(40, 99), point(80, 0)];
      else if (testCase.name === 'CIRCLE') after[0].radius = 35;
      else if (testCase.name === 'MTEXT') after[0].text = 'Wrong text';
      else if (testCase.name === 'MOVE') after[0].bounds = box(point(25, 40), point(125, 60));
      else if (testCase.name === 'COPY') after[1].bounds = box(point(200, 400), point(300, 420));
      else if (testCase.name === 'ROTATE') after[0].end = point(0, 80);
      else if (testCase.name === 'ERASE') after.push(entity('E3', 'Line', { bounds: box(point(40, 0), point(50, 10)) }));
      else if (testCase.name === 'OFFSET') after[1].bounds = box(point(0, 12), point(100, 32));
      return after;
    });
    rows.push({ name: testCase.name, kind: 'negative', result: 'FAIL (accepted wrong state)' });
  } catch (error) {
    rows.push({ name: testCase.name, kind: 'negative', result: error instanceof ActionFailure ? 'EXPECTED FAIL' : 'UNEXPECTED ERROR', error: error.message });
  }
}

const positiveFailures = rows.filter((row) => row.kind === 'positive' && row.result !== 'PASS');
const negativeMisses = rows.filter((row) => row.kind === 'negative' && row.result !== 'EXPECTED FAIL');
const output = { total: rows.length, positives: cases.length, negatives: cases.length, positiveFailures, negativeMisses, rows };
try { verifyZoomFraction({ inside: true, fraction: 0.45 }); rows.push({ name: 'zoom_to', kind: 'positive', result: 'PASS' }); }
catch (error) { rows.push({ name: 'zoom_to', kind: 'positive', result: 'FAIL', error: error.message }); }
try { verifyZoomFraction({ inside: true, fraction: 0.39 }); rows.push({ name: 'zoom_to', kind: 'negative', result: 'FAIL (accepted wrong state)' }); }
catch (error) { rows.push({ name: 'zoom_to', kind: 'negative', result: 'EXPECTED FAIL', error: error.message }); }
output.total = rows.length;
output.positives += 1;
output.negatives += 1;
output.positiveFailures = rows.filter((row) => row.kind === 'positive' && row.result !== 'PASS');
output.negativeMisses = rows.filter((row) => row.kind === 'negative' && row.result !== 'EXPECTED FAIL');
console.log(JSON.stringify(output, null, 2));
if (output.positiveFailures.length || output.negativeMisses.length) process.exitCode = 1;
