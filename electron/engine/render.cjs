const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const VIEW_W = 1920;
const VIEW_H = 1080;
const FULL = { x: 0, y: 0, w: VIEW_W, h: VIEW_H };

// Camera presets in layout pixels (1920x1080), kept for manual "Góc máy" overrides.
const FOCUS_PRESETS = {
  full: FULL,
  left: { x: 0, y: 36, w: 1040, h: 585 },
  center: { x: 300, y: 130, w: 1320, h: 742.5 },
  right: { x: 600, y: 110, w: 1320, h: 742.5 },
};

const OUTPUTS = {
  '4K master': { id: '4k', width: 3840, height: 2160, vertical: false },
  '1080p social': { id: '1080p', width: 1920, height: 1080, vertical: false },
  'Vertical cut': { id: 'vertical', width: 1080, height: 1920, vertical: true },
};

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const sameRect = (a, b) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;

function runQuiet(ffmpegPath, args) {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}

let cachedEncoder = null;

async function detectEncoder(ffmpegPath) {
  if (cachedEncoder) return cachedEncoder;
  const candidates = [
    { name: 'h264_nvenc', pixFmt: 'yuv420p', args: ['-c:v', 'h264_nvenc', '-preset', 'p6', '-tune', 'hq', '-rc', 'vbr', '-cq', '20', '-b:v', '0', '-maxrate', '50M', '-bufsize', '100M', '-profile:v', 'high'] },
    { name: 'h264_qsv', pixFmt: 'nv12', args: ['-c:v', 'h264_qsv', '-preset', 'slower', '-global_quality', '23', '-profile:v', 'high'] },
    { name: 'h264_amf', pixFmt: 'nv12', args: ['-c:v', 'h264_amf', '-quality', 'quality', '-rc', 'cqp', '-qp_i', '22', '-qp_p', '24', '-profile:v', 'high'] },
  ];
  for (const candidate of candidates) {
    const ok = await runQuiet(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=3840x2160:r=60:d=0.2',
      '-frames:v', '4', ...candidate.args, '-pix_fmt', candidate.pixFmt, '-f', 'null', '-',
    ]);
    if (ok) {
      cachedEncoder = candidate;
      return candidate;
    }
  }
  cachedEncoder = { name: 'libx264', pixFmt: 'yuv420p', args: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-profile:v', 'high'] };
  return cachedEncoder;
}

