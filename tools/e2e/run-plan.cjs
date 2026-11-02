#!/usr/bin/env node

// Production IPC regression runner. Run with Electron, not plain Node:
//   $env:ELECTRON_RUN_AS_NODE=$null; & node_modules/electron/dist/electron.exe tools/e2e/run-plan.cjs
// It intentionally sends no API key. The built-in sample plans are the offline contract.

const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { app, BrowserWindow, ipcMain } = require('electron');

const ROOT = path.resolve(__dirname, '..', '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceRoot = path.join(ROOT, 'docs', 'handoff', 'evidence', `offline-${stamp}`);
const userData = path.join(evidenceRoot, 'user-data');
fs.mkdirSync(evidenceRoot, { recursive: true });
app.setPath('userData', userData);
const progressLog = path.join(evidenceRoot, 'progress.log');
const log = (message) => {
  const line = `[${new Date().toISOString()}] ${message}`;
  fs.appendFileSync(progressLog, `${line}\n`, 'utf8');
  console.log(line);
};

require(path.join(ROOT, 'electron', 'main.cjs'));

const SAMPLE_DWG = '__BUILTIN_SAMPLE__';
const cases = [
  {
    id: 'layer-edit',
    brief: 'Tạo video quảng cáo khoảng 30 giây cho tính năng Layer trên VinaCAD Web: mở bảng Lớp, chọn layer A-WALLS và đổi tên thành A-WALLS-MAIN, đổi màu sang #FFB347, quay về toàn cảnh rồi xoá layer trống TEMP-EMPTY.',
  },
  {
    id: 'draw-osnap',
    brief: 'Tạo video quảng cáo tính năng vẽ nhanh với bắt điểm (Osnap) trên VinaCAD Web: mở đầu bằng toàn cảnh mặt bằng, vẽ một tủ bếp bằng lệnh RECTANG, vẽ một đường LINE ngang phòng khách, kết thúc ở toàn cảnh bản vẽ.',
  },
  {
    id: 'layer-visibility',
    brief: 'Quay video ngắn giới thiệu kiểm soát layer: mở bảng Lớp, khoá layer A-DIMS để tránh sửa nhầm kích thước, tắt hiển thị layer A-FURNITURE để xem mặt bằng gọn hơn, rồi bật lại hiển thị.',
  },
];
const selectedCases = process.env.PLAN_CASES
  ? cases.filter((item) => process.env.PLAN_CASES.split(',').map((value) => value.trim()).includes(item.id))
  : cases;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
const invoke = async (channel, payload) => {
  const handler = ipcMain._invokeHandlers?.get(channel);
  if (!handler) throw new Error(`Không tìm thấy IPC handler ${channel}`);
  return handler({ sender: null }, payload);
};

function sessionFiles(sessionId) {
  const dir = path.join(userData, 'sessions', sessionId);
  if (!fs.existsSync(dir)) return { dir, files: [] };
  return { dir, files: fs.readdirSync(dir).filter((name) => /\.mp4$/i.test(name)).map((name) => path.join(dir, name)) };
}

function finalizeEvidence(sessionDir, caseId) {
  const source = path.join(sessionDir, 'checkpoints');
  const destination = path.join(evidenceRoot, `frames-${caseId}`);
  if (fs.existsSync(source)) fs.cpSync(source, destination, { recursive: true });
  fs.rmSync(path.join(sessionDir, 'frames'), { recursive: true, force: true });
  return destination;
}

async function runCase(item) {
  const result = { id: item.id, brief: item.brief, plan: null, record: null, render: null, error: null };
  log(`Bắt đầu ${item.id}`);
  const planStarted = performance.now();
  try {
    const planned = await invoke('production:plan', {
      prompt: item.brief,
      dwgPath: SAMPLE_DWG,
      provider: 'Google',
      baseUrl: 'https://generativelanguage.googleapis.com',
      model: 'gemini-3.8-flash',
      apiKey: '',
      knowledge: '',
    });
    result.plan = {
      source: planned.source,
      attempts: planned.attempts ?? 0,
      title: planned.plan?.title,
      scenes: planned.plan?.scenes?.length || 0,
      seconds: planned.plan?.scenes?.reduce((sum, scene) => sum + Number(scene.hold || 0), 0) || 0,
      ms: Math.round(performance.now() - planStarted),
      valid: Boolean(planned.plan && planned.plan.scenes?.length),
    };
    log(`${item.id}: plan OK (${result.plan.scenes} cảnh, ${result.plan.ms}ms)`);

    const recordStarted = performance.now();
    const recorded = await invoke('production:record', {
      plan: planned.plan,
      dwgPath: SAMPLE_DWG,
      context: planned.context,
      quality: '4K master',
    });
    const recordFiles = sessionFiles(recorded.sessionId);
    result.record = {
      sessionId: recorded.sessionId,
      actions: recorded.timeline?.actions || [],
      scenes: recorded.timeline?.scenes?.length || 0,
      duration: recorded.timeline?.duration || 0,
      ms: Math.round(performance.now() - recordStarted),
      files: recordFiles.files,
      timings: recorded.timings || null,
    };
    log(`${item.id}: record OK (${result.record.actions.filter((action) => action.ok).length}/${result.record.actions.length} action, ${result.record.ms}ms)`);

    const renderStarted = performance.now();
    const rendered = await invoke('production:render', {
      sessionId: recorded.sessionId,
      quality: '4K master',
      sceneOverrides: [],
      force: true,
    });
    const renderFiles = sessionFiles(recorded.sessionId);
    result.render = {
      ms: Math.round(performance.now() - renderStarted),
      videoUrl: rendered.video?.url || rendered.url || null,
      files: renderFiles.files,
      path: renderFiles.files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null,
      renderMsReported: rendered.renderMs ?? null,
    };
    result.record.framesDir = finalizeEvidence(recordFiles.dir, item.id);
    log(`${item.id}: render OK (${result.render.ms}ms)`);
  } catch (error) {
    result.error = error?.stack || String(error);
    log(`${item.id}: FAIL ${String(error?.message || error)}`);
  }
  return result;
}

async function main() {
  const totalTimer = setTimeout(() => { log('Vượt thời gian tổng 45 phút, buộc thoát runner.'); app.exit(1); }, 45 * 60 * 1000);
  await app.whenReady();
  log('Electron ready');
  await sleep(1800);
  for (const win of BrowserWindow.getAllWindows()) win.hide();
  const rows = [];
  for (const item of selectedCases) {
    rows.push(await withTimeout(runCase(item), 15 * 60 * 1000, `case ${item.id}`));
    fs.writeFileSync(path.join(evidenceRoot, 'result.json'), JSON.stringify({
      generatedAt: new Date().toISOString(), userData, sampleDwg: SAMPLE_DWG,
      apiUsed: false, complete: false, cases: rows,
    }, null, 2), 'utf8');
  }
  const report = {
    generatedAt: new Date().toISOString(),
    userData,
    sampleDwg: SAMPLE_DWG,
    apiUsed: false,
    complete: true,
    cases: rows,
  };
  const output = path.join(evidenceRoot, 'result.json');
  fs.writeFileSync(output, JSON.stringify(report, null, 2), 'utf8');
  log(`Hoàn tất, ghi ${output}`);
  console.log(JSON.stringify({ output, userData, cases: rows.map((row) => ({ id: row.id, error: row.error, video: row.render?.path })) }, null, 2));
  clearTimeout(totalTimer);
  app.exit(rows.every((row) => !row.error) ? 0 : 1);
}

main().catch((error) => {
  console.error(error?.stack || error);
  app.exit(1);
});
