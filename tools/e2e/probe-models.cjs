const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');
const root = path.resolve(__dirname, '../../docs/handoff/evidence', `model-probe-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(root, { recursive: true });
app.setPath('userData', path.join(root, 'user-data'));
process.env.VINACUT_NO_MAIN_WINDOW = '1';
const { callAiChatInternal } = require('../../electron/main.cjs');
const { planWithAi } = require('../../electron/engine/planner.cjs');
const { SAMPLE_CONTEXT } = require('../../electron/engine/vinacad.cjs');
const rows = [];
const timer = setTimeout(() => app.exit(1), 240000);
app.whenReady().then(async () => {
  const apiKey = process.env.VINACUT_AI_KEY;
  if (!apiKey) throw new Error('Thiếu VINACUT_AI_KEY.');
  for (const model of (process.env.PROBE_MODELS || 'gemini-3.6-flash,gemini-3.5-flash-lite').split(',')) {
    const started = performance.now();
    const row = { model, passed: false };
    try {
      const result = await planWithAi({
        prompt: 'Tạo video marketing vẽ hình tròn bán kính 250 ở khoảng trống giữa phòng khách, giữ ngữ cảnh phòng và kết thúc bằng toàn cảnh.',
        context: SAMPLE_CONTEXT,
        chat: payload => callAiChatInternal({ provider: 'Google', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', apiKey, model, timeoutMs: 30000, ...payload }, payload.signal),
      });
      Object.assign(row, { passed: true, attempts: result.attempts, requestErrors: result.requestErrors, plan: result.plan });
    } catch (error) {
      row.error = String(error.message).split(apiKey).join('[REDACTED]');
      row.status = error.status || null;
      row.attempts = error.attempts || 1;
    }
    row.ms = Math.round(performance.now() - started);
    rows.push(row);
    fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify({ rows }, null, 2));
    console.log(JSON.stringify({ model, passed: row.passed, ms: row.ms, attempts: row.attempts, error: row.error }));
  }
  clearTimeout(timer);
  app.exit(rows.some(row => row.passed) ? 0 : 1);
}).catch(error => { console.error(error.message); clearTimeout(timer); app.exit(1); });