function libx264Encoder() {
  return { name: 'libx264', pixFmt: 'yuv420p', args: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-profile:v', 'high'] };
}

async function runWithEncoderFallback(primary, fallback, run) {
  try { return await run(primary); }
  catch (error) {
    if (!primary || primary.name === 'libx264') throw error;
    return run(fallback || libx264Encoder());
  }
}

// Frame the union of a scene's interaction targets with breathing room, as a 16:9 window.
function frameTargets(targets, { maxZoom = 1.9, pad = 0.2 } = {}) {
  const valid = (targets || []).filter((t) => t && Number.isFinite(t.x) && Number.isFinite(t.y));
  if (!valid.length) return FULL;
  let x0 = Math.min(...valid.map((t) => t.x));
  let y0 = Math.min(...valid.map((t) => t.y));
  let x1 = Math.max(...valid.map((t) => t.x + (t.w || 0)));
  let y1 = Math.max(...valid.map((t) => t.y + (t.h || 0)));
  const padPx = Math.max(70, Math.max(x1 - x0, y1 - y0) * pad);
  x0 -= padPx;
  y0 -= padPx;
  x1 += padPx;
  y1 += padPx;
  let w = x1 - x0;
  let h = y1 - y0;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  w = Math.max(w, VIEW_W / maxZoom);
  h = Math.max(h, VIEW_H / maxZoom);
  if (w / h > 16 / 9) h = w / (16 / 9);
  else w = h * (16 / 9);
  if (w >= VIEW_W * 0.8) return FULL;
  return {
    x: clamp(cx - w / 2, 0, VIEW_W - w),
    y: clamp(cy - h / 2, 0, VIEW_H - h),
    w,
    h,
  };
}

const zoomOf = (rect) => VIEW_W / rect.w;
const capOf = (group) => Math.min(...group.map((t) => Number(t.zoom) || 1.9));

// Auto camera: consecutive targets that fit one comfortable frame form a shot; when the next
// target would force the camera to zoom far out, a new shot starts just before that action.
function shotsForScene(scene) {
  const targets = (scene.targets || [])
    .filter((t) => t && Number.isFinite(t.x) && Number.isFinite(t.y))
    .sort((a, b) => (a.t || 0) - (b.t || 0));
  if (!targets.length) return [{ t: Number(scene.start) || 0, rect: FULL }];
  const shots = [];
  let group = [];
  for (const target of targets) {
    if (group.length) {
      const current = frameTargets(group, { maxZoom: capOf(group) });
      const merged = frameTargets([...group, target], { maxZoom: capOf([...group, target]) });
      if (zoomOf(current) >= 1.15 && zoomOf(merged) < 1.15) {
        shots.push({ t: group[0].t, rect: current });
        group = [];
      }
    }
    group.push(target);
  }
  shots.push({ t: group[0].t, rect: frameTargets(group, { maxZoom: capOf(group) }) });
  return shots;
}

function buildCameraKeys(timeline, sceneOverrides = []) {
  const keys = [{ t: 0, d: 0, rect: FULL }];
  const scenes = timeline.scenes || [];
  scenes.forEach((scene, index) => {
    const override = sceneOverrides[index] || {};
    const focus = String(override.focus || scene.focus || 'auto').toLowerCase();
    const shots = FOCUS_PRESETS[focus]
      ? [{ t: (Number(scene.start) || 0) + 0.5, rect: FOCUS_PRESETS[focus] }]
      : shotsForScene(scene);
    for (const shot of shots) {
      const last = keys[keys.length - 1];
      if (sameRect(last.rect, shot.rect)) continue;
      const t = Math.max(last.t + last.d, (Number(shot.t) || 0) - 0.5);
      keys.push({ t, d: 0.8, rect: shot.rect });
    }
  });
  const last = keys[keys.length - 1];
  const end = Number(timeline.duration) || 0;
  if (!sameRect(last.rect, FULL) && end > last.t + last.d + 1.4) {
    keys.push({ t: end - 1.3, d: 0.95, rect: FULL });
  }
  return keys;
}

// For 9:16 output, cut a vertical window out of each 16:9 camera rect around its centre.
function verticalKeys(keys) {
  return keys.map((key) => {
    const r = key.rect;
    const h = r.h;
    const w = h * (9 / 16);
    const cx = r.x + r.w / 2;
    return { ...key, rect: { x: clamp(cx - w / 2, 0, VIEW_W - w), y: r.y, w, h } };
  });
}

const easeExpr = (p) => `if(lt(${p},0.5),4*pow(${p},3),1-pow(-2*${p}+2,3)/2)`;

function trackExpr(keys, comp, scale, fps, frameOffset = 0) {
  const tv = `((on+${frameOffset})/${fps})`;
  let expr = (keys[0].rect[comp] * scale).toFixed(3);
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1].rect[comp] * scale;
    const b = keys[i].rect[comp] * scale;
    if (Math.abs(b - a) < 0.01) continue;
    const k = keys[i];
    const p = `clip((${tv}-${k.t.toFixed(4)})/${Math.max(0.05, k.d).toFixed(4)},0,1)`;
    expr = `if(lt(${tv},${k.t.toFixed(4)}),${expr},${a.toFixed(3)}+(${(b - a).toFixed(3)})*${easeExpr(p)})`;
  }
  return expr;
}

function perspectiveFilter(keys, scale, fps, frameOffset = 0) {
  const X = trackExpr(keys, 'x', scale, fps, frameOffset);
  const Y = trackExpr(keys, 'y', scale, fps, frameOffset);
  const W = trackExpr(keys, 'w', scale, fps, frameOffset);
  const H = trackExpr(keys, 'h', scale, fps, frameOffset);
  return `perspective=x0='${X}':y0='${Y}':x1='${X}+${W}':y1='${Y}':x2='${X}':y2='${Y}+${H}':x3='${X}+${W}':y3='${Y}+${H}'`
    + ':sense=source:interpolation=linear:eval=frame';
}

function assTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s - h * 3600 - m * 60;
  return `${h}:${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`;
}

function assText(text) {
  return String(text || '').replace(/[{}]/g, '').replace(/\r?\n/g, '\\N').trim();
}

// `from`/`to` limit the events to one render chunk; times are shifted so the chunk starts at 0.
// A caption cut by a chunk boundary keeps its fade only on the side that is really its edge.
function buildAss(scenes, sceneOverrides, spec, { from = 0, to = Infinity } = {}) {
  const { width, height, vertical } = spec;
  const fontSize = vertical ? Math.round(width * 0.05) : Math.round(height * 0.031);
  const pad = Math.round(fontSize * 0.45);
  const marginV = vertical ? Math.round(height * 0.13) : Math.round(height * 0.06);
  const marginLR = Math.round(width * (vertical ? 0.08 : 0.17));
  const events = scenes
    .map((scene, index) => {
      const override = sceneOverrides[index] || {};
      const text = assText(override.description !== undefined ? override.description : scene.description);
      if (!text) return '';
      const start = Number(scene.start) + 0.15;
      const end = Math.max(start + 0.6, Number(scene.end) - 0.1);
      if (end <= from || start >= to) return '';
      const fadeIn = start >= from ? 220 : 0;
      const fadeOut = end <= to ? 220 : 0;
      const localStart = Math.max(start, from) - from;
      const localEnd = Math.min(end, to) - from;
      return `Dialogue: 0,${assTime(localStart)},${assTime(localEnd)},Caption,,0,0,0,,{\\fad(${fadeIn},${fadeOut})}${text}`;
    })
    .filter(Boolean);
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.709',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Caption,Segoe UI,${fontSize},&H00FFFFFF,&H000000FF,&H3022170F,&H00000000,-1,0,0,0,100,100,0,0,3,${pad},0,2,${marginLR},${marginLR},${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events,
    '',
  ].join('\n');
}

