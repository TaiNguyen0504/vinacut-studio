const fsp = require('fs/promises');
const path = require('path');
const { BrowserWindow } = require('electron');

// The recorder lays VinaCAD out exactly like a 1920x1080 desktop and renders it offscreen at
// deviceScaleFactor 2, so every captured frame is a true 3840x2160 image of the real UI.
const VIEW_W = 1920;
const VIEW_H = 1080;
const FPS = 60;
const FRAME_SEC = 1 / FPS;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function createRecorderWindow({ deviceScaleFactor = 2 } = {}) {
  const win = new BrowserWindow({
    width: VIEW_W,
    height: VIEW_H,
    show: false,
    webPreferences: {
      offscreen: { deviceScaleFactor },
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.webContents.setFrameRate(FPS);
  win.setContentSize(VIEW_W, VIEW_H);
  // VinaCAD registers beforeunload; it must never block closing the recorder.
  win.webContents.on('will-prevent-unload', (event) => event.preventDefault());
  return win;
}

async function ensureViewport(win) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const size = await win.webContents.executeJavaScript('[innerWidth, innerHeight]').catch(() => null);
    if (size && size[0] === VIEW_W && size[1] === VIEW_H) return true;
    win.setContentSize(VIEW_W, VIEW_H);
    await wait(300);
  }
  return false;
}

// Cursor + click ripple drawn inside the page so they are rendered at 4K with the UI. The engine
// positions them explicitly on every frame (sub-pixel), so motion stays smooth at 60 fps no matter
// how long each frame takes to capture.
const OVERLAY_SCRIPT = `(() => {
  if (window.__vcOverlay && document.getElementById('__vc_overlay')) return true;
  const root = document.createElement('div');
  root.id = '__vc_overlay';
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;overflow:hidden;contain:strict';
  const ripple = document.createElement('div');
  ripple.style.cssText = 'position:absolute;left:0;top:0;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;'
    + 'border:3px solid rgba(56,189,248,0.95);background:rgba(56,189,248,0.16);opacity:0;will-change:transform,opacity';
  const cursor = document.createElement('div');
  cursor.style.cssText = 'position:absolute;left:0;top:0;width:28px;height:36px;margin:-3px 0 0 -3px;will-change:transform;'
    + 'filter:drop-shadow(0 2px 3px rgba(0,0,0,0.55))';
  cursor.innerHTML = '<svg width="28" height="36" viewBox="0 0 28 36"><path d="M3 2.5 L3 28 L9.6 21.8 L14.2 32.4 L18.8 30.4 '
    + 'L14.3 20.2 L23.2 20.2 Z" fill="#ffffff" stroke="#0f172a" stroke-width="2" stroke-linejoin="round"/></svg>';
  root.appendChild(ripple);
  root.appendChild(cursor);
  document.documentElement.appendChild(root);
  window.__vcOverlay = {
    frame(x, y, rippleP, rippleX, rippleY, cursorMode) {
      const el = document.elementFromPoint(Math.round(x), Math.round(y));
      // Over the drawing canvas VinaCAD draws its own crosshair, like the desktop app.
      const hidden = cursorMode === 'hidden' || (cursorMode !== 'arrow' && el && el.tagName === 'CANVAS');
      cursor.style.opacity = hidden ? '0' : '1';
      cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      if (rippleP >= 0 && rippleP <= 1) {
        ripple.style.opacity = String(0.9 * (1 - rippleP));
        ripple.style.transform = 'translate(' + rippleX + 'px,' + rippleY + 'px) scale(' + (0.3 + rippleP * 1.3) + ')';
      } else {
        ripple.style.opacity = '0';
      }
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(1))));
    },
  };
  return true;
})()`;

class FrameRecorder {
  constructor(win, dir) {
    this.win = win;
    this.dir = dir;
    this.framesDir = path.join(dir, 'frames');
    this.frames = [];
    this.time = 0;
    this.latest = null;
    this.paintSeq = 0;
    this.savedSeq = -1;
    this.frameSize = null;
    this.pendingWrites = [];
    this.onPaint = (_event, _dirty, image) => {
      this.latest = image;
      this.paintSeq += 1;
    };
  }

  async start() {
    await fsp.mkdir(this.framesDir, { recursive: true });
    this.win.webContents.on('paint', this.onPaint);
    const seq = this.paintSeq;
    this.win.webContents.invalidate();
    await this.waitForPaint(seq, 3000);
  }

  detach() {
    if (!this.win.isDestroyed()) this.win.webContents.removeListener('paint', this.onPaint);
  }

  async waitForPaint(sinceSeq, timeoutMs) {
    const started = Date.now();
    while (this.paintSeq <= sinceSeq) {
      if (Date.now() - started >= timeoutMs) return false;
      await wait(3);
    }
    return true;
  }

  // Store the latest painted frame for `dur` seconds of video. Unchanged frames only extend the
  // previous frame, so holds and idle moments cost nothing.
  async capture(dur) {
    if (!this.latest) return;
    if (this.savedSeq === this.paintSeq && this.frames.length > 0) {
      this.extend(dur);
      return;
    }
    this.savedSeq = this.paintSeq;
    const image = this.latest;
    if (!this.frameSize) this.frameSize = image.getSize();
    const file = path.join(this.framesDir, `f${String(this.frames.length).padStart(6, '0')}.jpg`);
    const jpg = image.toJPEG(94);
    this.frames.push({ file, dur });
    this.time += dur;
    this.pendingWrites.push(fsp.writeFile(file, jpg));
    if (this.pendingWrites.length >= 24) {
      await Promise.all(this.pendingWrites);
      this.pendingWrites = [];
    }
  }

  async saveCheckpoint(label) {
    const frame = this.frames.at(-1);
    if (!frame) return null;
    await Promise.all(this.pendingWrites);
    const checkpointsDir = path.join(this.dir, 'checkpoints');
    await fsp.mkdir(checkpointsDir, { recursive: true });
    const safe = String(label || 'checkpoint').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'checkpoint';
    const file = path.join(checkpointsDir, `${safe}.jpg`);
    await fsp.copyFile(frame.file, file);
    return file;
  }

  extend(dur) {
    if (!this.frames.length || !(dur > 0)) return;
    this.frames[this.frames.length - 1].dur += dur;
    this.time += dur;
  }

  // Run a page-side frame hook (cursor/ripple update, then rAF) and capture the resulting paint.
  async step(dur, pageExpr) {
    const seq = this.paintSeq;
    await this.win.webContents
      .executeJavaScript(pageExpr || 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))', true)
      .catch(() => {});
    await this.waitForPaint(seq, 40);
    await this.capture(dur);
  }

  async finalize() {
    await Promise.all(this.pendingWrites);
    this.pendingWrites = [];
    const lines = ['ffconcat version 1.0'];
    for (const frame of this.frames) {
      lines.push(`file '${frame.file.replace(/\\/g, '/')}'`);
      lines.push(`duration ${frame.dur.toFixed(6)}`);
    }
    // The concat demuxer ignores the last entry's duration unless the file is repeated.
    if (this.frames.length) lines.push(`file '${this.frames[this.frames.length - 1].file.replace(/\\/g, '/')}'`);
    const listPath = path.join(this.dir, 'frames.ffconcat');
    await fsp.writeFile(listPath, lines.join('\n'), 'utf8');
    return { listPath, duration: this.time, frameCount: this.frames.length, frameSize: this.frameSize };
  }
}

