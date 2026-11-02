const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { createRecorderWindow, ensureViewport, FrameRecorder, InputDriver, VIEW_W, VIEW_H } = require('./capture.cjs');
const vinacad = require('./vinacad.cjs');
const { runStep, prepareStage, readPlanningContext } = require('./actions.cjs');
const { renderVideo, OUTPUTS } = require('./render.cjs');

const KEEP_SESSIONS = 4;

async function pruneSessions(root, keepId) {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const dirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === keepId) continue;
    const full = path.join(root, entry.name);
    const stat = await fs.stat(full).catch(() => null);
    if (stat) dirs.push({ full, mtime: stat.mtimeMs });
  }
  dirs.sort((a, b) => b.mtime - a.mtime);
  for (const old of dirs.slice(KEEP_SESSIONS - 1)) await fs.rm(old.full, { recursive: true, force: true }).catch(() => {});
}

async function openStage({ drawingPath, signal, onProgress, plan = null }) {
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (signal?.aborted) throw new Error('Đã dừng tác vụ.');
    const win = createRecorderWindow({ deviceScaleFactor: 2 });
    try {
      onProgress?.({ phase: 'load', message: 'Đang mở VinaCAD Web ở chế độ quay 4K ngầm…' });
      await win.loadURL(vinacad.VINACAD_URL);
      await ensureViewport(win);
      const ready = await vinacad.waitForEditorReady(win, 95000, signal);
      if (!ready) throw new Error('VinaCAD Web chưa sẵn sàng sau 95 giây. Kiểm tra kết nối mạng rồi thử lại.');
      onProgress?.({ phase: 'load', message: 'Đang nạp bản vẽ…' });
      const drawingName = await vinacad.loadDrawing(win, drawingPath);
      await ensureViewport(win);
      await prepareStage(win, plan);
      win.webContents.focus();
      return { win, drawingName };
    } catch (error) {
      lastError = error;
      if (!win.isDestroyed()) win.destroy();
      if (attempt < 2 && !signal?.aborted) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// Reads layers, extents and key points of a user drawing (the sample has static context).
async function collectContext({ drawingPath, signal, onProgress }) {
  if (vinacad.isSamplePath(drawingPath)) return { context: vinacad.SAMPLE_CONTEXT, screenshot: null };
  const { win, drawingName } = await openStage({ drawingPath, signal, onProgress });
  try {
    const context = await readPlanningContext(win);
    const image = await win.webContents.capturePage();
    const screenshot = image.resize({ width: 1280 }).toJPEG(82).toString('base64');
    return { context: { ...context, drawingName }, screenshot };
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

async function recordPlan({ plan, context, drawingPath, sessionsRoot, signal, onProgress }) {
  const sessionId = randomUUID();
  const sessionDir = path.join(sessionsRoot, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });
  const { win, drawingName } = await openStage({ drawingPath, signal, onProgress, plan });
  const scenes = [];
  const actions = [];
  try {
    const rec = new FrameRecorder(win, sessionDir);
    const input = new InputDriver(win, rec);
    await rec.start();
    await input.ensureOverlay();
    await input.hold(0.9);
    const actionContext = { win, rec, input, signal, context: context || (vinacad.isSamplePath(drawingPath) ? vinacad.SAMPLE_CONTEXT : null), selectedSnapshot: [] };
    const total = plan.scenes.length;
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new Error('Đã dừng tác vụ.');
      const scene = plan.scenes[i];
      const record = { label: scene.label, description: scene.description, focus: scene.focus || 'auto', start: rec.time, end: 0, targets: [], checkpoints: [] };
      onProgress?.({ phase: 'record', scene: i + 1, total, message: `Đang quay cảnh ${i + 1}/${total}: ${scene.label}`, detail: scene.description });
      // Lead-in hold: the camera eases to this scene's framing before the first action.
      await input.hold(0.75);
      for (const step of scene.steps) {
        if (signal?.aborted) throw new Error('Đã dừng tác vụ.');
        try {
          actionContext.scene = record;
          const result = await runStep(step, actionContext);
          const checkpoint = await rec.saveCheckpoint(`scene-${i + 1}-action-${actions.length + 1}`);
          if (checkpoint) record.checkpoints.push(checkpoint);
          actions.push({ scene: i, type: step.type, ok: true, intent: result.intent, verification: result.verification || null, cleanState: result.cleanState || null, checkpoint });
        } catch (error) {
          const checkpoint = await rec.saveCheckpoint(`scene-${i + 1}-action-${actions.length + 1}-failed`).catch(() => null);
          if (checkpoint) record.checkpoints.push(checkpoint);
          actions.push({ scene: i, type: step.type, ok: false, intent: error.message, checkpoint });
          throw new Error(`Cảnh ${i + 1} "${scene.label}": ${error.message}`);
        }
      }
      await input.hold(scene.hold || 1.6);
      record.end = rec.time;
      scenes.push(record);
    }
    await input.hold(1.4);
    const finalCheckpoint = await rec.saveCheckpoint('final');
    const finalCommandLine = await win.webContents.executeJavaScript(`(() => {
      const state = window.__vcq?.cmd?.() || null;
      const display = document.getElementById('command-display');
      const input = document.getElementById('command-prompt-input');
      return { state, inputValue: input?.value || '', placeholder: input?.placeholder || '', text: display ? String(display.innerText || '').trim().split(/\\r?\\n/).filter(Boolean).slice(-4) : [], history: Array.isArray(window.__vcHistory) ? window.__vcHistory.slice(-8) : [] };
    })()`, true).catch(() => null);
    const frames = await rec.finalize();
    rec.detach();
    const timeline = {
      version: 2,
      id: sessionId,
      title: plan.title || drawingName,
      drawingName,
      fps: 60,
      viewport: { width: VIEW_W, height: VIEW_H },
      frameSize: frames.frameSize,
      frameCount: frames.frameCount,
      duration: frames.duration,
      scenes,
      actions,
      finalCommandLine,
      checkpoints: { dir: path.join(sessionDir, 'checkpoints'), final: finalCheckpoint },
      plan,
    };
    await fs.writeFile(path.join(sessionDir, 'timeline.json'), JSON.stringify(timeline, null, 2), 'utf8');
    pruneSessions(sessionsRoot, sessionId).catch(() => {});
    return { sessionId, sessionDir, timeline };
  } catch (error) {
    const failure = { sessionId, failed: true, message: error.message, plan, actions, scenes };
    await fs.writeFile(path.join(sessionDir, 'failure.json'), JSON.stringify(failure, null, 2), 'utf8');
    error.sessionId = sessionId;
    error.actions = actions;
    throw error;
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

async function loadTimeline(sessionsRoot, sessionId) {
  if (!/^[a-z0-9-]+$/i.test(String(sessionId || ''))) throw new Error('Phiên quay không hợp lệ.');
  const sessionDir = path.join(sessionsRoot, sessionId);
  const file = path.join(sessionDir, 'timeline.json');
  if (!fsSync.existsSync(file)) throw new Error('Không còn dữ liệu phiên quay này. Hãy quay lại video.');
  return { sessionDir, timeline: JSON.parse(await fs.readFile(file, 'utf8')) };
}

async function renderSession({ ffmpegPath, sessionsRoot, sessionId, quality, sceneOverrides, signal, onProgress }) {
  const { sessionDir, timeline } = await loadTimeline(sessionsRoot, sessionId);
  const id = (OUTPUTS[quality] || OUTPUTS['4K master']).id;
  // A fresh file per render: the preview may still be streaming the previous one.
  const outputPath = path.join(sessionDir, `render_${id}_${Date.now()}.mp4`);
  const result = await renderVideo({
    ffmpegPath,
    sessionDir,
    timeline,
    sceneOverrides,
    quality,
    outputPath,
    signal,
    onProgress: (p) => onProgress?.({ phase: 'render', percent: p, message: `Đang dựng video ${Math.round(p * 100)}%…` }),
  });
  const stale = (await fs.readdir(sessionDir).catch(() => []))
    .filter((name) => name.startsWith(`render_${id}_`) && name !== path.basename(outputPath));
  for (const name of stale) await fs.rm(path.join(sessionDir, name), { force: true }).catch(() => {});
  return { ...result, sessionId, fileName: path.basename(result.path), timeline };
}

module.exports = { collectContext, recordPlan, renderSession, loadTimeline };
