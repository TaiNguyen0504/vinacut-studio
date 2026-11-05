// Calls the production builder and chat function. The fetch stub never leaves the
// process, so this regression does not spend an API key.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

app.setPath('userData', path.join(require('node:os').tmpdir(), 'vinacut-ai-request-check'));
process.env.VINACUT_NO_MAIN_WINDOW = '1';
const main = require('../../electron/main.cjs');
const schema = { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] };
const rows = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function checkBuilder(provider, options) {
  const request = main.buildAiRequest({ provider, apiKey: 'test-key', system: 'system', prompt: 'prompt', json: true, schema, ...options });
  assert(request.method === 'POST', `${provider}: thiếu POST`);
  assert(request.headers && request.body, `${provider}: thiếu headers/body`);
  if (provider === 'Google') {
    assert(request.url.includes('/models/gemini-test:generateContent'), 'Google: URL model sai');
    assert(request.headers['x-goog-api-key'] === 'test-key', 'Google: header key sai');
    assert(request.body.generationConfig.responseJsonSchema, 'Google: thiếu responseJsonSchema');
  } else if (provider === 'Anthropic') {
    assert(request.url.endsWith('/messages'), 'Anthropic: URL messages sai');
    assert(request.body.tools?.[0]?.input_schema, 'Anthropic: thiếu input_schema');
  } else {
    assert(request.url.endsWith('/chat/completions'), 'OpenAI: URL chat/completions sai');
    assert(request.body.response_format?.json_schema?.schema, 'OpenAI: thiếu json_schema');
    assert(request.body.response_format.json_schema.strict === false, 'OpenAI: schema lỏng không được gửi strict:true');
  }
  return { provider, url: request.url, method: request.method, schemaPresent: true };
}

async function withFakeFetch(sequence, call) {
  const original = global.fetch;
  const calls = [];
  let index = 0;
  global.fetch = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    const item = sequence[Math.min(index++, sequence.length - 1)];
    return { ok: item.status >= 200 && item.status < 300, status: item.status, text: async () => JSON.stringify(item.body) };
  };
  try { return { value: await call(), calls }; }
  finally { global.fetch = original; }
}

