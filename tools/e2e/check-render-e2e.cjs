const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ffmpegPath = require('ffmpeg-static');
const { renderVideo, detectEncoder, libx264Encoder } = require('../../electron/engine/render.cjs');
const root = path.resolve('docs/handoff/evidence/encoder-r3');
fs.mkdirSync(root, { recursive: true });
const source = path.resolve('docs/handoff/evidence/actions-2026-10-31T19-37-26-687Z/frames-text-vietnamese/final.jpg');
fs.copyFileSync(source, path.join(root, 'frame.jpg'));
fs.writeFileSync(path.join(root, 'frames.ffconcat'), "ffconcat version 1.0\nfile 'frame.jpg'\nduration 8\nfile 'frame.jpg'\n");
const timeline = { fps: 60, duration: 8, frameSize: { width: 3840, height: 2160 }, scenes: [
  { label: 'Test 1', description: 'Kiểm tra chữ tiếng Việt và nét CAD.', focus: 'full', start: 0, end: 4, targets: [] },
  { label: 'Test 2', description: 'Kiểm tra cả đoạn thứ hai sau fallback.', focus: 'full', start: 4, end: 8, targets: [] },
] };
const totalTimer = setTimeout(() => process.exit(1), 20 * 60 * 1000);
const run = async (name, encoderOverride) => {
  const started = Date.now();
  const result = await renderVideo({ ffmpegPath, sessionDir: root, timeline, quality: '4K master', outputPath: path.join(root, `${name}.mp4`), encoderOverride });
  return { ...result, ms: Date.now() - started, bytes: fs.statSync(result.path).size };
};
(async () => {
  const rows = [];
  rows.push(await run('hardware', await detectEncoder(ffmpegPath)));
  rows.push(await run('x264', libx264Encoder()));
  rows.push(await run('qsv', { name: 'h264_qsv', pixFmt: 'nv12', args: ['-c:v', 'h264_qsv', '-preset', 'slower', '-global_quality', '23', '-profile:v', 'high'] }));
  const fallback = await run('forced-fallback', { name: 'h264_nvenc', pixFmt: 'yuv420p', args: ['-c:v', 'h264_nvenc', '-preset', 'INVALID_FORCE_FAILURE'] });
  if (fallback.encoder !== 'libx264') throw new Error('Không fallback toàn video sang x264');
  for (const row of rows) {
    const compare = spawnSync(ffmpegPath, ['-hide_banner', '-threads', '2', '-filter_complex_threads', '2', '-i', row.path, '-i', rows[1].path, '-lavfi', 'ssim', '-f', 'null', '-'], { encoding: 'utf8', windowsHide: true, timeout: 120000 });
    row.ssimAgainstX264 = /All:([0-9.]+)/.exec(compare.stderr)?.[1] || null;
    if (compare.error || compare.status !== 0 || !row.ssimAgainstX264) throw new Error(`Không đo được SSIM cho ${row.encoder}.`);
  }
  for (const row of [...rows, fallback]) {
    const probe = spawnSync(ffmpegPath, ['-hide_banner', '-i', row.path], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
    const duration = /Duration: (\d+):(\d+):([\d.]+)/.exec(probe.stderr || '');
    row.probedDuration = duration ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]) : null;
    row.probed4k60 = /3840x2160/.test(probe.stderr || '') && /60 fps/.test(probe.stderr || '');
    if (!row.probed4k60 || row.probedDuration === null || Math.abs(row.probedDuration - 8) > 0.1) throw new Error(`Video ${row.encoder} không đủ 8 giây 4K/60fps.`);
  }
  fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify({ rows, fallback, note: 'Cùng một khung CAD 4K có MTEXT, 8 giây/60fps; SSIM so với bản x264, không đại diện mọi chuyển động.' }, null, 2));
  console.log(JSON.stringify({ rows, fallback }, null, 2));
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => clearTimeout(totalTimer));
