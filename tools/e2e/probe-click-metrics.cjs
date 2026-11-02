const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');
const root = path.resolve(__dirname, '../../docs/handoff/evidence', `click-probe-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(root, { recursive: true });
app.setPath('userData', path.join(root, 'user-data'));
process.env.VINACUT_NO_MAIN_WINDOW = '1';
require('../../electron/main.cjs');
const capture = require('../../electron/engine/capture.cjs');
const director = require('../../electron/engine/director.cjs');
const { SAMPLE_CONTEXT } = require('../../electron/engine/vinacad.cjs');
const rows = [];
const originalClick = capture.InputDriver.prototype.click;
const read = async input => input.wc.executeJavaScript(`(() => {
  const q = window.__vcq;
  if (!q) return null;
  const app = window.__inWeb || window.__INWEB_INSTANCE__;
  const p = app?.lastPointMouseDown;
  let lastPoint = null;
  let trackedPoint = null;
  try { if (p) lastPoint = { x: Number(p.x), y: Number(p.y), z: Number(p.z) }; } catch {}
  try { const t = app?.lastPointDrawingPlane; if (t) trackedPoint = { x: Number(t.x), y: Number(t.y), z: Number(t.z) }; } catch {}
  return { command: q.cmd(), tolerance: q.worldTolerance(), target: q.worldToClient(7100, 200), neighbor: q.worldToClient(6900, 200), lastPoint, trackedPoint };
})()`, true);
capture.InputDriver.prototype.click = async function (...args) {
  if (process.env.PROBE_APPROACH === '1') {
    const state = await read(this);
    if (state?.command?.active) {
      const target = { x: this.x, y: this.y };
      await this.moveTo(target.x + 28, target.y, { duration: 0.2, bend: 0 });
      await capture.wait(200);
      await this.moveTo(target.x, target.y, { duration: 0.3, bend: 0 });
      await capture.wait(300);
      await this.frame();
    }
  }
  if (process.env.PROBE_SETTLE === '1') {
    const state = await read(this);
    if (state?.command?.active) {
      await capture.wait(1200);
      this.wc.sendInputEvent({ type: 'mouseMove', x: Math.round(this.x), y: Math.round(this.y) });
      await capture.wait(300);
      await this.frame();
    }
  }
  const before = await read(this);
  if (before?.command?.active) await this.rec.saveCheckpoint(`before-click-${rows.length + 1}`);
  const row = { cursor: [this.x, this.y], before };
  const value = await originalClick.apply(this, args);
  row.after = await read(this);
  rows.push(row);
  fs.writeFileSync(path.join(root, 'clicks.json'), JSON.stringify(rows, null, 2));
  return value;
};
const timer = setTimeout(() => app.exit(1), 240000);
app.whenReady().then(async () => {
  const planPath = process.env.PROBE_PLAN || 'docs/handoff/evidence/ai-2026-11-01T04-24-03-865Z/osnap-rectang-a-plan.json';
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8')).plan;
  let result;
  try {
    const recorded = await director.recordPlan({ plan, context: SAMPLE_CONTEXT, drawingPath: '__BUILTIN_SAMPLE__', sessionsRoot: path.join(root, 'sessions') });
    result = { passed: true, sessionId: recorded.sessionId, timeline: recorded.timeline };
  } catch (error) {
    result = { passed: false, error: error.message, sessionId: error.sessionId, actions: error.actions };
  }
  fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify(result, null, 2));
  clearTimeout(timer);
  app.exit(0);
}).catch(error => { console.error(error.message); clearTimeout(timer); app.exit(1); });