// libass needs real font files; copy the Windows UI fonts next to the render so no path escaping is needed.
async function prepareFonts(sessionDir) {
  const fontsDir = path.join(sessionDir, 'fonts');
  await fsp.mkdir(fontsDir, { recursive: true });
  const winFonts = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');
  for (const name of ['segoeui.ttf', 'segoeuib.ttf', 'segoeuisl.ttf', 'arial.ttf', 'arialbd.ttf']) {
    const src = path.join(winFonts, name);
    const dest = path.join(fontsDir, name);
    if (fs.existsSync(src) && !fs.existsSync(dest)) await fsp.copyFile(src, dest).catch(() => {});
  }
  return 'fonts';
}

function runFfmpeg(ffmpegPath, args, { cwd, signal, onTime }) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { cwd, windowsHide: true });
    let stderr = '';
    let buffer = '';
    const onAbort = () => proc.kill();
    process.once('exit', onAbort);
    signal?.addEventListener('abort', onAbort, { once: true });
    proc.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        const match = line.match(/^out_time_(?:us|ms)=(\d+)/);
        if (match && onTime) onTime(Number(match[1]) / 1e6);
      }
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      process.removeListener('exit', onAbort);
      signal?.removeEventListener('abort', onAbort);
      if (signal?.aborted) reject(new Error('Đã dừng dựng video.'));
      else if (code === 0) resolve();
      else reject(new Error(`FFmpeg dựng video lỗi (${code}): ${stderr.slice(-600)}`));
    });
  });
}

// JPEG frames are BT.601; convert only the matrix (primaries/transfer are already sRGB ≈ BT.709).
const COLOR_FIX = 'colorspace=ispace=bt470bg:space=bt709:iprimaries=bt709:primaries=bt709:itrc=bt709:trc=bt709:irange=tv:range=tv:fast=1';

function computeThreadBudget(parallel, encoderName) {
  const cpuCount = Math.max(2, (os.cpus() || []).length);
  const totalGb = os.totalmem() / (1024 ** 3);
  const freeGb = os.freemem() / (1024 ** 3);
  const memoryScale = totalGb < 12 ? 0.5 : (freeGb < 0.35 ? 0.65 : 1);
  const perWorker = Math.max(2, Math.floor((cpuCount / Math.max(1, parallel)) * memoryScale));
  const isSoftware = encoderName === 'libx264';
  return {
    decodeThreads: String(clamp(perWorker, 4, 12)),
    filterThreads: String(clamp(Math.ceil(perWorker * 0.85), 4, 10)),
    encodeThreads: String(clamp(perWorker, 4, isSoftware ? 6 : 12)),
  };
}

