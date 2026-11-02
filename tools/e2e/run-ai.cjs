#!/usr/bin/env node

// AI acceptance runner. It reads provider configuration from environment variables only and
// keeps the key in memory. Never log or persist the key.

const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { app, BrowserWindow, ipcMain } = require('electron');

const ROOT = path.resolve(__dirname, '..', '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceRoot = path.join(ROOT, 'docs', 'handoff', 'evidence', `ai-${stamp}`);
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
const director = require(path.join(ROOT, 'electron', 'engine', 'director.cjs'));

const DWG_A = 'C:\\Users\\taing\\Downloads\\260519_test-bat-diem.dwg';
const DWG_B = 'C:\\Users\\taing\\Downloads\\260629_model-demo-t-corner.dwg';
const knowledge = fs.readFileSync(path.join(ROOT, 'public', 'knowledge', 'project-playbook.md'), 'utf8');

const pointAt = (context, index, fallback = [0, 0]) => context?.keyPoints?.[index]?.point || fallback;
const safeExtents = (context) => context?.extents || { min: [0, 0], max: [1000, 1000] };
function buildCases(contextA, contextB) {
  const extA = safeExtents(contextA);
  const a1 = pointAt(contextA, 0, [extA.min[0], extA.min[1]]);
  const a2 = pointAt(contextA, 1, [extA.max[0], extA.min[1]]);
  const a3 = pointAt(contextA, 2, [extA.min[0], extA.max[1]]);
  const a4 = pointAt(contextA, 3, [extA.max[0], extA.max[1]]);
  const layerA = contextA?.layers?.find((layer) => layer.entityCount > 0)?.name || contextA?.currentLayer || '0';
  const layerA2 = contextA?.layers?.find((layer) => layer.name !== layerA && layer.entityCount > 0)?.name || layerA;
  const layerB = contextB?.layers?.find((layer) => layer.name === 'SS_STACK_MAIN')?.name || contextB?.layers?.find((layer) => layer.entityCount > 0)?.name || '0';
  const supportB = contextB?.layers?.find((layer) => layer.name === 'SS_SUPPORT')?.name || layerB;
  const bPoint = pointAt(contextB, 0, [72485.57, 4581.56]);
  const bRaw2 = pointAt(contextB, 1, [90285.57, 4581.56]);
  const bPoint2 = [bRaw2[0], bPoint[1]];
  return [
    { id: 'layer-edit-a', dwgPath: DWG_A, brief: `Tạo video marketing 30–35 giây cho tính năng Layer. Mở bảng Lớp, chọn ${layerA}, đổi màu cam #FFB347 để nét trên bản vẽ nổi bật, giữ giao diện VinaCAD thật và phụ đề tiếng Việt ngắn.` },
    { id: 'osnap-rectang-a', dwgPath: '__BUILTIN_SAMPLE__', brief: 'Tạo video marketing hướng dẫn bật OSNAP và dùng RECTANG để vẽ một khung chữ nhật nằm trong vùng sàn trống giữa phòng khách (dùng vùng trống OPEN_AREAS giữa phòng khách, không vẽ đè lên tường bao). Rê chuột tại hai góc để hiện bắt điểm, kết thúc lệnh gọn và thu phóng toàn cảnh.' },
    { id: 'text-mtext-a', dwgPath: '__BUILTIN_SAMPLE__', brief: `Tạo demo MTEXT tiếng Việt trong khu vực trống của phòng khách: đặt khung chữ dễ đọc, nội dung chính xác "Nhãn marketing VinaCAD", có chiều cao phù hợp với bản vẽ và xác nhận bằng nút Apply text rồi thu phóng toàn cảnh (không bấm nút Lưu tệp). Điểm bắt đầu tham chiếu [4500,3000] và góc đối diện [6000,3400].` },
    { id: 'pline-a', dwgPath: '__BUILTIN_SAMPLE__', brief: 'Tạo video marketing ngắn cho PLINE: bật OSNAP, vẽ một đường gấp khúc chữ L gồm 3 điểm nằm trong vùng sàn trống giữa phòng khách (dùng OPEN_AREAS, tuyệt đối không vẽ đè dọc theo đoạn tường có sẵn), kết thúc bằng Enter rồi đưa camera về toàn cảnh.' },
    { id: 'command-value-a', dwgPath: '__BUILTIN_SAMPLE__', brief: 'Tạo demo nhập giá trị với CIRCLE: chọn một khoảng trống dễ nhìn trong vùng sàn trống giữa phòng khách (OPEN_AREAS), nhập bán kính 250, xác nhận bằng bàn phím và giữ khung hình đủ rộng để thấy hình tròn vừa tạo.' },
    { id: 'layer-lock-b', dwgPath: DWG_B, brief: `Tạo video marketing 30 giây về quản lý layer trên mô hình T-Corner. Mở Layers, khóa ${layerB}, chọn ${supportB}, tắt hiển thị rồi bật lại để kiểm chứng trạng thái bằng giao diện thật.` },
    { id: 'create-layer-b', dwgPath: DWG_B, brief: 'Tạo demo quản lý layer: mở bảng Layers, tạo layer mới tên MKT-DEMO, chọn layer đó làm hiện hành và giữ bảng layer rõ trong khung hình. Phụ đề nêu lợi ích tổ chức bản vẽ.' },
    { id: 'mode-toggle-b', dwgPath: DWG_B, brief: `Tạo video marketing về vẽ chính xác trên mô hình T-Corner: bật OSNAP, vẽ LINE ngang nối dọc theo nhịp đáy khu vực trung tâm, kết thúc bằng Enter và zoom extents. Hai điểm tham chiếu ngang là [${bPoint}] và [${bPoint2}].` },
    { id: 'selection-edit-b', dwgPath: '__BUILTIN_SAMPLE__', brief: 'Tạo demo chỉnh sửa vật thể: chọn trọn chiếc sofa phòng khách bằng khung cửa sổ, MOVE lên trên 200 đơn vị để người xem thấy thay đổi, sau đó chọn lại chiếc sofa ở khung vị trí mới rồi COPY sang khoảng trống bên phải và kết thúc bằng Enter. Giữ bản gốc trong khung hình.' },
    { id: 'offset-b', dwgPath: '__BUILTIN_SAMPLE__', brief: 'Tạo video marketing cho OFFSET: chọn đoạn tường trong phía dưới phòng khách, nhập khoảng cách 200, chọn phía offset hướng lên vào lòng phòng khách để tạo đường song song mới tách biệt rõ trong vùng trống rồi zoom extents. Chỉ dùng các thao tác đã được kiểm chứng.' },
  ];
}

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

function readEnvConfig() {
  const apiKey = String(process.env.VINACUT_AI_KEY || '').trim();
  return {
    provider: String(process.env.VINACUT_AI_PROVIDER || 'Google').trim() || 'Google',
    model: String(process.env.VINACUT_AI_MODEL || '').trim(),
    baseUrl: String(process.env.VINACUT_AI_BASE_URL || '').trim(),
    apiKey,
  };
}

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

async function runCase(item, config) {
  const row = { id: item.id, dwgPath: item.dwgPath, brief: item.brief, plan: null, record: null, render: null, error: null };
  log(`Bắt đầu ${item.id} · ${path.basename(item.dwgPath)}`);
  try {
    const planStarted = performance.now();
    const planned = await invoke('production:plan', {
      prompt: item.brief,
      knowledge,
      dwgPath: item.dwgPath,
      provider: config.provider || 'Google',
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: String(config.apiKey).trim(),
    });
    row.plan = {
      source: planned.source,
      attempts: planned.attempts ?? null,
      validationErrors: planned.validationErrors || [],
      title: planned.plan?.title,
      scenes: planned.plan?.scenes?.length || 0,
      ms: Math.round(performance.now() - planStarted),
      valid: Boolean(planned.plan && planned.plan.scenes?.length),
      actionTypes: [...new Set((planned.plan?.scenes || []).flatMap((scene) => scene.steps || []).map((step) => step.type))],
      captionTextValid: Boolean(planned.plan?.scenes?.length) && planned.plan.scenes.every((scene) => String(scene.description || '').trim().length > 0 && String(scene.description || '').length <= 90),
      requestErrors: planned.requestErrors || [],
      repairs: planned.repairs || [],
      rawPlanFile: `${item.id}-raw-plan.json`,
      planFile: `${item.id}-plan.json`,
    };
    log(`${item.id}: plan ${row.plan.source}, lượt ${row.plan.attempts}, ${row.plan.scenes} cảnh, repairs=${(planned.repairs || []).length}`);
    fs.writeFileSync(path.join(evidenceRoot, `${item.id}-raw-plan.json`), JSON.stringify({ rawPlan: planned.rawPlan || null, rawAttempts: planned.rawAttempts || [] }, null, 2));
    fs.writeFileSync(path.join(evidenceRoot, `${item.id}-plan.json`), JSON.stringify({ ...planned, repairs: planned.repairs || [] }, null, 2));

    const recordStarted = performance.now();
    log(`${item.id}: bắt đầu production:record`);
    const recorded = await invoke('production:record', {
      plan: planned.plan,
      context: planned.context,
      dwgPath: item.dwgPath,
      quality: '4K master',
    });
    const recordFiles = sessionFiles(recorded.sessionId);
    row.record = {
      sessionId: recorded.sessionId,
      actions: recorded.timeline?.actions || [],
      scenes: recorded.timeline?.scenes?.length || 0,
      duration: recorded.timeline?.duration || 0,
      ms: Math.round(performance.now() - recordStarted),
      files: recordFiles.files,
      timings: recorded.timings || null,
      finalCommandLine: recorded.timeline?.finalCommandLine || null,
    };
    const ok = row.record.actions.filter((action) => action.ok).length;
    fs.writeFileSync(path.join(evidenceRoot, `${item.id}-timeline.json`), JSON.stringify(recorded.timeline, null, 2));
    log(`${item.id}: record ${ok}/${row.record.actions.length} action`);

    const renderStarted = performance.now();
    log(`${item.id}: bắt đầu production:render(force)`);
    const rendered = await invoke('production:render', { sessionId: recorded.sessionId, quality: '4K master', sceneOverrides: [], force: true });
    const renderFiles = sessionFiles(recorded.sessionId);
    row.render = {
      ms: Math.round(performance.now() - renderStarted),
      videoUrl: rendered.video?.url || null,
      files: renderFiles.files,
      path: renderFiles.files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null,
      renderMsReported: rendered.renderMs ?? null,
    };
    const evidenceVideo = row.render.path && fs.existsSync(row.render.path) ? path.join(evidenceRoot, `${item.id}.mp4`) : null;
    if (evidenceVideo) fs.copyFileSync(row.render.path, evidenceVideo);
    row.render.evidencePath = evidenceVideo;
    row.record.framesDir = finalizeEvidence(recordFiles.dir, item.id);
    log(`${item.id}: render OK`);
  } catch (error) {
    row.error = error?.stack || String(error);
    row.plan ||= { source: 'ai', valid: false, attempts: error.attempts ?? null, validationErrors: error.validationErrors || [], requestErrors: error.requestErrors || [] };
    if (error.sessionId) {
      row.record = { sessionId: error.sessionId, actions: error.actions || [], framesDir: finalizeEvidence(sessionFiles(error.sessionId).dir, item.id) };
    }
    log(`${item.id}: FAIL ${String(error?.message || error)}`);
  }
  fs.writeFileSync(path.join(evidenceRoot, `${item.id}-result.json`), JSON.stringify(row, null, 2));
  return row;
}

async function main() {
  const totalTimer = setTimeout(() => {
    log('Dừng batch AI vì vượt quá thời gian tổng 90 phút.');
    app.exit(1);
  }, 90 * 60 * 1000);
  await app.whenReady();
  await sleep(1800);
  for (const win of BrowserWindow.getAllWindows()) win.hide();
  const config = readEnvConfig();
  if (!config.apiKey) {
    const output = path.join(evidenceRoot, 'result.json');
    fs.writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), apiUsed: false, status: 'blocked-no-env-key', requiredEnv: ['VINACUT_AI_PROVIDER', 'VINACUT_AI_MODEL', 'VINACUT_AI_BASE_URL', 'VINACUT_AI_KEY'], cases: [] }, null, 2), 'utf8');
    log(`BLOCKED: thiếu VINACUT_AI_KEY; chưa gửi request nào, ghi ${output}`);
    clearTimeout(totalTimer);
    app.exit(1);
    return;
  }
  log(`Đã đọc cấu hình môi trường: provider=${config.provider}, model=${config.model || '(mặc định)'}, keyPresent=true`);
  log('Đang đọc context hai DWG để brief có layer, hình và tọa độ cụ thể…');
  const contextA = (await director.collectContext({ drawingPath: DWG_A, onProgress: (p) => log(p.message || p.phase || 'context-a') })).context;
  const contextB = (await director.collectContext({ drawingPath: DWG_B, onProgress: (p) => log(p.message || p.phase || 'context-b') })).context;
  const requestedCases = String(process.env.AI_CASES || '').split(',').map((value) => value.trim()).filter(Boolean);
  const allCases = buildCases(contextA, contextB);
  const cases = requestedCases.length ? allCases.filter((item) => requestedCases.includes(item.id)) : allCases;
  if (!cases.length) throw new Error(`Không tìm thấy AI_CASES=${requestedCases.join(',')}`);
  log(`Batch gồm ${cases.length}/${allCases.length} brief.`);
  const rows = [];
  for (const item of cases) {
    try {
      rows.push(await withTimeout(runCase(item, config), 15 * 60 * 1000, item.id));
    } catch (error) {
      rows.push({ id: item.id, dwgPath: item.dwgPath, brief: item.brief, plan: null, record: null, render: null, error: error?.stack || String(error) });
      log(`${item.id}: TIMEOUT/FAIL ${String(error?.message || error)}`);
    }
  }
  const passing = rows.filter((row) => {
    const actions = row.record?.actions || [];
    const clean = actions.every((action) => action.ok && action.cleanState?.commandIdle && action.cleanState?.editorClosed && action.cleanState?.pickerClosed && action.cleanState?.menusClosed);
    const captions = row.plan?.captionTextValid === true;
    return !row.error && row.render?.evidencePath && fs.existsSync(row.render.evidencePath)
      && row.plan?.valid && actions.length > 0 && actions.every((action) => action.ok) && clean && captions;
  }).length;
  const output = path.join(evidenceRoot, 'result.json');
  fs.writeFileSync(output, JSON.stringify({
    generatedAt: new Date().toISOString(),
    provider: config.provider || 'Google',
    model: config.model || '',
    apiKeyUsed: true,
    batch: { total: cases.length, automatedPassing: passing, target: 9, automatedPass: passing >= 9, visualReviewRequired: true },
    cases: rows,
  }, null, 2), 'utf8');
  log(`Hoàn tất, ghi ${output}`);
  console.log(JSON.stringify({ output, cases: rows.map((row) => ({ id: row.id, source: row.plan?.source, actions: row.record ? `${row.record.actions.filter((action) => action.ok).length}/${row.record.actions.length}` : null, error: row.error, video: row.render?.path })) }, null, 2));
  clearTimeout(totalTimer);
  app.exit(passing >= Math.ceil(cases.length * 0.9) ? 0 : 1);
}

main().catch((error) => {
  log(`Dừng test: ${String(error?.message || error)}`);
  app.exit(1);
});