async function mainTest() {
  for (const provider of ['Google', 'Anthropic', 'OpenAI']) {
    const body = provider === 'Google' ? { candidates: [{ content: { parts: [{ text: 'OK' }] } }] }
      : provider === 'Anthropic' ? { content: [{ type: 'text', text: 'OK' }] }
        : { choices: [{ message: { content: 'OK' } }] };
    const payload = { provider, apiKey: 'test-key', model: 'test', baseUrl: 'https://fake/v1beta', json: true, schema };
    for (const [status, message, count] of [[400, 'schema invalid', 2], [400, 'invalid api key', 1], [200, '', 1], [500, 'schema service unavailable', 1], [503, 'service busy', 1]]) {
      let caught = '';
      let caughtStatus;
      const result = await withFakeFetch([{ status, body: status === 200 ? body : { error: { message } } }, { status: 200, body }], async () => {
        try { return await main.callAiChatInternal(payload); } catch (e) { caught = e.message; caughtStatus = e.status; }
      });
      assert(result.calls.length === count, `${provider}/${status}/${message}: sai số lần gọi`);
      if (count === 2) {
        const retry = result.calls[1].body;
        assert(!retry.generationConfig?.responseJsonSchema && !retry.response_format && !retry.tools, `${provider}: retry vẫn chứa schema`);
      } else if (status !== 200) {
        assert(caught === message, `${provider}: mất lỗi gốc`);
        assert(caughtStatus === status, `${provider}: mất HTTP status`);
      }
      rows.push({ provider, status, message, calls: count, result: 'PASS' });
    }
  }
  rows.push({ kind: 'builder', result: 'PASS', detail: checkBuilder('Google', { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-test' }) });
  rows.push({ kind: 'builder', result: 'PASS', detail: checkBuilder('OpenAI', { baseUrl: 'https://api.openai.com/v1', model: 'gpt-test' }) });
  rows.push({ kind: 'builder', result: 'PASS', detail: checkBuilder('Anthropic', { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-test' }) });

  const fallback = await withFakeFetch([
    { status: 400, body: { error: { message: 'response_format schema is unsupported' } } },
    { status: 200, body: { choices: [{ message: { content: '{"title":"ok"}' } }] } },
  ], () => main.callAiChatInternal({ provider: 'OpenAI', apiKey: 'test-key', baseUrl: 'https://fake/v1', model: 'gpt-test', system: 's', prompt: 'p', json: true, schema }));
  assert(fallback.calls.length === 2, `fallback schema: cần 2 calls, nhận ${fallback.calls.length}`);
  assert(!fallback.calls[1].body.response_format, 'fallback schema: lần gọi lại vẫn còn response_format');
  rows.push({ kind: 'fallback-schema', result: 'PASS', calls: fallback.calls.length });

  let unrelatedError = false;
  const unrelated = await withFakeFetch([{ status: 400, body: { error: { message: 'invalid api key' } } }], async () => {
    try { await main.callAiChatInternal({ provider: 'OpenAI', apiKey: 'test-key', baseUrl: 'https://fake/v1', model: 'gpt-test', json: true, schema }); }
    catch (error) { unrelatedError = /invalid api key/i.test(error.message); }
  });
  assert(unrelated.calls.length === 1 && unrelatedError, '400 không liên quan phải lỗi ngay, không retry');
  rows.push({ kind: '400-unrelated', result: 'PASS', calls: unrelated.calls.length });

  const success = await withFakeFetch([{ status: 200, body: { choices: [{ message: { content: 'OK' } }] } }], () => main.callAiChatInternal({ provider: 'OpenAI', apiKey: 'test-key', baseUrl: 'https://fake/v1', model: 'gpt-test', prompt: 'ping' }));
  assert(success.calls.length === 1 && success.value === 'OK', '200 phải chỉ gọi một lần và trả text');
  rows.push({ kind: '200-success', result: 'PASS', calls: success.calls.length });

  // Reasoning effort checks across Google, Anthropic, OpenAI, Custom + HTTP 400 fallback
  const googleEffort = main.buildAiRequest({ provider: 'Google', apiKey: 'test-key', model: 'gemini-3.8-flash', effort: 'high', prompt: 'p' });
  assert(googleEffort.body.generationConfig?.thinkingConfig?.thinkingLevel === 'high', 'Google Gemini 3+: thiếu thinkingLevel=high');
  const google25Effort = main.buildAiRequest({ provider: 'Google', apiKey: 'test-key', model: 'gemini-2.5-pro', effort: 'medium', prompt: 'p' });
  assert(google25Effort.body.generationConfig?.thinkingConfig?.thinkingBudget === 4096, 'Google Gemini 2.5: thiếu thinkingBudget=4096');
  const anthropicEffort = main.buildAiRequest({ provider: 'Anthropic', apiKey: 'test-key', model: 'claude-opus-5-5', effort: 'high', prompt: 'p', json: true, schema });
  assert(anthropicEffort.body.thinking?.type === 'enabled' && anthropicEffort.body.thinking?.budget_tokens === 10000, 'Anthropic: thiếu thinking budget_tokens=10000');
  assert(anthropicEffort.body.tool_choice?.type === 'auto', 'Anthropic: khi bật thinking phải dùng tool_choice auto để tránh lỗi 400');
  const openAiEffort = main.buildAiRequest({ provider: 'OpenAI', apiKey: 'test-key', model: 'gpt-6-astra', effort: 'max', prompt: 'p' });
  assert(openAiEffort.body.reasoning_effort === 'xhigh' && openAiEffort.body.temperature === undefined, 'OpenAI GPT-6 max: thiếu reasoning_effort=xhigh');
  const customEffort = main.buildAiRequest({ provider: 'Custom', apiKey: 'test-key', baseUrl: 'https://api.kingofapi.store/v1', model: 'claude-opus-5-5', effort: 'high', prompt: 'p' });
  assert(customEffort.body.reasoning_effort === 'high' && customEffort.body.temperature === undefined, 'Custom: thiếu reasoning_effort=high');
  rows.push({ kind: 'builder-effort', result: 'PASS' });

  const googleThoughtFilter = await withFakeFetch([{
    status: 200,
    body: { candidates: [{ content: { parts: [{ thought: true, text: 'suy nghĩ nội bộ...' }, { text: '{"title":"clean"}' }] } }] },
  }], () => main.callAiChatInternal({ provider: 'Google', apiKey: 'test-key', model: 'gemini-4-argon', effort: 'high', prompt: 'p' }));
  assert(googleThoughtFilter.value === '{"title":"clean"}', `Google thought filter sai: ${googleThoughtFilter.value}`);
  rows.push({ kind: 'google-thought-filter', result: 'PASS' });

  const effortFallback = await withFakeFetch([
    { status: 400, body: { error: { message: 'Unrecognized request argument supplied: reasoning_effort' } } },
    { status: 200, body: { choices: [{ message: { content: 'OK-NO-EFFORT' } }] } },
  ], () => main.callAiChatInternal({ provider: 'Custom', apiKey: 'test-key', baseUrl: 'https://fake/v1', model: 'legacy-chat', effort: 'high', prompt: 'ping' }));
  assert(effortFallback.calls.length === 2 && effortFallback.calls[1].body.reasoning_effort === undefined && effortFallback.value === 'OK-NO-EFFORT', 'Fallback effort 400 thất bại');
  rows.push({ kind: 'fallback-effort', result: 'PASS', calls: effortFallback.calls.length });
}

const timer = setTimeout(() => app.exit(1), 90000);
app.whenReady().then(async () => {
  try {
    await mainTest();
    const output = { generatedAt: new Date().toISOString(), rows };
    const file = path.join(process.cwd(), 'docs', 'handoff', 'evidence', 'ai-request-check.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(output, null, 2), 'utf8');
    console.log(JSON.stringify(output, null, 2));
    clearTimeout(timer);
    for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) win.destroy();
    app.quit();
  } catch (error) {
    console.error(error?.stack || error);
    clearTimeout(timer);
    app.exit(1);
  }
});
