const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');
const { createRecorderWindow, ensureViewport } = require('../../electron/engine/capture.cjs');
const vinacad = require('../../electron/engine/vinacad.cjs');
const { prepareStage, PAGE_HELPERS } = require('../../electron/engine/actions.cjs');
setTimeout(() => app.exit(1), 10 * 60 * 1000);
app.setPath('userData', path.join(require('node:os').tmpdir(), 'vinacut-sample-geometry'));
app.whenReady().then(async () => {
  const win = createRecorderWindow({ deviceScaleFactor: 1 });
  try {
    await win.loadURL(vinacad.VINACAD_URL); await ensureViewport(win); await vinacad.waitForEditorReady(win, 70000); await vinacad.loadDrawing(win, vinacad.SAMPLE_ID); await prepareStage(win, null); await win.webContents.executeJavaScript(PAGE_HELPERS, true);
    const data = await win.webContents.executeJavaScript('window.__vcq.entitySnapshot()', true);
    fs.writeFileSync(path.join(process.cwd(), 'docs/handoff/review-r3-sample-geometry.json'), JSON.stringify(data, null, 2));
    console.log(JSON.stringify(data, null, 2));
  } catch (error) { console.error(error?.stack || error); process.exitCode = 1; }
  if (!win.isDestroyed()) win.destroy(); app.exit(process.exitCode || 0);
});
