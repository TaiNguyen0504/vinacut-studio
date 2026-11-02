#!/usr/bin/env node

// Smoke test for the user-facing manual capture path. It uses the verified Chromium
// surface pipe; the separate gdigrab probe is retained as evidence for the scale check.
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');

setTimeout(() => app.exit(1), 10 * 60 * 1000);
const ROOT = path.resolve(__dirname, '..', '..');
const drawingPath = process.env.DWG_PATH || 'C:\\Users\\taing\\Downloads\\260629_model-demo-t-corner.dwg';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceRoot = path.join(ROOT, 'docs', 'handoff', 'evidence', `manual-capture-${stamp}`);
const userData = path.join(evidenceRoot, 'user-data');
fs.mkdirSync(evidenceRoot, { recursive: true });
app.setPath('userData', userData);

require(path.join(ROOT, 'electron', 'main.cjs'));

const invoke = async (channel, payload) => {
  const handler = ipcMain._invokeHandlers?.get(channel);
  if (!handler) throw new Error(`Không tìm thấy IPC handler ${channel}`);
  return handler({ sender: null }, payload);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  await app.whenReady();
  for (const win of BrowserWindow.getAllWindows()) win.hide();
  const started = await invoke('capture:vinacad-start', { dwgPath: drawingPath });
  await sleep(2500);
  const data = await invoke('capture:vinacad-stop');
  if (!data || data.byteLength < 1024) throw new Error('Manual capture không trả về video hợp lệ.');
  const outputPath = path.join(evidenceRoot, 'manual-gdigrab.mp4');
  fs.writeFileSync(outputPath, Buffer.from(data));
  fs.writeFileSync(path.join(evidenceRoot, 'result.json'), JSON.stringify({
    drawingPath,
    started,
    outputPath,
    bytes: data.byteLength,
    capture: 'Chromium capturePage image2pipe, 30fps',
  }, null, 2), 'utf8');
  console.log(outputPath);
  app.exit(process.exitCode || 0);
}

main().catch((error) => {
  console.error(error?.stack || error);
  app.exit(1);
});
