#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ffmpeg = require('ffmpeg-static');
const input = path.resolve(process.argv[2] || '');
const output = path.resolve(process.argv[3] || '');

if (!process.argv[2] || !process.argv[3] || !fs.existsSync(input)) {
  console.error('Usage: node tools/e2e/contact-sheet.cjs <video.mp4> <contact-sheet.jpg>');
  process.exit(2);
}

fs.mkdirSync(path.dirname(output), { recursive: true });
const probe = spawnSync(ffmpeg, ['-hide_banner', '-i', input], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
const durationMatch = /Duration: (\d+):(\d+):([\d.]+)/.exec(probe.stderr || '');
if (!durationMatch) throw new Error('Không đọc được thời lượng video để lấy khung toàn clip.');
const duration = Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]);
const interval = Math.max(0.1, duration / 16);
const filter = `fps=1/${interval},scale=640:-2,tile=4x4:padding=4:margin=4`;
const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-threads', '2', '-i', input, '-vf', filter, '-frames:v', '1', output], {
  stdio: 'inherit',
  windowsHide: true,
  timeout: 120000,
});
if (result.error) throw result.error;
if (result.status !== 0 || !fs.existsSync(output)) {
  process.exit(result.status || 1);
}
console.log(output);