// The camera warp is mostly single-threaded per frame, so the timeline is split into chunks that
// render in parallel processes and are then joined without re-encoding.
async function renderVideo({ ffmpegPath, sessionDir, timeline, sceneOverrides = [], quality = '4K master', outputPath, onProgress, signal, encoderOverride = null }) {
  if (!ffmpegPath) throw new Error('Không tìm thấy FFmpeg để dựng video.');
  const spec = OUTPUTS[quality] || OUTPUTS['4K master'];
  const fps = timeline.fps || 60;
  const frameW = timeline.frameSize?.width || VIEW_W * 2;
  const frameH = timeline.frameSize?.height || VIEW_H * 2;
  const scale = frameW / VIEW_W;
  if (!fs.existsSync(path.join(sessionDir, 'frames.ffconcat'))) throw new Error('Không còn dữ liệu bản quay để dựng lại. Hãy quay lại video.');

  let keys = buildCameraKeys(timeline, sceneOverrides);
  if (spec.vertical) keys = verticalKeys(keys);
  const fontsDir = await prepareFonts(sessionDir);
  const encoder = encoderOverride || await detectEncoder(ffmpegPath);
  const finalOut = outputPath || path.join(sessionDir, `render_${spec.id}.mp4`);

  const duration = Number(timeline.duration) || 1;
  const totalFrames = Math.max(1, Math.round(duration * fps));
  const maxParallel = encoder.name === 'libx264' ? 2 : 3;
  const parallel = Math.max(1, Math.min(maxParallel, Math.floor(os.cpus().length / 6), Math.floor(totalFrames / (fps * 4))));
  const threadBudget = computeThreadBudget(parallel, encoder.name);
  const bounds = Array.from({ length: parallel + 1 }, (_, k) => Math.round((totalFrames * k) / parallel));
  const chunkTimes = new Array(parallel).fill(0);
  const report = () => onProgress?.(clamp(chunkTimes.reduce((a, b) => a + b, 0) / duration, 0, 0.99));
  const tag = `${spec.id}_${Date.now()}`;
  const temps = [];

  const renderChunk = async (k) => {
    const startFrame = bounds[k];
    const endFrame = bounds[k + 1];
    const from = startFrame / fps;
    const assName = `captions_${tag}_${k}.ass`;
    const graphName = `graph_${tag}_${k}.txt`;
    const chunkName = parallel === 1 ? null : `chunk_${tag}_${k}.mp4`;
    temps.push(assName, graphName);
    if (chunkName) temps.push(chunkName);
    await fsp.writeFile(path.join(sessionDir, assName), buildAss(timeline.scenes || [], sceneOverrides, spec, { from, to: endFrame / fps }), 'utf8');
    const chain = [
      `fps=${fps}`,
      `trim=start_frame=${startFrame}:end_frame=${endFrame}`,
      'setpts=PTS-STARTPTS',
      'format=yuv420p',
      perspectiveFilter(keys, scale, fps, startFrame),
    ];
    if (spec.width !== frameW || spec.height !== frameH) chain.push(`scale=${spec.width}:${spec.height}:flags=lanczos`);
    chain.push(COLOR_FIX, `ass=filename=${assName}:fontsdir=${fontsDir}`);
    await fsp.writeFile(path.join(sessionDir, graphName), `[0:v]${chain.join(',')}[v]`, 'utf8');
    const args = [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-threads', threadBudget.decodeThreads, '-filter_complex_threads', threadBudget.filterThreads,
      '-f', 'concat', '-safe', '0', '-i', 'frames.ffconcat',
      '-filter_complex_script', graphName,
      '-map', '[v]', '-r', String(fps),
      ...encoder.args,
      '-threads', threadBudget.encodeThreads,
      '-pix_fmt', encoder.pixFmt,
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      ...(chunkName ? [] : ['-movflags', '+faststart']),
      '-progress', 'pipe:1', '-nostats',
      chunkName || finalOut,
    ];
    await runFfmpeg(ffmpegPath, args, {
      cwd: sessionDir,
      signal,
      onTime: (t) => {
        chunkTimes[k] = Math.min(t, (endFrame - startFrame) / fps);
        report();
      },
    });
  };

  let fallbackError = null;
  try {
    const settled = await Promise.allSettled(bounds.slice(0, -1).map((_, k) => renderChunk(k)));
    if (signal?.aborted) throw new Error('Đã dừng dựng video.');
    // A GPU encoder may refuse concurrent sessions; retry those chunks one at a time.
    for (let k = 0; k < settled.length; k++) {
      if (settled[k].status === 'rejected') await renderChunk(k);
    }
    if (parallel > 1) {
      const listName = `chunks_${tag}.txt`;
      temps.push(listName);
      const list = bounds.slice(0, -1).map((_, k) => `file 'chunk_${tag}_${k}.mp4'`).join('\n');
      await fsp.writeFile(path.join(sessionDir, listName), list, 'utf8');
      await runFfmpeg(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listName,
        '-c', 'copy', '-movflags', '+faststart', finalOut], { cwd: sessionDir, signal });
    }
    onProgress?.(1);
  } catch (error) {
    await fsp.rm(finalOut, { force: true }).catch(() => {});
    if (encoder.name !== 'libx264' && !signal?.aborted) fallbackError = error;
    else throw error;
  } finally {
    for (const name of temps) await fsp.rm(path.join(sessionDir, name), { force: true }).catch(() => {});
  }

  if (fallbackError) {
    onProgress?.(0);
    return renderVideo({ ffmpegPath, sessionDir, timeline, sceneOverrides, quality, outputPath, onProgress, signal, encoderOverride: libx264Encoder() });
  }

  return { path: finalOut, duration, encoder: encoder.name, width: spec.width, height: spec.height };
}

module.exports = {
  FOCUS_PRESETS,
  OUTPUTS,
  frameTargets,
  buildCameraKeys,
  buildAss,
  detectEncoder,
  libx264Encoder,
  runWithEncoderFallback,
  renderVideo,
};
