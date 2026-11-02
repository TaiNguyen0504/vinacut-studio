#!/usr/bin/env node

// Real-DWG production regression. It reads drawing context first, then executes a validated
// plan through the same production IPC path as the app. No API key is used here.
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { app, BrowserWindow, ipcMain } = require('electron');

const ROOT = path.resolve(__dirname, '..', '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceRoot = path.join(ROOT, 'docs', 'handoff', 'evidence', `real-${stamp}`);
const userData = path.join(evidenceRoot, 'user-data');
fs.mkdirSync(evidenceRoot, { recursive: true });
app.setPath('userData', userData);
const logPath = path.join(evidenceRoot, 'progress.log');
const log = (message) => { const line = `[${new Date().toISOString()}] ${message}`; fs.appendFileSync(logPath, `${line}\n`, 'utf8'); console.log(line); };
require(path.join(ROOT, 'electron', 'main.cjs'));
const director = require(path.join(ROOT, 'electron', 'engine', 'director.cjs'));

const drawingPath = process.env.DWG_PATH || 'C:\\Users\\taing\\Downloads\\260629_model-demo-t-corner.dwg';
const isTCorner = /260629_model-demo-t-corner\.dwg$/i.test(drawingPath);
const invoke = async (channel, payload) => { const handler = ipcMain._invokeHandlers?.get(channel); if (!handler) throw new Error(`Không tìm thấy IPC handler ${channel}`); return handler({ sender: null }, payload); };
const withTimeout = (promise, ms, label) => {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => {
      const cancel = ipcMain._invokeHandlers?.get('production:cancel');
      if (cancel) Promise.resolve(cancel({ sender: null })).catch(() => {});
      reject(new Error(`${label} quá thời gian ${Math.round(ms / 1000)}s.`));
    }, ms); }),
  ]).finally(() => clearTimeout(timer));
};

function dynamicBatDiemPlan(context) {
  const layer = context.layers?.find((item) => item.entityCount > 0)?.name || context.currentLayer || '0';
  const min = context.extents?.min || [0, 0];
  const max = context.extents?.max || [1000, 1000];
  const w = max[0] - min[0];
  const h = max[1] - min[1];
  const p1 = [Math.round((min[0] + w * 0.2) * 100) / 100, Math.round((min[1] + h * 0.25) * 100) / 100];
  const p2 = [Math.round((min[0] + w * 0.7) * 100) / 100, p1[1]];
  return {
    title: 'Bat diem: chọn và vẽ trên DWG thật',
    scenes: [
      { label: 'Mở bản vẽ', description: 'Mở toàn cảnh bản vẽ Bat Diem thật.', caption: 'Mở toàn cảnh bản vẽ Bat Diem thật.', focus: 'full', hold: 1.2, steps: [{ type: 'pause', seconds: 1 }] },
      { label: 'Chọn layer', description: `Mở bảng Lớp và chọn layer ${layer}.`, caption: `Chọn layer ${layer} để chuẩn bị thao tác.`, focus: 'auto', hold: 1.2, steps: [{ type: 'open_panel', panel: 'Layers' }, { type: 'select_layer', layer }] },
      { label: 'Vẽ đường kiểm tra', description: `Vẽ LINE từ [${p1}] tới [${p2}].`, caption: 'Vẽ một đường kiểm tra trên hình học thật.', focus: 'auto', hold: 1.4, steps: [{ type: 'command', name: 'LINE', inputs: [{ point: p1, hover: 0.7 }, { point: p2, hover: 0.7 }, { key: 'Enter' }] }] },
      { label: 'Kiểm tra toàn cảnh', description: 'Thu phóng toàn cảnh sau thao tác.', caption: 'Kiểm tra toàn cảnh sau khi vẽ.', focus: 'full', hold: 1.4, steps: [{ type: 'zoom_extents' }] },
    ],
  };
}

function finalizeEvidence(sessionDir, caseId) {
  const source = path.join(sessionDir, 'checkpoints');
  const destination = path.join(evidenceRoot, `frames-${caseId}`);
  if (fs.existsSync(source)) fs.cpSync(source, destination, { recursive: true });
  fs.rmSync(path.join(sessionDir, 'frames'), { recursive: true, force: true });
  return destination;
}

async function main() {
  const totalTimer = setTimeout(() => { log('Vượt thời gian tổng 30 phút, buộc thoát runner.'); app.exit(1); }, 30 * 60 * 1000);
  await app.whenReady();
  await new Promise((resolve) => setTimeout(resolve, 1800));
  for (const win of BrowserWindow.getAllWindows()) win.hide();
  log(`Đọc context ${path.basename(drawingPath)}`);
  const contextResult = await withTimeout(director.collectContext({ drawingPath, onProgress: (p) => log(p.message || p.phase || 'context') }), 5 * 60 * 1000, 'collect context');
  const context = contextResult.context;
  fs.writeFileSync(path.join(evidenceRoot, 'context.json'), JSON.stringify(context, null, 2));
  const defaultPlanPath = isTCorner
    ? path.join(ROOT, 'tools', 'e2e', 'plans', 't-corner.json')
    : path.join(ROOT, 'tools', 'e2e', 'plans', 'bat-diem.json');
  const planPath = process.env.PLAN_PATH || defaultPlanPath;
  const plan = fs.existsSync(planPath) ? JSON.parse(fs.readFileSync(planPath, 'utf8')) : dynamicBatDiemPlan(context);
  log(`Bắt đầu quay ${path.basename(drawingPath)} (${context.entityTotal || 0} entities, ${context.layers?.length || 0} layers)`);
  const started = performance.now();
  const recorded = await withTimeout(invoke('production:record', { plan, context, dwgPath: drawingPath, quality: '4K master' }), 12 * 60 * 1000, 'record');
  const dir = path.join(userData, 'sessions', recorded.sessionId);
  const rendered = await withTimeout(invoke('production:render', { sessionId: recorded.sessionId, quality: '4K master', sceneOverrides: [], force: true }), 10 * 60 * 1000, 'render');
  const framesDir = finalizeEvidence(dir, isTCorner ? 't-corner' : 'bat-diem');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith('.mp4')).map((name) => path.join(dir, name)) : [];
  const result = {
    generatedAt: new Date().toISOString(), apiUsed: false, drawingPath, contextSummary: {
      drawingName: context.drawingName, entityTotal: context.entityTotal, extents: context.extents,
      layers: context.layers?.map((item) => ({ name: item.name, entityCount: item.entityCount, color: item.color })) || [],
    },
    plan, sessionId: recorded.sessionId, actions: recorded.timeline.actions, duration: recorded.timeline.duration,
    timings: { ...(recorded.timings || {}), rerenderMs: rendered.renderMs, totalMs: Math.round(performance.now() - started) },
    finalCommandLine: recorded.timeline.finalCommandLine,
    framesDir, video: files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null,
  };
  const output = path.join(evidenceRoot, 'result.json');
  fs.writeFileSync(output, JSON.stringify(result, null, 2), 'utf8');
  log(`Hoàn tất ${result.actions.filter((action) => action.ok).length}/${result.actions.length}, ghi ${output}`);
  clearTimeout(totalTimer);
  app.exit(0);
}
main().catch((error) => { log(`Dừng test: ${String(error?.message || error)}`); app.exit(1); });