class InputDriver {
  constructor(win, recorder) {
    this.win = win;
    this.wc = win.webContents;
    this.rec = recorder;
    this.x = VIEW_W * 0.55;
    this.y = VIEW_H * 0.5;
    this.bendSign = 1;
    this.cursorMode = 'auto';
  }

  async ensureOverlay() {
    await this.wc.executeJavaScript(OVERLAY_SCRIPT).catch(() => false);
  }

  frameExpr(ripple) {
    const r = ripple || { p: -1, x: 0, y: 0 };
    return `(window.__vcOverlay ? window.__vcOverlay.frame(${this.x.toFixed(2)}, ${this.y.toFixed(2)}, ${r.p.toFixed(3)}, `
      + `${r.x.toFixed(1)}, ${r.y.toFixed(1)}, '${this.cursorMode}') `
      + ': new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(1)))))';
  }

  async frame(dur = FRAME_SEC, ripple) {
    await this.rec.step(dur, this.frameExpr(ripple));
  }

  async hold(seconds) {
    await this.frame();
    this.rec.extend(Math.max(0, seconds - FRAME_SEC));
  }

  async moveTo(x, y, { duration, bend = 1 } = {}) {
    const sx = this.x;
    const sy = this.y;
    const dx = x - sx;
    const dy = y - sy;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) {
      this.x = x;
      this.y = y;
      return;
    }
    const seconds = duration ?? clamp(0.3 + dist / 2600, 0.32, 0.9);
    const steps = Math.max(3, Math.round(seconds * FPS));
    const nx = -dy / dist;
    const ny = dx / dist;
    const arc = Math.min(42, dist * 0.05) * bend * this.bendSign;
    this.bendSign *= -1;
    for (let i = 1; i <= steps; i++) {
      const p = easeInOutCubic(i / steps);
      const off = Math.sin(Math.PI * p) * arc;
      this.x = sx + dx * p + nx * off;
      this.y = sy + dy * p + ny * off;
      this.wc.sendInputEvent({ type: 'mouseMove', x: Math.round(this.x), y: Math.round(this.y) });
      await this.frame();
    }
    this.x = x;
    this.y = y;
  }

  async click({ button = 'left', count = 1 } = {}) {
    const px = Math.round(this.x);
    const py = Math.round(this.y);
    const ripple = (p) => ({ p, x: this.x, y: this.y });
    for (let c = 1; c <= count; c++) {
      this.wc.sendInputEvent({ type: 'mouseDown', button, x: px, y: py, clickCount: c });
      await this.frame(FRAME_SEC, ripple(c === 1 ? 0 : 0.08));
      this.wc.sendInputEvent({ type: 'mouseUp', button, x: px, y: py, clickCount: c });
      await this.frame(FRAME_SEC, ripple(c === 1 ? 0.05 : 0.12));
    }
    const rippleFrames = 20;
    for (let i = 3; i <= rippleFrames; i++) await this.frame(FRAME_SEC, ripple(i / rippleFrames));
    await this.frame();
  }

  async type(text, { cps = 14 } = {}) {
    for (const ch of String(text)) {
      if (/^[A-Za-z0-9]$/.test(ch)) {
        const keyCode = ch.toUpperCase();
        this.wc.sendInputEvent({ type: 'keyDown', keyCode });
        this.wc.sendInputEvent({ type: 'char', keyCode: ch });
        this.wc.sendInputEvent({ type: 'keyUp', keyCode });
      } else if (/^[\x20-\x7e]$/.test(ch)) {
        this.wc.sendInputEvent({ type: 'char', keyCode: ch });
      } else {
        this.wc.insertText(ch);
      }
      const jitter = 0.75 + Math.random() * 0.5;
      await this.frame(Math.max(FRAME_SEC, jitter / cps));
    }
  }

  async press(key, { frames = 6, modifiers } = {}) {
    const keyCode = key === 'Enter' ? 'Return' : key;
    const extra = modifiers ? { modifiers } : {};
    this.wc.sendInputEvent({ type: 'keyDown', keyCode, ...extra });
    this.wc.sendInputEvent({ type: 'keyUp', keyCode, ...extra });
    for (let i = 0; i < frames; i++) await this.frame();
  }

  // One wheel notch at the cursor; positive deltaY reaches the page as a negative DOM deltaY (zoom in).
  async wheelStep(deltaY, { frames = 3 } = {}) {
    this.wc.sendInputEvent({ type: 'mouseWheel', x: Math.round(this.x), y: Math.round(this.y), deltaX: 0, deltaY, canScroll: true });
    for (let i = 0; i < frames; i++) await this.frame();
  }
}

module.exports = {
  VIEW_W,
  VIEW_H,
  FPS,
  FRAME_SEC,
  wait,
  clamp,
  easeInOutCubic,
  createRecorderWindow,
  ensureViewport,
  FrameRecorder,
  InputDriver,
};
