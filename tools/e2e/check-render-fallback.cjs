const { libx264Encoder, runWithEncoderFallback } = require('../../electron/engine/render.cjs');

(async () => {
  const calls = [];
  const result = await runWithEncoderFallback(
    { name: 'h264_nvenc' },
    libx264Encoder(),
    async (encoder) => {
      calls.push(encoder.name);
      if (encoder.name !== 'libx264') throw new Error('forced hardware encoder failure');
      return { encoder: encoder.name, wholeVideoRetry: true };
    },
  );
  if (calls.join(',') !== 'h264_nvenc,libx264' || result.encoder !== 'libx264' || !result.wholeVideoRetry) {
    throw new Error(`Fallback không chạy lại toàn bộ bằng libx264: ${JSON.stringify({ calls, result })}`);
  }
  let libx264Calls = 0;
  try {
    await runWithEncoderFallback(libx264Encoder(), libx264Encoder(), async () => { libx264Calls += 1; throw new Error('libx264 failed'); });
    throw new Error('libx264 lỗi nhưng lại được nuốt');
  } catch (error) {
    if (!/libx264 failed/.test(error.message) || libx264Calls !== 1) throw error;
  }
  console.log(JSON.stringify({ result: 'PASS', calls, libx264Calls, fallback: libx264Encoder() }, null, 2));
})().catch((error) => { console.error(error?.stack || error); process.exitCode = 1; });
