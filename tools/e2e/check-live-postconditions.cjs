const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { app } = require('electron');
const { FrameRecorder, InputDriver, createRecorderWindow, ensureViewport } = require('../../electron/engine/capture.cjs');
const { runStep, verifyCommand, ActionFailure, prepareStage } = require('../../electron/engine/actions.cjs');
const vinacad = require('../../electron/engine/vinacad.cjs');

const root = path.resolve(`docs/handoff/evidence/live-negative-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(root, { recursive: true });
app.setPath('userData', path.join(root, 'user-data'));
const timer = setTimeout(() => app.exit(1), 300000);

app.whenReady().then(async () => {
  const win = createRecorderWindow({ deviceScaleFactor: 2 });
  await win.loadURL(vinacad.VINACAD_URL);
  await ensureViewport(win);
  await vinacad.waitForEditorReady(win, 70000);
  await vinacad.loadDrawing(win, vinacad.SAMPLE_ID);
  await prepareStage(win, null);
  try {
    const rec = new FrameRecorder(win, root);
    await rec.start();
    const input = new InputDriver(win, rec);
    await input.ensureOverlay();
    const ctx = { win, rec, input, context: vinacad.SAMPLE_CONTEXT, scene: { targets: [] }, selectedSnapshot: [] };
    const rows = [];

    // 1. Existing LINE and CIRCLE positive + wrong-geometry negative checks
    for (const step of [
      { type: 'command', name: 'LINE', inputs: [{ point: [4000, 3000] }, { point: [6000, 3000] }, { key: 'Enter' }] },
      { type: 'command', name: 'CIRCLE', inputs: [{ point: [9300, 2350] }, { value: '350' }] },
    ]) {
      const before = await win.webContents.executeJavaScript('window.__vcq.entitySnapshot()');
      const result = await runStep(step, ctx);
      assert.equal(result.verification?.visibility?.visible, true, `${step.name} must report visible postcondition`);
      const after = await win.webContents.executeJavaScript('window.__vcq.entitySnapshot()');
      const wrong = structuredClone(step);
      if (step.name === 'LINE') wrong.inputs[1].point = [6000, 4000];
      else wrong.inputs[1].value = '800';
      assert.throws(() => verifyCommand(step.name, wrong, before, after, [], ctx.measureTolerance), ActionFailure);
      const checkpoint = await rec.saveCheckpoint(step.name);
      rows.push({ command: step.name, kind: 'geometry-and-visible', realAction: result, wrong, rejected: true, checkpoint });
    }

    // 2. Mandatory 4.1 Negative Test A: OFFSET from outer wall (0,0)-(9000,0) inward by 200 onto inner wall (200,200)-(9000,200) MUST FAIL
    await vinacad.loadDrawing(win, vinacad.SAMPLE_ID);
    await prepareStage(win, null);
    const offsetOverlapStep = {
      type: 'command',
      name: 'OFFSET',
      inputs: [{ value: '200' }, { point: [4500, 0] }, { point: [4500, 500] }, { key: 'Escape' }],
    };
    let offsetOverlapError = null;
    try {
      await runStep(offsetOverlapStep, ctx);
    } catch (err) {
      offsetOverlapError = err;
    }
    assert.ok(offsetOverlapError instanceof ActionFailure, 'OFFSET onto existing inner wall y=200 must throw ActionFailure');
    assert.match(offsetOverlapError.message, /trùng|không tạo thay đổi nhìn thấy được/i);
    const offsetNegCheckpoint = await rec.saveCheckpoint('OFFSET-negative-overlap');
    rows.push({
      command: 'OFFSET',
      kind: 'negative-overlap-inner-wall',
      step: offsetOverlapStep,
      rejected: true,
      errorMessage: offsetOverlapError.message,
      checkpoint: offsetNegCheckpoint,
    });

    // 3. Mandatory 4.1 Negative Test B: PLINE drawn directly along existing wall [200,200] -> [6900,200] -> [6900,3200] MUST FAIL
    await vinacad.loadDrawing(win, vinacad.SAMPLE_ID);
    await prepareStage(win, null);
    const plineOverlapStep = {
      type: 'command',
      name: 'PLINE',
      inputs: [{ point: [200, 200] }, { point: [6900, 200] }, { point: [6900, 3200] }, { key: 'Enter' }],
    };
    let plineOverlapError = null;
    try {
      await runStep(plineOverlapStep, ctx);
    } catch (err) {
      plineOverlapError = err;
    }
    assert.ok(plineOverlapError instanceof ActionFailure, 'PLINE along existing wall must throw ActionFailure');
    assert.match(plineOverlapError.message, /trùng|không tạo thay đổi nhìn thấy được/i);
    const plineNegCheckpoint = await rec.saveCheckpoint('PLINE-negative-overlap');
    rows.push({
      command: 'PLINE',
      kind: 'negative-overlap-wall',
      step: plineOverlapStep,
      rejected: true,
      errorMessage: plineOverlapError.message,
      checkpoint: plineNegCheckpoint,
    });

    // 4. Mandatory 4.1 Positive Test: selection-offset (OFFSET inner wall [2100,200] inward by 200 to y=400) MUST PASS
    await vinacad.loadDrawing(win, vinacad.SAMPLE_ID);
    await prepareStage(win, null);
    const offsetPositiveStep = {
      type: 'command',
      name: 'OFFSET',
      inputs: [{ value: '200' }, { point: [2100, 200] }, { point: [2100, 500] }, { key: 'Escape' }],
    };
    const offsetPositiveResult = await runStep(offsetPositiveStep, ctx);
    assert.equal(offsetPositiveResult.verification?.visibility?.visible, true, 'Positive OFFSET at y=400 must pass visible postcondition');
    const offsetPosCheckpoint = await rec.saveCheckpoint('OFFSET-positive-y400');
    rows.push({
      command: 'OFFSET',
      kind: 'positive-y400',
      step: offsetPositiveStep,
      rejected: false,
      realAction: offsetPositiveResult,
      checkpoint: offsetPosCheckpoint,
    });

    await rec.finalize();
    rec.detach();
    fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify({ rows, passed: true }, null, 2));
    console.log(JSON.stringify({ root, passed: true, totalChecks: rows.length }));
  } finally {
    win.destroy();
    clearTimeout(timer);
  }
  app.exit(0);
}).catch((e) => {
  console.error(e);
  app.exit(1);
});
