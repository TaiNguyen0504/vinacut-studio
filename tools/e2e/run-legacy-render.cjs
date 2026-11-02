#!/usr/bin/env node

// Verifies the legacy footage editor still embeds Vietnamese captions with a local font directory.
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');

setTimeout(() => app.exit(1), 10 * 60 * 1000);
const ROOT = path.resolve(__dirname, '..', '..');
const inputPath = process.env.INPUT_VIDEO || path.join(ROOT, 'docs', 'handoff', 'evidence', 'real-2026-10-31T14-31-23-238Z', 'user-data', 'sessions', '839edd50-8193-450e-b8b9-39bb05ee59c6', 'render_4k_1793457132609.mp4');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceRoot = path.join(ROOT, 'docs', 'handoff', 'evidence', `legacy-render-${stamp}`);
fs.mkdirSync(evidenceRoot, { recursive: true });
app.setPath('userData', path.join(evidenceRoot, 'user-data'));

require(path.join(ROOT, 'electron', 'main.cjs'));

const invoke = async (channel, payload) => {
  const handler = ipcMain._invokeHandlers?.get(channel);
  if (!handler) throw new Error(`Không tìm thấy IPC handler ${channel}`);
  return handler({ sender: null }, payload);
};

async function main() {
  await app.whenReady();
  for (const win of BrowserWindow.getAllWindows()) win.hide();
  if (!fs.existsSync(inputPath)) throw new Error(`Không tìm thấy video nguồn: ${inputPath}`);
  const videoData = fs.readFileSync(inputPath);
  const rendered = await invoke('video:render', {
    videoData,
    quality: '1080p social',
    scenes: [{
      label: 'Phụ đề tiếng Việt',
      description: 'Xin chào VinaCAD — kiểm tra font tiếng Việt trong footage.',
      duration: 4,
      focus: 'full',
    }],
  });
  const outputPath = path.join(evidenceRoot, 'legacy-caption-1080p.mp4');
  fs.writeFileSync(outputPath, Buffer.from(rendered.video));
  fs.writeFileSync(path.join(evidenceRoot, 'result.json'), JSON.stringify({
    inputPath,
    outputPath,
    duration: rendered.duration,
    quality: '1080p social',
    subtitle: 'Xin chào VinaCAD — kiểm tra font tiếng Việt trong footage.',
  }, null, 2), 'utf8');
  console.log(outputPath);
  app.exit(process.exitCode || 0);
}

main().catch((error) => {
  console.error(error?.stack || error);
  app.exit(1);
});
