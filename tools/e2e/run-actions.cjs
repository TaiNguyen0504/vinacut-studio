#!/usr/bin/env node

// Real-UI action acceptance cases on the built-in sample. No API key is used.
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { app, BrowserWindow, ipcMain } = require('electron');

const ROOT = path.resolve(__dirname, '..', '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceRoot = path.join(ROOT, 'docs', 'handoff', 'evidence', `actions-${stamp}`);
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

const scene = (label, description, steps) => ({ label, description, caption: description, focus: 'auto', hold: 1.1, steps });
const cases = [
  { id: 'create-select', plan: { title: 'Tạo và chọn layer', scenes: [scene('Tạo layer', 'Tạo layer MKT-ACTION bằng nút +.', [{ type: 'open_panel', panel: 'Layers' }, { type: 'create_layer', name: 'MKT-ACTION' }]), scene('Chọn layer', 'Chọn layer vừa tạo làm layer hiện hành.', [{ type: 'select_layer', layer: 'MKT-ACTION' }])] } },
  { id: 'mode-click-escape', plan: { title: 'Chế độ và nút giao diện', scenes: [scene('Bật Osnap', 'Bật chế độ bắt điểm bằng nút trạng thái.', [{ type: 'toggle_mode', mode: 'OSNAP', on: true }]), scene('Click panel', 'Bấm nhãn Thuộc tính để kiểm tra click UI.', [{ type: 'click', text: 'Thuộc tính' }]), scene('Escape', 'Gửi Escape và xác nhận không còn lệnh chạy.', [{ type: 'escape' }])] } },
  { id: 'zoom-value', plan: { title: 'Zoom và nhập bán kính', scenes: [scene('Zoom vùng bếp', 'Phóng to vùng bếp của mặt bằng.', [{ type: 'zoom_to', min: [7000, 100], max: [11800, 3900] }]), scene('Vẽ hình tròn', 'Vẽ hình tròn với bán kính nhập bằng bàn phím.', [{ type: 'command', name: 'CIRCLE', inputs: [{ point: [9300, 2350], hover: 0.6 }, { value: '350' }] }])] } },
  { id: 'text-vietnamese', plan: { title: 'Chú thích tiếng Việt', scenes: [scene('MTEXT', 'Đặt chú thích tiếng Việt bằng trình soạn thảo thật.', [{ type: 'command', name: 'MTEXT', height: 180, inputs: [{ point: [4500, 3000], hover: 0.4 }, { point: [6000, 3400], hover: 0.4 }, { value: 'Xin chào VinaCAD' }] }])] } },
  { id: 'selection-move', plan: { title: 'Chọn và di chuyển', scenes: [scene('Chọn đối tượng', 'Chọn đối tượng tại [2100,600] khi OSNAP mặc định đang bật.', [{ type: 'select', points: [[2100, 600]] }]), scene('Di chuyển', 'Di chuyển đối tượng từ [2100,600] tới [2300,800] và kiểm vector sau bắt điểm.', [{ type: 'command', name: 'MOVE', inputs: [{ point: [2100, 600], hover: 0.4 }, { point: [2300, 800] }] }])] } },
  { id: 'selection-move-osnap-off', plan: { title: 'Chọn và di chuyển chính xác', scenes: [scene('Tắt bắt điểm có chủ đích', 'Tắt bắt điểm trên nút thật để nhập vector chính xác.', [{ type: 'toggle_mode', mode: 'OSNAP', on: false }]), scene('Chọn đoạn tường', 'Chọn một đoạn tường ngang tại [4500,0].', [{ type: 'select', points: [[4500, 0]] }]), scene('Di chuyển', 'Di chuyển đoạn tường bằng vector [200,200].', [{ type: 'command', name: 'MOVE', inputs: [{ point: [4500, 0], hover: 0.4 }, { point: [4700, 200] }] }])] } },
  { id: 'selection-copy', plan: { title: 'Sao chép đối tượng', scenes: [scene('Chọn đối tượng', 'Chọn đối tượng tại góc phòng khách.', [{ type: 'select', points: [[2100, 600]] }]), scene('Sao chép', 'Sao chép đối tượng sang vị trí mới rồi kết thúc bằng Enter.', [{ type: 'command', name: 'COPY', inputs: [{ point: [2100, 600] }, { point: [2600, 900] }, { key: 'Enter' }] }])] } },
  { id: 'selection-copy-window', plan: { title: 'Sao chép trọn vật thể', scenes: [scene('Chọn cả vật thể bằng khung', 'Kéo khung trái sang phải bao quanh trọn vật thể ở góc phòng khách.', [{ type: 'select', window: [[800, 500], [3600, 1600]] }]), scene('Sao chép trọn vật thể', 'Sao chép cả vật thể sang vị trí mới rồi kết thúc bằng Enter.', [{ type: 'command', name: 'COPY', inputs: [{ window: [[800, 500], [3600, 1600]] }, { point: [2200, 600] }, { point: [4000, 2000] }, { key: 'Enter' }] }])] } },
  { id: 'selection-rotate', plan: { title: 'Xoay đối tượng', scenes: [scene('Chọn đối tượng', 'Chọn đối tượng tại [2100,600] khi OSNAP mặc định đang bật.', [{ type: 'select', points: [[2100, 600]] }]), scene('Xoay 45 độ', 'Xoay đối tượng quanh điểm gốc [2100,600] bằng góc 45 độ.', [{ type: 'command', name: 'ROTATE', inputs: [{ point: [2100, 600] }, { value: '45' }] }])] } },
  { id: 'selection-rotate-osnap-off', plan: { title: 'Xoay chính xác', scenes: [scene('Tắt bắt điểm có chủ đích', 'Tắt bắt điểm trên nút thật để nhập góc xoay chính xác.', [{ type: 'toggle_mode', mode: 'OSNAP', on: false }]), scene('Chọn đối tượng', 'Chọn đoạn tường tại [4500,0].', [{ type: 'select', points: [[4500, 0]] }]), scene('Xoay 45 độ', 'Xoay đoạn tường quanh [4500,0] bằng góc 45 độ.', [{ type: 'command', name: 'ROTATE', inputs: [{ point: [4500, 0] }, { value: '45' }] }])] } },
  { id: 'create-erase', plan: { title: 'Tạo rồi xoá', scenes: [scene('Tạo hình tròn', 'Tạo một hình tròn tạm để kiểm tra xoá.', [{ type: 'command', name: 'CIRCLE', inputs: [{ point: [3300, 2600] }, { value: '180' }] }]), scene('Xoá hình tròn', 'Chọn cạnh hình tròn tạm và xoá khỏi bản vẽ.', [{ type: 'select', points: [[3480, 2600]] }, { type: 'command', name: 'ERASE', inputs: [] }])] } },
  { id: 'selection-offset', plan: { title: 'Tạo đường song song', scenes: [scene('Tạo đường song song', 'Nhập khoảng cách 200, chọn đoạn tường và phía offset rồi kết thúc lệnh.', [{ type: 'command', name: 'OFFSET', inputs: [{ value: '200' }, { point: [2100, 200] }, { point: [2100, 500] }, { key: 'Escape' }] }])] } },
  { id: 'zoom-extents', plan: { title: 'Khung toàn cảnh', scenes: [scene('Toàn cảnh', 'Đưa toàn bộ bản vẽ vào khung hình.', [{ type: 'zoom_extents' }])] } },
];
cases.push({ id: 'ai-osnap-kitchen', plan: JSON.parse(fs.readFileSync(path.join(__dirname, 'plans', 'ai-osnap-kitchen.json'), 'utf8')) });
const selectedCases = process.env.ACTION_CASES
  ? cases.filter((item) => process.env.ACTION_CASES.split(',').map((value) => value.trim()).includes(item.id))
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
const sample = '__BUILTIN_SAMPLE__';

function finalizeEvidence(sessionDir, caseId) {
  const source = path.join(sessionDir, 'checkpoints');
  const destination = path.join(evidenceRoot, `frames-${caseId}`);
  if (fs.existsSync(source)) {
    fs.cpSync(source, destination, { recursive: true });
  }
  fs.rmSync(path.join(sessionDir, 'frames'), { recursive: true, force: true });
  return destination;
}

async function main() {
  const totalTimer = setTimeout(() => { log('Vượt thời gian tổng 45 phút, buộc thoát runner.'); app.exit(1); }, 45 * 60 * 1000);
  await app.whenReady();
  await sleep(1800);
  for (const win of BrowserWindow.getAllWindows()) win.hide();
  const rows = [];
  for (const item of selectedCases) {
    const row = { id: item.id, plan: item.plan, record: null, error: null };
    log(`Bắt đầu ${item.id}`);
    try {
      const started = performance.now();
      const recorded = await withTimeout(invoke('production:record', { plan: item.plan, dwgPath: sample, quality: '4K master' }), 300000, `record ${item.id}`);
      const dir = path.join(userData, 'sessions', recorded.sessionId);
      const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith('.mp4')).map((name) => path.join(dir, name)) : [];
      const framesDir = finalizeEvidence(dir, item.id);
      const evidenceVideo = files[0] && fs.existsSync(files[0]) ? path.join(evidenceRoot, `${item.id}.mp4`) : null;
      if (evidenceVideo) fs.copyFileSync(files[0], evidenceVideo);
      const timelinePath = path.join(evidenceRoot, `${item.id}-timeline.json`);
      fs.writeFileSync(timelinePath, JSON.stringify(recorded.timeline, null, 2), 'utf8');
      row.record = { sessionId: recorded.sessionId, actions: recorded.timeline.actions, duration: recorded.timeline.duration, ms: Math.round(performance.now() - started), timings: recorded.timings || null, video: evidenceVideo, framesDir, timeline: timelinePath, finalCommandLine: recorded.timeline.finalCommandLine || null };
      log(`${item.id}: ${row.record.actions.filter((action) => action.ok).length}/${row.record.actions.length} OK`);
    } catch (error) {
      row.error = error?.stack || String(error);
      if (error.sessionId) {
        row.record = { sessionId: error.sessionId, actions: error.actions || [], framesDir: finalizeEvidence(path.join(userData, 'sessions', error.sessionId), item.id) };
      }
      log(`${item.id}: FAIL ${String(error?.message || error)}`);
    }
    rows.push(row);
    fs.writeFileSync(path.join(evidenceRoot, 'result.json'), JSON.stringify({ generatedAt: new Date().toISOString(), apiUsed: false, cases: rows }, null, 2), 'utf8');
  }
  const output = path.join(evidenceRoot, 'result.json');
  fs.writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), apiUsed: false, cases: rows }, null, 2), 'utf8');
  log(`Hoàn tất, ghi ${output}`);
  clearTimeout(totalTimer);
  app.exit(rows.every((row) => !row.error) ? 0 : 1);
}
main().catch((error) => { log(`Dừng test: ${String(error?.message || error)}`); app.exit(1); });
