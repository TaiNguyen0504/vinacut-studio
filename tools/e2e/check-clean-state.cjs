// Real UI negative probes for every known dirty state. The test deliberately leaves
// each state open, proves assertCleanState rejects it, then cancels before the next probe.
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');
const { createRecorderWindow, ensureViewport } = require('../../electron/engine/capture.cjs');
const vinacad = require('../../electron/engine/vinacad.cjs');
const { prepareStage, PAGE_HELPERS, assertCleanStateSnapshot } = require('../../electron/engine/actions.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceRoot = path.join(ROOT, 'docs', 'handoff', 'evidence', `cleanstate-${stamp}`);
fs.mkdirSync(evidenceRoot, { recursive: true });
app.setPath('userData', path.join(evidenceRoot, 'user-data'));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const js = (win, code) => win.webContents.executeJavaScript(code, true);
const click = async (win, rect, button = 'left') => {
  if (!rect) throw new Error('Không có rect để click.');
  const x = Math.round(rect.x + (rect.w || 0) / 2);
  const y = Math.round(rect.y + (rect.h || 0) / 2);
  win.webContents.sendInputEvent({ type: 'mouseMove', x, y });
  await wait(120);
  win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button, clickCount: 1 });
  win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button, clickCount: 1 });
  await wait(650);
};
const clickWorld = async (win, point) => click(win, await js(win, `window.__vcq.worldToClient(${point[0]}, ${point[1]})`));
const key = async (win, keyCode) => {
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode });
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode });
  await wait(700);
};
const startCommand = (win, name) => js(win, `window.__inWeb.commandManager.runCommand(${JSON.stringify(name)}, { cancelCommand: true })`);
const state = (win) => js(win, 'window.__vcq.cleanState()');

async function expectDirty(win, id, setup, options = {}) {
  await setup();
  const snapshot = await state(win);
  let rejected = false;
  let error = '';
  try { assertCleanStateSnapshot(snapshot, options); }
  catch (e) { rejected = true; error = e.message; }
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(evidenceRoot, `${id}.jpg`), image.resize({ width: 1280 }).toJPEG(82));
  await key(win, 'ESC');
  await js(win, 'window.__inWeb?.commandManager?.cancelCommand?.()').catch(() => {});
  await key(win, 'ESC');
  return { id, rejected, error, state: snapshot };
}

async function main() {
  const win = createRecorderWindow({ deviceScaleFactor: 1 });
  try {
    await win.loadURL(vinacad.VINACAD_URL);
    await ensureViewport(win);
    await vinacad.waitForEditorReady(win, 70000);
    await vinacad.loadDrawing(win, vinacad.SAMPLE_ID);
    await prepareStage(win, null);
    await js(win, PAGE_HELPERS);
    win.webContents.focus();
    await wait(900);
    const rows = [];
    rows.push(await expectDirty(win, 'pending-window-selection', async () => {
      const empty = await js(win, 'window.__vcq.worldToClient(14500, 6500)');
      await click(win, empty);
    }));
    rows.push(await expectDirty(win, 'view-menu', async () => {
      const control = await js(win, `(() => {
        const norm = (s) => String(s || '').replace(/\\s+/g, ' ').trim().toLowerCase();
        const nodes = Array.from(document.querySelectorAll('[title], [aria-label], button, [role="button"], span, div'));
        const el = nodes.find((node) => {
          const r = node.getBoundingClientRect();
          const text = norm(node.getAttribute('title') || node.getAttribute('aria-label') || node.innerText || node.textContent);
          return r.width > 6 && r.height > 6 && r.width < 400 && (text === 'trên' || text === 'top' || text.includes('view cube'));
        });
        if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height };
      })()`);
      if (control) await click(win, control);
      else await startCommand(win, 'VIEW');
      await wait(500);
    }));
    rows.push(await expectDirty(win, 'right-click-canvas', async () => {
      const canvas = await js(win, 'window.__vcq.canvasRect()');
      await click(win, { x: canvas.x + canvas.w * 0.55, y: canvas.y + canvas.h * 0.55, w: 1, h: 1 }, 'right');
    }));
    rows.push(await expectDirty(win, 'color-picker', async () => {
      const tab = await js(win, "window.__vcq.sidebarTab('Layers')") || await js(win, "window.__vcq.findClickable('Lớp')");
      if (tab) await click(win, tab);
      await js(win, "window.store?.dispatch?.({ type: 'ui/setStructuralElement', payload: 'Layers' })").catch(() => {});
      await wait(450);
      const row = await js(win, "window.__vcq.layerRow('A-WALLS')");
      if (row?.swatch) await click(win, row.swatch);
      else {
        const opened = await js(win, `(() => { const el = Array.from(document.querySelectorAll('button.shrink-0.w-4.h-4')).find((node) => node.getBoundingClientRect().left < 900); if (!el) return false; el.click(); return true; })()`);
        if (!opened) throw new Error('Không tìm thấy swatch layer để mở color picker.');
      }
      await wait(500);
    }));
    rows.push(await expectDirty(win, 'mtext-editor', async () => {
      await startCommand(win, 'MTEXT');
      await clickWorld(win, [4500, 3000]);
      await clickWorld(win, [6000, 3400]);
      await wait(700);
    }, { allowEditor: false }));
    rows.push(await expectDirty(win, 'line-in-progress', async () => {
      await startCommand(win, 'LINE');
      await clickWorld(win, [4500, 3000]);
      await wait(500);
    }));
    const clean = await state(win);
    let cleanError = '';
    try { assertCleanStateSnapshot(clean); }
    catch (e) { cleanError = e.message; }
    const selected = await js(win, 'window.__vcq.worldToClient(4500,0)');
    await click(win, selected);
    const selectedState = await state(win);
    let allowSelectionError = '';
    try { if (!selectedState.selectionCount) throw new Error('Probe chưa chọn được entity nào'); assertCleanStateSnapshot(selectedState, { allowSelection: true }); }
    catch (e) { allowSelectionError = e.message; }
    await key(win, 'ESC');
    const report = { generatedAt: new Date().toISOString(), rows, clean: { passed: !cleanError, error: cleanError, state: clean }, allowSelection: { passed: !allowSelectionError, error: allowSelectionError, state: selectedState } };
    fs.writeFileSync(path.join(evidenceRoot, 'result.json'), JSON.stringify(report, null, 2), 'utf8');
    console.log(JSON.stringify(report, null, 2));
    const failed = rows.filter((row) => !row.rejected);
    if (failed.length || cleanError || allowSelectionError) process.exitCode = 1;
  } finally {
    if (!win.isDestroyed()) win.destroy();

  }
}

const timer = setTimeout(() => app.exit(1), 12 * 60 * 1000);
app.whenReady().then(main).then(() => app.exit(process.exitCode || 0)).finally(() => clearTimeout(timer)).catch((error) => { console.error(error?.stack || error); app.exit(1); });
