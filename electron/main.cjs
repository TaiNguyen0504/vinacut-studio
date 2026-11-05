const { app, BrowserWindow, shell, ipcMain, dialog, desktopCapturer, session, protocol } = require('electron');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { spawn } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');
const director = require('./engine/director.cjs');
const planner = require('./engine/planner.cjs');
const vinacadEngine = require('./engine/vinacad.cjs');
const os = require('os');
const smokeTestArg = process.argv.find((arg) => arg === '--smoke-test' || arg.startsWith('--smoke-test='));
const isSmokeTest = Boolean(smokeTestArg);
const smokeTestOutPath = smokeTestArg && smokeTestArg.includes('=')
  ? path.resolve(smokeTestArg.slice(smokeTestArg.indexOf('=') + 1))
  : path.resolve(process.cwd(), 'docs', 'handoff', 'evidence', 'smoke-test.json');
const smokeUserDataDir = isSmokeTest ? path.join(os.tmpdir(), `vinacut-smoke-${Date.now()}`) : null;
if (smokeUserDataDir) {
  fsSync.mkdirSync(smokeUserDataDir, { recursive: true });
  app.setPath('userData', smokeUserDataDir);
}

// Rendered 4K masters are streamed from disk into the preview instead of crossing IPC as bytes.
protocol.registerSchemesAsPrivileged([
  { scheme: 'vinacut-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

const isDev = !app.isPackaged;
let mainWindow = null;
let nativeCaptureProcess = null;
let nativeCaptureOutput = null;
let backgroundFrameTimer = null;
let backgroundCaptureActive = false;
let vinacadWindow = null;
let currentLoadedDwgPath = '';
let agentAbortController = null;

const VINACAD_URL = 'https://web.vina-cad.com/vi';
const VINACAD_RECORDER_TITLE = 'VinaCAD Recorder';

function getFfmpegPath() {
  if (!app.isPackaged) return ffmpegStatic;
  return path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
}

function normalizeGoogleBaseUrl(rawBaseUrl) {
  let normalized = String(rawBaseUrl || 'https://generativelanguage.googleapis.com/v1beta').trim().replace(/\/+$/, '');
  normalized = normalized
    .replace(/\/models\/[^/]+:generateContent$/i, '')
    .replace(/:generateContent$/i, '')
    .replace(/\/interactions$/i, '')
    .replace(/\/models$/i, '');
  if (!/\/v1$/i.test(normalized) && !/\/v1beta$/i.test(normalized) && !/\/v1alpha$/i.test(normalized)) {
    normalized = `${normalized}/v1beta`;
  }
  return normalized;
}

function normalizeAnthropicBaseUrl(rawBaseUrl) {
  let normalized = String(rawBaseUrl || 'https://api.anthropic.com/v1').trim().replace(/\/+$/, '');
  normalized = normalized
    .replace(/\/v1\/messages$/i, '/v1')
    .replace(/\/messages$/i, '')
    .replace(/\/v1\/models$/i, '/v1')
    .replace(/\/models$/i, '');
  try {
    const u = new URL(normalized);
    if (!u.pathname || u.pathname === '/') {
      normalized = `${normalized}/v1`;
    }
  } catch {
    if (!/\/v\d/i.test(normalized)) normalized = `${normalized}/v1`;
  }
  return normalized;
}

function normalizeOpenAiBaseUrl(rawBaseUrl, defaultBase = 'https://api.openai.com/v1') {
  let normalized = String(rawBaseUrl || defaultBase).trim().replace(/\/+$/, '');
  normalized = normalized
    .replace(/\/v1\/chat\/completions$/i, '/v1')
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/v1\/models$/i, '/v1')
    .replace(/\/models$/i, '');
  try {
    const u = new URL(normalized);
    if (!u.pathname || u.pathname === '/') {
      normalized = `${normalized}/v1`;
    }
  } catch {
    if (!/\/v\d/i.test(normalized)) normalized = `${normalized}/v1`;
  }
  return normalized;
}

function summarizeApiError(rawMessage, status, endpoint = '') {
  const text = String(rawMessage || '').trim();
  if (!text) return `HTTP ${status || 'Error'}: Máy chủ không trả về nội dung lỗi.`;
  if (/^<!doctype\s+html/i.test(text) || /<html[\s>]/i.test(text)) {
    const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
    const host = (() => {
      try { return new URL(endpoint).host; } catch { return ''; }
    })();
    const detail = [
      status ? `HTTP ${status}` : 'Lỗi HTTP',
      title ? `(${title})` : '',
      host ? `tại ${host}` : '',
    ].filter(Boolean).join(' ');
    return `${detail} — Endpoint trả về trang HTML thay vì JSON API. Hãy kiểm tra lại Base URL (ví dụ thêm /v1).`;
  }
  const singleLine = text.replace(/\s+/g, ' ').trim();
  return singleLine.length > 280 ? `${singleLine.slice(0, 277)}…` : singleLine;
}

async function fetchProviderModels({ provider = 'Google', baseUrl, apiKey }) {
  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    if (provider === 'Google') {
      const normalizedBase = normalizeGoogleBaseUrl(baseUrl);
      const res = await fetch(`${normalizedBase}/models`, {
        headers: { 'x-goog-api-key': cleanKey },
        signal: controller.signal,
      });
      if (!res.ok) return [];
      const data = await res.json();
      const models = (Array.isArray(data?.models) ? data.models : [])
        .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map((m) => String(m.name || '').replace(/^models\//, ''))
        .filter((name) => /^gemini/i.test(name) && !/embedding|aqa|imagen|veo/i.test(name));
      return models;
    }
    if (provider === 'Anthropic') {
      const normalizedBase = normalizeAnthropicBaseUrl(baseUrl);
      const res = await fetch(`${normalizedBase}/models`, {
        headers: {
          'x-api-key': cleanKey,
          'anthropic-version': '2023-06-01',
        },
        signal: controller.signal,
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (Array.isArray(data?.data) ? data.data : []).map((m) => String(m?.id || '').trim()).filter(Boolean);
    }
    const normalizedBase = normalizeOpenAiBaseUrl(baseUrl, provider === 'Custom' ? 'https://api.kingofapi.store/v1' : 'https://api.openai.com/v1');
    const res = await fetch(`${normalizedBase}/models`, {
      headers: { Authorization: `Bearer ${cleanKey}` },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const ids = (Array.isArray(data?.data) ? data.data : [])
      .map((m) => String(m?.id || '').trim())
      .filter((id) => id && !/audio|realtime|tts|whisper|embedding|moderation|dall-e/i.test(id));
    if (provider === 'OpenAI') {
      const openAiIds = ids.filter((id) => /^(gpt-|o\d|chatgpt)/i.test(id));
      return openAiIds.length ? openAiIds : ids;
    }
    return ids;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

ipcMain.handle('ai:list-models', async (_event, payload) => fetchProviderModels(payload || {}));

function imageMimeType(base64) {
  return String(base64 || '').startsWith('/9j/') ? 'image/jpeg' : 'image/png';
}

function normalizeReasoningEffort(rawEffort) {
  const normalized = String(rawEffort || '').trim().toLowerCase();
  return ['none', 'low', 'medium', 'high', 'max'].includes(normalized) ? normalized : 'auto';
}

// Pure request builder shared by production calls and the regression checker. Keeping
// provider-specific schema placement here prevents the test from drifting away from
// the request that the app actually sends.
function buildAiRequest({ provider = 'Google', baseUrl, apiKey, model, effort = 'auto', system = '', prompt = '', imageBase64, json = false, schema } = {}) {
  const cleanKey = String(apiKey || '').trim();
  const imageMime = imageMimeType(imageBase64);
  const normalizedEffort = normalizeReasoningEffort(effort);
  if (provider === 'Google') {
    const normalizedBase = normalizeGoogleBaseUrl(baseUrl);
    const requestedModel = String(model || 'gemini-3.8-flash').trim() || 'gemini-3.8-flash';
    const parts = [{ text: String(prompt || '') }];
    if (imageBase64) parts.push({ inline_data: { mime_type: imageMime, data: imageBase64 } });
    const generationConfig = /^gemini-(1|2)\./i.test(requestedModel) ? { temperature: 0.25 } : {};
    if (normalizedEffort !== 'auto') {
      if (/^gemini-2\.5/i.test(requestedModel)) {
        const budgetMap = { none: /pro/i.test(requestedModel) ? 128 : 0, low: 1024, medium: 4096, high: 12288, max: 24576 };
        generationConfig.thinkingConfig = { thinkingBudget: budgetMap[normalizedEffort] };
      } else if (!/^gemini-(1|2\.0)/i.test(requestedModel)) {
        const levelMap = { none: 'minimal', low: 'low', medium: 'medium', high: 'high', max: 'high' };
        generationConfig.thinkingConfig = { thinkingLevel: levelMap[normalizedEffort] };
      }
    }
    if (json) {
      generationConfig.responseMimeType = 'application/json';
      if (schema) generationConfig.responseJsonSchema = schema;
    }
    const body = { contents: [{ role: 'user', parts }], generationConfig };
    if (system) body.systemInstruction = { parts: [{ text: String(system) }] };
    return {
      provider,
      model: requestedModel,
      url: `${normalizedBase}/models/${encodeURIComponent(requestedModel)}:generateContent`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cleanKey },
      body,
    };
  }
  const normalizedBase = provider === 'Anthropic'
    ? normalizeAnthropicBaseUrl(baseUrl)
    : normalizeOpenAiBaseUrl(baseUrl, provider === 'Custom' ? 'https://api.kingofapi.store/v1' : 'https://api.openai.com/v1');
  if (provider === 'Anthropic') {
    const userContent = imageBase64
      ? [{ type: 'image', source: { type: 'base64', media_type: imageMime, data: imageBase64 } }, { type: 'text', text: prompt }]
      : prompt;
    const thinkingBudgets = { low: 1024, medium: 4096, high: 10000, max: 16000 };
    const thinkingBudget = thinkingBudgets[normalizedEffort] || 0;
    const body = {
      model: model || 'claude-sonnet-5-5',
      max_tokens: thinkingBudget ? Math.max(8192, thinkingBudget + 4096) : 8192,
      system,
      messages: [{ role: 'user', content: userContent }],
    };
    if (thinkingBudget) {
      body.thinking = { type: 'enabled', budget_tokens: thinkingBudget };
    }
    if (json && schema) {
      body.tools = [{ name: 'create_shot_plan', description: 'Return the validated VinaCAD shot plan.', input_schema: schema }];
      body.tool_choice = thinkingBudget ? { type: 'auto' } : { type: 'tool', name: 'create_shot_plan' };
    }
    return {
      provider,
      model: body.model,
      url: normalizedBase.endsWith('/messages') ? normalizedBase : `${normalizedBase}/messages`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': cleanKey, 'anthropic-version': '2023-06-01' },
      body,
    };
  }
  const chatModel = model || 'gpt-6.1-sol';
  const userContent = imageBase64
    ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${imageMime};base64,${imageBase64}` } }]
    : prompt;
  const body = {
    model: chatModel,
    messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }],
  };
  if (normalizedEffort !== 'auto') {
    body.reasoning_effort = normalizedEffort === 'none'
      ? (/^o\d/i.test(chatModel) ? 'low' : 'none')
      : normalizedEffort === 'max'
        ? (provider === 'OpenAI' && /^(gpt-5\.[2-9]|gpt-6)/i.test(chatModel) ? 'xhigh' : 'high')
        : normalizedEffort;
  } else if (!/^(o\d|gpt-5|gpt-6)/i.test(chatModel)) {
    body.temperature = 0.25;
  }
  if (json && !(provider === 'Custom' && /^claude/i.test(chatModel))) {
    body.response_format = (schema && provider !== 'Custom')
      ? { type: 'json_schema', json_schema: { name: 'vinacut_shot_plan', strict: false, schema } }
      : { type: 'json_object' };
  }
  return {
    provider,
    model: chatModel,
    url: normalizedBase.endsWith('/chat/completions') ? normalizedBase : `${normalizedBase}/chat/completions`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cleanKey}` },
    body,
  };
}

async function callGoogleGemini({ baseUrl, apiKey, model, effort = 'auto', system, prompt, imageBase64, json = false, schema, timeoutMs = 60000, signal }) {
  const request = buildAiRequest({ provider: 'Google', baseUrl, apiKey, model, effort, system, prompt, imageBase64, json, schema });
  const candidateModel = request.model;
  const endpoint = request.url;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetch(endpoint, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: controller.signal,
    });
    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: { message: raw } };
    }

    if (!response.ok) {
      const msg = summarizeApiError(data?.error?.message || data?.error || `HTTP ${response.status}`, response.status, endpoint);
      const error = new Error(String(msg));
      error.status = response.status;
      throw error;
    }

    const rawParts = Array.isArray(data?.candidates?.[0]?.content?.parts) ? data.candidates[0].content.parts : [];
    const visibleText = rawParts.filter((p) => !p?.thought).map((p) => p?.text || '').join('');
    const text = visibleText || rawParts.map((p) => p?.text || '').join('') || '';
    if (!text.trim()) {
      const blockReason = data?.promptFeedback?.blockReason;
      throw new Error(blockReason ? `Google chặn nội dung: ${blockReason}` : 'Model không trả về nội dung.');
    }
    return { text, usedModel: candidateModel };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(signal?.aborted ? 'Đã dừng tác vụ AI.' : `Kết nối quá thời gian chờ (${Math.round(timeoutMs / 1000)}s).`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}

function isStructuredSchemaError(message, status) {
  const text = String(message || '').toLowerCase();
  return Number(status) === 400 && /schema|response[_ ]?format|responsejsonschema|structured|tool_choice|input_schema|unknown field|unsupported/.test(text);
}

function isEffortUnsupportedError(message, status) {
  const text = String(message || '').toLowerCase();
  return Number(status) === 400 && /reasoning[_ ]?effort|thinking|budget_tokens|thinkinglevel|thinkingbudget|thinking_config|\beffort\b/.test(text);
}

async function callAiChatInternal(payload, signal) {
  const { provider = 'Google', baseUrl, apiKey, model, effort = 'auto', system = '', prompt = '', imageBase64, json = false, schema } = payload || {};
  const normalizedEffort = normalizeReasoningEffort(effort);
  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('Chưa có API Key. Hãy bấm "Cấu hình AI" để dán API key.');
  }

  const requestedTimeout = Number(payload?.timeoutMs);
  const timeoutMs = Number.isFinite(requestedTimeout)
    ? Math.min(Math.max(requestedTimeout, 5000), 180000)
    : 120000;

  if (provider === 'Google') {
    try {
      const res = await callGoogleGemini({
        baseUrl: baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: cleanKey,
        model: model || 'gemini-3.8-flash',
        effort: normalizedEffort,
        system,
        prompt,
        imageBase64,
        json,
        schema,
        timeoutMs,
        signal,
      });
      return res.text;
    } catch (error) {
      if (normalizedEffort !== 'auto' && isEffortUnsupportedError(error?.message, error?.status)) {
        return callAiChatInternal({ ...payload, effort: 'auto' }, signal);
      }
      if (json && schema && isStructuredSchemaError(error?.message, error?.status)) {
        const fallback = await callGoogleGemini({
          baseUrl: baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
          apiKey: cleanKey,
          model: model || 'gemini-3.8-flash',
          effort: normalizedEffort,
          system,
          prompt,
          imageBase64,
          json: false,
          schema: undefined,
          timeoutMs,
          signal,
        });
        return fallback.text;
      }
      throw error;
    }
  }
  const request = buildAiRequest({ provider, baseUrl, apiKey: cleanKey, model, effort: normalizedEffort, system, prompt, imageBase64, json, schema });
  const endpoint = request.url;
  const headers = request.headers;
  const body = request.body;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  let response;
  let raw;
  try {
    response = await fetch(endpoint, {
      method: request.method,
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    raw = await response.text();
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(signal?.aborted
        ? 'Đã dừng tác vụ AI.'
        : `Kết nối hết thời gian chờ sau ${Math.round(timeoutMs / 1000)} giây.`);
    }
    throw new Error(`Không kết nối được tới AI endpoint: ${error?.message || 'lỗi mạng'}`);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { error: raw };
  }

  if (!response.ok) {
    const apiError = data?.error;
    const rawError = typeof apiError === 'string'
      ? apiError
      : apiError?.message || (apiError ? JSON.stringify(apiError) : `AI request failed (${response.status})`);
    if (normalizedEffort !== 'auto' && isEffortUnsupportedError(rawError, response.status)) {
      return callAiChatInternal({ ...payload, effort: 'auto' }, signal);
    }
    if (json && schema && isStructuredSchemaError(rawError, response.status)) {
      return callAiChatInternal({ ...payload, json: false, schema: undefined }, signal);
    }
    const errorMessage = summarizeApiError(rawError, response.status, endpoint);
    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }

  if (provider === 'Anthropic') {
    const tool = data?.content?.find((part) => part.type === 'tool_use' && part.input);
    if (tool) return JSON.stringify(tool.input);
    return data?.content?.filter((part) => part?.type === 'text' || (!part?.type && part?.text)).map((part) => part.text || '').join('') || '';
  }
  return data?.choices?.[0]?.message?.content || '';
}

ipcMain.handle('ai:chat', async (_event, payload) => callAiChatInternal(payload));

ipcMain.handle('ai:test', async (_event, payload) => {
  const { provider = 'Google', baseUrl, apiKey, model, effort = 'auto' } = payload || {};
  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey) throw new Error('Vui lòng dán API Key trước khi kiểm tra.');

  const normalizedBaseUrl = provider === 'Google'
    ? normalizeGoogleBaseUrl(baseUrl)
    : provider === 'Anthropic'
      ? normalizeAnthropicBaseUrl(baseUrl)
      : normalizeOpenAiBaseUrl(baseUrl, provider === 'Custom' ? 'https://api.kingofapi.store/v1' : 'https://api.openai.com/v1');
  const discoveredModels = await fetchProviderModels({ provider, baseUrl: normalizedBaseUrl, apiKey: cleanKey }).catch(() => []);
  const requestedModel = String(model || '').trim();
  const effectiveModel = (requestedModel && requestedModel !== 'custom-model-id')
    ? requestedModel
    : (discoveredModels[0] || (provider === 'Anthropic' ? 'claude-sonnet-5-5' : provider === 'Google' ? 'gemini-3.8-flash' : 'gpt-6.1-sol'));

  if (provider === 'Google') {
    await callAiChatInternal({
      provider: 'Google',
      baseUrl: normalizedBaseUrl,
      apiKey: cleanKey,
      model: effectiveModel,
      effort,
      system: 'Reply with OK.',
      prompt: 'Ping',
      timeoutMs: 25000,
    });
    let computerUseMessage = 'Computer Use chưa xác thực trong lần kiểm tra này.';
    try {
      await callGoogleComputerUsePreflight({
        baseUrl: normalizedBaseUrl,
        apiKey: cleanKey,
        model: effectiveModel,
        timeoutMs: 25000,
      });
      computerUseMessage = 'Computer Use endpoint đã phản hồi.';
    } catch (error) {
      computerUseMessage = `Computer Use chưa sẵn sàng (${summarizeApiError(error?.message || 'endpoint không phản hồi', error?.status, normalizedBaseUrl)}).`;
    }
    return {
      ok: true,
      model: effectiveModel,
      baseUrl: normalizedBaseUrl,
      models: discoveredModels,
      message: `Đã kết nối Google AI Studio (${effectiveModel}). Planner VinaCAD sẵn sàng chạy; ${computerUseMessage}`,
    };
  }

  try {
    const text = await callAiChatInternal({
      provider,
      baseUrl: normalizedBaseUrl,
      apiKey: cleanKey,
      model: effectiveModel,
      effort,
      system: 'Reply with OK.',
      prompt: 'Ping',
      timeoutMs: 25000,
    });
    return {
      ok: Boolean(text),
      model: effectiveModel,
      baseUrl: normalizedBaseUrl,
      models: discoveredModels,
      message: `Đã kết nối (${provider} · ${effectiveModel}${discoveredModels.length ? ` · ${discoveredModels.length} model khả dụng` : ''}). Sẵn sàng chạy ngầm tự động!`,
    };
  } catch (error) {
    const cleanErr = summarizeApiError(error?.message || 'Không kết nối được tới endpoint.', error?.status, normalizedBaseUrl);
    if (discoveredModels.length > 0) {
      return {
        ok: false,
        model: effectiveModel,
        baseUrl: normalizedBaseUrl,
        models: discoveredModels,
        message: `Đã đồng bộ ${discoveredModels.length} model từ ${normalizedBaseUrl} (${discoveredModels.slice(0, 4).join(', ')}), nhưng gọi thử model "${effectiveModel}" báo lỗi: ${cleanErr}`,
      };
    }
    throw new Error(cleanErr);
  }
});

async function callGoogleComputerUsePreflight({ baseUrl, apiKey, model, timeoutMs = 25000 }) {
  const normalizedBase = normalizeGoogleBaseUrl(baseUrl);
  const endpoint = `${normalizedBase}/interactions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': String(apiKey || '').trim(),
      },
      body: JSON.stringify({
        model: String(model || 'gemini-3.8-flash').trim(),
        input: 'Kiểm tra khả năng Computer Use. Chỉ cần trả về một bước hợp lệ, không thao tác dữ liệu thật.',
        tools: [{
          type: 'computer_use',
          environment: 'browser',
          enable_prompt_injection_detection: true,
        }],
        store: false,
      }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: raw };
    }
    if (!response.ok) {
      const apiError = data?.error;
      const message = typeof apiError === 'string'
        ? apiError
        : apiError?.message || `Google Computer Use request failed (${response.status})`;
      throw new Error(message);
    }
    return {
      status: data?.status || 'completed',
      id: data?.id || null,
      output: Array.isArray(data?.output) ? data.output : [],
    };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Computer Use preflight hết thời gian chờ.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

ipcMain.handle('ai:computer-use-test', async (_event, payload) => {
  const cleanKey = String(payload?.apiKey || '').trim();
  if (!cleanKey) throw new Error('Vui lòng dán API Key trước khi kiểm tra Computer Use.');
  const result = await callGoogleComputerUsePreflight({
    baseUrl: payload?.baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: cleanKey,
    model: payload?.model || 'gemini-3.8-flash',
  });
  return {
    status: result.status,
    text: 'Google Computer Use endpoint đã phản hồi. Luồng quay VinaCAD hiện vẫn dùng planner + action library chuyên biệt.',
    id: result.id,
  };
});

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

ipcMain.handle('dwg:list-recent', async () => {
  const items = [
    {
      name: 'Sample_FloorPlan_ISO.dwg (Mặt bằng mẫu tích hợp)',
      path: '__BUILTIN_SAMPLE__',
      sizeLabel: 'Mẫu chuẩn MKT',
      isBuiltin: true,
    },
  ];

  const searchDirs = [app.getPath('downloads'), app.getPath('desktop')];
  const foundFiles = [];

  for (const dir of searchDirs) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.dwg' || ext === '.dxf' || ext === '.dwt') {
          const fullPath = path.join(dir, entry.name);
          try {
            const stat = await fs.stat(fullPath);
            foundFiles.push({
              name: entry.name,
              path: fullPath,
              sizeLabel: formatBytes(stat.size),
              mtimeMs: stat.mtimeMs,
            });
          } catch {
            // Skip inaccessible file
          }
        }
      }
    } catch {
      // Ignore missing folder
    }
  }

  foundFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const item of foundFiles.slice(0, 12)) {
    items.push({
      name: item.name,
      path: item.path,
      sizeLabel: item.sizeLabel,
    });
  }
  return items;
});

ipcMain.handle('dwg:pick', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Chọn bản vẽ CAD (.dwg, .dxf, .dwt) để AI mở trên VinaCAD',
    defaultPath: app.getPath('downloads'),
    properties: ['openFile'],
    filters: [
      { name: 'CAD Drawings (.dwg, .dxf, .dwt)', extensions: ['dwg', 'dxf', 'dwt'] },
      { name: 'All files', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePaths?.length) return null;
  const fullPath = result.filePaths[0];
  const stat = await fs.stat(fullPath).catch(() => ({ size: 0 }));
  return {
    name: path.basename(fullPath),
    path: fullPath,
    sizeLabel: formatBytes(stat.size),
  };
});

ipcMain.handle('file:save', async (_event, payload) => {
  const { defaultPath, data } = payload || {};
  if (!data) throw new Error('Không có dữ liệu video để lưu.');

  const result = await dialog.showSaveDialog({
    title: 'Xuất video Marketing hoàn chỉnh',
    defaultPath: defaultPath || 'vinacut-master.mp4',
    filters: [
      { name: 'MP4 Video', extensions: ['mp4'] },
      { name: 'Video', extensions: ['mp4', 'webm', 'mov'] },
      { name: 'All files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, Buffer.from(data));
  return result.filePath;
});

ipcMain.handle('capture:sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 240, height: 135 },
    fetchWindowIcons: false,
  });
  return sources.map((source) => ({ id: source.id, name: source.name }));
});

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// Background Frame Pipe Capture: captures directly from Chromium's GPU surface of vinacadWindow
// Works 100% in the background even when vinacadWindow is invisible (opacity: 0) or behind other apps!
async function startBackgroundWindowCapture(window) {
  if (nativeCaptureProcess) {
    await stopNativeCapture().catch(() => {});
  }
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) throw new Error('Không tìm thấy FFmpeg trong bản cài đặt.');

  const tempDir = await fs.mkdtemp(path.join(app.getPath('temp'), 'vinacut-bgcapture-'));
  const outputPath = path.join(tempDir, 'screen-capture.mp4');
  const args = [
    '-y',
    '-use_wallclock_as_timestamps', '1',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-i', '-',
    '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputPath,
  ];

  nativeCaptureOutput = outputPath;
  backgroundCaptureActive = true;
  nativeCaptureProcess = spawn(ffmpegPath, args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  nativeCaptureProcess.stderr.on('data', () => {});
  nativeCaptureProcess.stdin.on('error', () => {});
  nativeCaptureProcess.once('error', (error) => {
    backgroundCaptureActive = false;
    nativeCaptureProcess = null;
    nativeCaptureOutput = null;
    console.error('[capture:bg-start]', error);
  });

  // Pump frames from window.webContents.capturePage() into ffmpeg stdin
  let pumping = false;
  const pumpFrame = async () => {
    if (!backgroundCaptureActive || pumping || !nativeCaptureProcess || !window || window.isDestroyed()) return;
    pumping = true;
    try {
      const image = await window.webContents.capturePage();
      if (backgroundCaptureActive && nativeCaptureProcess && nativeCaptureProcess.stdin.writable) {
        const jpg = image.toJPEG(90);
        if (jpg && jpg.length > 256) {
          nativeCaptureProcess.stdin.write(jpg);
        }
      }
    } catch {
      // Ignore transient frame capture errors
    } finally {
      pumping = false;
    }
  };

  await pumpFrame();
  backgroundFrameTimer = setInterval(pumpFrame, 45);
  return { started: true, outputPath };
}

async function startNativeCapture(windowTitle = '', options = {}) {
  if (nativeCaptureProcess) {
    await stopNativeCapture().catch(() => {});
  }
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) throw new Error('Không tìm thấy FFmpeg trong bản cài đặt.');

  const drawMouse = options.drawMouse !== undefined ? (options.drawMouse ? '1' : '0') : '1';
  const tempDir = await fs.mkdtemp(path.join(app.getPath('temp'), 'vinacut-capture-'));
  const outputPath = path.join(tempDir, 'screen-capture.mp4');
  const args = [
    '-y',
    '-f', 'gdigrab',
    '-framerate', '60',
    '-draw_mouse', drawMouse,
    '-i', windowTitle ? `title=${windowTitle}` : 'desktop',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '17',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputPath,
  ];

  nativeCaptureOutput = outputPath;
  backgroundCaptureActive = false;
  nativeCaptureProcess = spawn(ffmpegPath, args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  nativeCaptureProcess.stderr.on('data', () => {});
  nativeCaptureProcess.once('error', (error) => {
    nativeCaptureProcess = null;
    nativeCaptureOutput = null;
    console.error('[capture:native-start]', error);
  });
  await wait(450);
  return { started: true, outputPath };
}

async function stopNativeCapture() {
  const wasBackground = backgroundCaptureActive;
  backgroundCaptureActive = false;
  if (backgroundFrameTimer) {
    clearInterval(backgroundFrameTimer);
    backgroundFrameTimer = null;
  }

  if (!nativeCaptureProcess || !nativeCaptureOutput) return null;
  const processToStop = nativeCaptureProcess;
  const outputPath = nativeCaptureOutput;
  nativeCaptureProcess = null;
  nativeCaptureOutput = null;

  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    processToStop.once('close', finish);
    try {
      if (!wasBackground) {
        processToStop.stdin.write('q\n');
      }
      processToStop.stdin.end();
    } catch {
      finish();
    }
    setTimeout(() => {
      if (!settled) {
        processToStop.kill();
        finish();
      }
    }, 8000);
  });

  try {
    const data = await fs.readFile(outputPath);
    await fs.rm(path.dirname(outputPath), { recursive: true, force: true });
    return new Uint8Array(data);
  } catch (error) {
    await fs.rm(path.dirname(outputPath), { recursive: true, force: true }).catch(() => {});
    throw new Error(`Không tạo được file quay: ${error.message}`);
  }
}

ipcMain.handle('capture:native-start', async (_event, payload) => startNativeCapture(payload?.windowTitle || ''));
ipcMain.handle('capture:native-stop', async () => stopNativeCapture());

async function waitForVinacadEditorReady(window, maxWaitMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (window.isDestroyed()) throw new Error('Cửa sổ VinaCAD đã bị đóng.');
    try {
      const state = await window.webContents.executeJavaScript(`
        (() => {
          try {
            localStorage.setItem('drive_terms_accepted', 'true');
            window.onbeforeunload = null;
          } catch {}
          const buttons = Array.from(document.querySelectorAll('button'));
          const agreeBtn = buttons.find((b) => {
            const text = (b.innerText || '').trim().toLowerCase();
            const inDialog = Boolean(b.closest('[role="dialog"], [aria-modal="true"], .modal, .modal-content'));
            return inDialog && /^(đồng ý|agree|chấp nhận)$/.test(text);
          });
          if (agreeBtn) agreeBtn.click();

          const s = window.store && window.store.getState ? window.store.getState() : null;
          const inWeb = window.__inWeb || window.__INWEB_INSTANCE__;
          const hasInWeb = Boolean(inWeb && inWeb.Database && inWeb.CadModule && inWeb.AppCore && inWeb.View);
          const initSuccess = Boolean(s && s.drawing && s.drawing.initSuccess);
          const isLoadedFont = Boolean(s && s.ui && s.ui.isLoadedFont);
          const isLoadingDrawing = Boolean(!s || !s.loadingDrawing || s.loadingDrawing.isLoading);
          return {
            ready: hasInWeb && initSuccess && isLoadedFont && !isLoadingDrawing,
            hasInWeb,
            initSuccess,
            isLoadedFont,
            isLoadingDrawing,
          };
        })()
      `);
      if (state?.ready) {
        await wait(900);
        return true;
      }
    } catch {
      // Ignore transient frame navigation errors
    }
    await wait(450);
  }
  return false;
}

function applyWindowVisibilityMode(win, background = true) {
  if (!win || win.isDestroyed()) return;
  if (background) {
    win.setSkipTaskbar(true);
    win.setFocusable(false);
    win.setIgnoreMouseEvents(true);
    win.setOpacity(0);
    win.setSize(1920, 1080);
    win.showInactive();
  } else {
    win.setIgnoreMouseEvents(false);
    win.setFocusable(true);
    win.setSkipTaskbar(false);
    win.setOpacity(1);
    win.maximize();
    win.show();
    win.focus();
  }
}

async function ensureVinacadWindow(options = {}) {
  const background = options.background !== undefined ? Boolean(options.background) : true;

  if (vinacadWindow && !vinacadWindow.isDestroyed()) {
    vinacadWindow.setTitle(VINACAD_RECORDER_TITLE);
    applyWindowVisibilityMode(vinacadWindow, background);
    const ready = await waitForVinacadEditorReady(vinacadWindow, 12000);
    if (!ready) throw new Error('VinaCAD chưa sẵn sàng. Hãy kiểm tra đăng nhập, mạng và chờ bản vẽ khởi tạo xong.');
    return vinacadWindow;
  }

  vinacadWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    opacity: background ? 0 : 1,
    skipTaskbar: background,
    focusable: !background,
    title: VINACAD_RECORDER_TITLE,
    backgroundColor: '#0b1018',
    icon: path.join(__dirname, '..', 'public', 'assets', 'vinacad.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  // CRITICAL FIX: Prevent VinaCAD Web's beforeunload listener from blocking window close [X] button!
  vinacadWindow.webContents.on('will-prevent-unload', (event) => {
    event.preventDefault();
  });

  vinacadWindow.on('close', () => {
    if (vinacadWindow && !vinacadWindow.isDestroyed()) {
      vinacadWindow.destroy();
    }
  });

  // Prevent web page <title> from overwriting the window title
  vinacadWindow.on('page-title-updated', (event) => {
    event.preventDefault();
    if (vinacadWindow && !vinacadWindow.isDestroyed()) {
      vinacadWindow.setTitle(VINACAD_RECORDER_TITLE);
    }
  });

  vinacadWindow.on('closed', () => {
    vinacadWindow = null;
    currentLoadedDwgPath = '';
    if (agentAbortController) agentAbortController.abort();
    if (nativeCaptureProcess) void stopNativeCapture().catch(() => {});
  });

  applyWindowVisibilityMode(vinacadWindow, background);
  await vinacadWindow.loadURL(VINACAD_URL);
  if (vinacadWindow && !vinacadWindow.isDestroyed()) {
    vinacadWindow.setTitle(VINACAD_RECORDER_TITLE);
  }
  const ready = await waitForVinacadEditorReady(vinacadWindow, 25000);
  if (!ready) {
    await closeVinacadWindow();
    throw new Error('VinaCAD chưa sẵn sàng. Hãy kiểm tra đăng nhập, mạng và chờ bản vẽ khởi tạo xong.');
  }
  return vinacadWindow;
}

async function closeVinacadWindow() {
  if (vinacadWindow && !vinacadWindow.isDestroyed()) {
    try {
      vinacadWindow.destroy();
    } catch {
      // Ignore if already destroyed
    }
  }
  vinacadWindow = null;
  currentLoadedDwgPath = '';
}

ipcMain.handle('vinacad:close', async () => {
  if (agentAbortController) agentAbortController.abort();
  await stopNativeCapture().catch(() => {});
  await closeVinacadWindow();
  return { closed: true };
});

async function loadDrawingIntoWindow(window, requestedPath) {
  const name = await vinacadEngine.loadDrawing(window, requestedPath);
  currentLoadedDwgPath = vinacadEngine.isSamplePath(requestedPath) ? '__BUILTIN_SAMPLE__' : requestedPath;
  return name;
}

ipcMain.handle('vinacad:prepare', async (_event, payload) => {
  const visible = payload?.visible !== undefined ? Boolean(payload.visible) : true;
  const window = await ensureVinacadWindow({ background: !visible });
  let drawingName = 'Bản vẽ hiện tại';
  if (payload?.dwgPath) {
    drawingName = await loadDrawingIntoWindow(window, payload.dwgPath);
  }
  return {
    ready: true,
    drawingName,
    message: `Đã mở VinaCAD Web (${drawingName}). Bạn có thể đóng cửa sổ bằng nút [X] bất cứ lúc nào.`,
  };
});

ipcMain.handle('capture:vinacad-start', async (_event, payload) => {
  const window = await ensureVinacadWindow({ background: false });
  if (payload?.dwgPath) {
    await loadDrawingIntoWindow(window, payload.dwgPath);
  }
  // Keep the verified Chromium surface capture for this path. A gdigrab smoke test in the
  // current desktop session produced an all-black window, so it is retained as a fallback
  // candidate until it is verified on a real interactive 100%/125% desktop.
  await startBackgroundWindowCapture(window);
  return { started: true, title: window.getTitle() };
});

function formatAssTimestamp(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${hrs}:${String(mins).padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
}

function escapeAssText(text) {
  return String(text || '')
    .replace(/\r?\n/g, '\\N')
    .replace(/[{}]/g, '')
    .trim();
}

async function probeVideoDuration(ffmpegPath, filePath) {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, ['-i', filePath], { windowsHide: true });
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('close', () => {
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!match) {
        resolve(12);
        return;
      }
      const total = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
      resolve(Math.max(1, total));
    });
    proc.on('error', () => resolve(12));
  });
}

async function runFfmpegCommand(ffmpegPath, args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { cwd, windowsHide: true });
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-500) || `FFmpeg exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

async function renderEditedVideo({ videoData, scenes = [], quality = '1080p social' }) {
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) throw new Error('Không tìm thấy FFmpeg để dựng video.');
  if (!videoData || videoData.byteLength < 1024) {
    throw new Error('Dữ liệu video nguồn trống hoặc không hợp lệ.');
  }

  const tempDir = await fs.mkdtemp(path.join(app.getPath('temp'), 'vinacut-edit-'));
  const inputPath = path.join(tempDir, 'input.mp4');
  const outputPath = path.join(tempDir, 'master.mp4');
  const assPath = path.join(tempDir, 'captions.ass');
  const fontsDir = path.join(tempDir, 'fonts');

  try {
    await fs.writeFile(inputPath, Buffer.from(videoData));
    const actualVideoDuration = await probeVideoDuration(ffmpegPath, inputPath);

    const isVertical = quality === 'Vertical cut';
    const is4K = quality === '4K master';
    const outW = isVertical ? 1080 : is4K ? 3840 : 1920;
    const outH = isVertical ? 1920 : is4K ? 2160 : 1080;
    const fontSize = isVertical ? 44 : is4K ? 74 : 38;
    const outlinePadding = isVertical ? 16 : is4K ? 26 : 14;
    const marginV = isVertical ? 220 : is4K ? 110 : 54;

    const validScenes = Array.isArray(scenes) && scenes.length > 0
      ? scenes
      : [
          {
            label: 'Demo tính năng VinaCAD Web',
            description: 'Thao tác trực tiếp trên giao diện VinaCAD Web với độ chính xác cao.',
            duration: actualVideoDuration,
            focus: 'full',
          },
        ];

    const plannedTotal = validScenes.reduce((sum, s) => sum + Math.max(1, Number(s.duration) || 5), 0);
    const scaleFactor = actualVideoDuration / Math.max(1, plannedTotal);

    let cursorTime = 0;
    const timedScenes = validScenes.map((scene, idx) => {
      const scaledDur = idx === validScenes.length - 1
        ? Math.max(0.8, actualVideoDuration - cursorTime)
        : Math.max(0.8, (Number(scene.duration) || 5) * scaleFactor);
      const start = cursorTime;
      const end = Math.min(actualVideoDuration, Number((cursorTime + scaledDur).toFixed(2)));
      cursorTime = end;
      return {
        ...scene,
        start: Number(start.toFixed(2)),
        end: Math.max(Number((start + 0.5).toFixed(2)), end),
        focus: scene.focus || 'full',
      };
    });

    const dialogueLines = timedScenes
      .filter((s) => s.description && String(s.description).trim())
      .map((s) => {
        const startStr = formatAssTimestamp(s.start + 0.1);
        const endStr = formatAssTimestamp(Math.max(s.start + 0.4, s.end - 0.1));
        const text = escapeAssText(s.description);
        return `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,{\\fad(160,160)}${text}`;
      })
      .join('\n');

    const assContent = [
      '[Script Info]',
      'ScriptType: v4.00+',
      `PlayResX: ${outW}`,
      `PlayResY: ${outH}`,
      'WrapStyle: 0',
      'ScaledBorderAndShadow: yes',
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      `Style: Default,Arial,${fontSize},&H00FFFFFF,&H0000FFFF,&H6E0B1018,&H6E0B1018,-1,0,0,0,100,100,0,0,3,${outlinePadding},0,2,80,80,${marginV},1`,
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      dialogueLines,
      '',
    ].join('\n');

    await fs.writeFile(assPath, assContent, 'utf8');
    await fs.mkdir(fontsDir, { recursive: true });
    const windowsFonts = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');
    for (const name of ['segoeui.ttf', 'segoeuib.ttf', 'segoeuisl.ttf', 'arial.ttf', 'arialbd.ttf']) {
      const source = path.join(windowsFonts, name);
      const target = path.join(fontsDir, name);
      if (fsSync.existsSync(source)) await fs.copyFile(source, target).catch(() => {});
    }

    const simpleVf = isVertical
      ? `scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:#0b1018,setsar=1,ass=captions.ass:fontsdir=fonts`
      : `scale=${outW}:${outH},setsar=1,ass=captions.ass:fontsdir=fonts`;
    await runFfmpegCommand(
      ffmpegPath,
      [
        '-y',
        '-i', 'input.mp4',
        '-vf', simpleVf,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        'master.mp4',
      ],
      tempDir,
    );

    const outBuffer = await fs.readFile(outputPath);
    return {
      video: new Uint8Array(outBuffer),
      duration: Math.round(actualVideoDuration),
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

ipcMain.handle('video:render', async (_event, payload) => renderEditedVideo(payload || {}));

let productionController = null;
const renderCache = new Map();

function sendProductionProgress(data) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('production:progress', data);
}

function beginProduction() {
  if (productionController) throw new Error('Đang có tác vụ quay/dựng khác chạy. Hãy đợi xong hoặc bấm Dừng.');
  productionController = new AbortController();
  return productionController;
}

function endProduction(controller) {
  if (productionController === controller) productionController = null;
}

async function resolveKnowledge(knowledge) {
  const text = String(knowledge || '').trim();
  if (text.length >= 200) return text;
  return fs.readFile(path.join(__dirname, '..', 'public', 'knowledge', 'project-playbook.md'), 'utf8').catch(() => text);
}

async function renderForSession({ sessionId, quality, sceneOverrides, force = false, signal }) {
  const key = JSON.stringify({ quality, sceneOverrides: sceneOverrides || [] });
  const cached = renderCache.get(sessionId);
  if (!force && cached && cached.key === key && fsSync.existsSync(cached.result.path)) return cached.result;
  const result = await director.renderSession({
    ffmpegPath: getFfmpegPath(),
    sessionsRoot: getSessionsRoot(),
    sessionId,
    quality,
    sceneOverrides,
    signal,
    onProgress: sendProductionProgress,
  });
  renderCache.set(sessionId, { key, result });
  return result;
}

function videoPayload(result, quality) {
  return {
    url: `vinacut-media://${result.sessionId}/${encodeURIComponent(result.fileName)}`,
    quality,
    width: result.width,
    height: result.height,
    duration: result.duration,
    encoder: result.encoder,
  };
}

ipcMain.handle('production:plan', async (_event, payload) => {
  const controller = beginProduction();
  try {
    const { prompt, knowledge, dwgPath, provider = 'Google', baseUrl, apiKey, model, effort = 'auto' } = payload || {};
    if (!String(prompt || '').trim()) throw new Error('Vui lòng nhập kịch bản/prompt trước.');
    const cleanKey = String(apiKey || '').trim();
    if (!cleanKey) {
      const preset = vinacadEngine.isSamplePath(dwgPath) ? planner.presetPlan(prompt) : null;
      if (!preset) {
        throw new Error('Kịch bản này cần AI để hiểu đúng ý. Hãy dán API Key trong "Cấu hình AI". Chế độ offline chỉ có kịch bản Layer hoặc Vẽ & Bắt điểm trên bản vẽ mẫu.');
      }
      const { plan, rawPlan, repairs, errors } = planner.validatePlan(preset, vinacadEngine.SAMPLE_CONTEXT);
      if (errors.length) throw new Error(errors.join(' '));
       return {
         plan,
         rawPlan: rawPlan || preset,
         repairs: repairs || [],
         context: vinacadEngine.SAMPLE_CONTEXT,
         source: 'preset',
         attempts: 0,
         message: 'Chưa có API Key: dùng kịch bản mẫu offline khớp với yêu cầu.',
       };
    }
    sendProductionProgress({ phase: 'plan', message: 'Đang đọc bản vẽ để AI hiểu ngữ cảnh…' });
    const { context, screenshot } = await director.collectContext({ drawingPath: dwgPath, signal: controller.signal, onProgress: sendProductionProgress });
    const result = await planner.planWithAi({
      chat: ({ system, prompt: message, imageBase64, json, schema, signal }) => callAiChatInternal(
        { provider, baseUrl, apiKey: cleanKey, model, effort, system, prompt: message, imageBase64, json, schema, timeoutMs: 150000 },
        signal,
      ),
      prompt,
      knowledge: await resolveKnowledge(knowledge),
      context,
      screenshotBase64: screenshot,
      signal: controller.signal,
      onStatus: (message) => sendProductionProgress({ phase: 'plan', message }),
    });
     return {
       plan: result.plan,
       rawPlan: result.rawPlan || result.plan,
       rawAttempts: result.rawAttempts || [],
       repairs: result.repairs || [],
       context,
       source: 'ai',
       attempts: result.attempts,
       validationErrors: result.validationErrors || [],
       message: `AI đã lập kịch bản ${result.plan.scenes.length} cảnh.`,
     };
  } finally {
    endProduction(controller);
  }
});

ipcMain.handle('production:record', async (_event, payload) => {
  const controller = beginProduction();
  try {
    const { plan, context, dwgPath, quality = '4K master' } = payload || {};
    const planContext = context || (vinacadEngine.isSamplePath(dwgPath) ? vinacadEngine.SAMPLE_CONTEXT : {});
    const { plan: checked, errors } = planner.validatePlan(plan, planContext);
    if (errors.length) throw new Error(`Kịch bản chưa hợp lệ: ${errors.slice(0, 3).join(' ')}`);
    const recordStarted = Date.now();
    const recorded = await director.recordPlan({
      plan: checked,
      context: planContext,
      drawingPath: dwgPath,
      sessionsRoot: getSessionsRoot(),
      signal: controller.signal,
      onProgress: sendProductionProgress,
    });
    const recordMs = Date.now() - recordStarted;
    sendProductionProgress({ phase: 'render', percent: 0, message: 'Đang dựng video…' });
    const renderStarted = Date.now();
    const rendered = await renderForSession({ sessionId: recorded.sessionId, quality, sceneOverrides: [], signal: controller.signal });
    return { sessionId: recorded.sessionId, timeline: recorded.timeline, video: videoPayload(rendered, quality), timings: { recordMs, renderMs: Date.now() - renderStarted } };
  } finally {
    endProduction(controller);
  }
});

ipcMain.handle('production:render', async (_event, payload) => {
  const controller = beginProduction();
  try {
    const { sessionId, quality = '4K master', sceneOverrides = [], force = false } = payload || {};
    const started = Date.now();
    const rendered = await renderForSession({ sessionId, quality, sceneOverrides, force, signal: controller.signal });
    return { sessionId, video: videoPayload(rendered, quality), renderMs: Date.now() - started };
  } finally {
    endProduction(controller);
  }
});

ipcMain.handle('production:export', async (_event, payload) => {
  const { sessionId, quality = '4K master', sceneOverrides = [], defaultName } = payload || {};
  const controller = beginProduction();
  let rendered;
  try {
    rendered = await renderForSession({ sessionId, quality, sceneOverrides, signal: controller.signal });
  } finally {
    endProduction(controller);
  }
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Xuất video Marketing',
    defaultPath: defaultName || `VinaCAD_MKT_${quality.replace(/\s+/g, '-')}.mp4`,
    filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
  });
  if (result.canceled || !result.filePath) return null;
  await fs.copyFile(rendered.path, result.filePath);
  return result.filePath;
});

ipcMain.handle('production:cancel', async () => {
  if (productionController) productionController.abort();
  return true;
});

ipcMain.handle('capture:vinacad-stop', async () => {
  if (agentAbortController) agentAbortController.abort();
  const data = await stopNativeCapture();
  await closeVinacadWindow();
  return data;
});

function createWindow() {
  mainWindow = new BrowserWindow({
    show: !isSmokeTest,
    width: 1620,
    height: 1020,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#0b1018',
    title: 'VinaCut Studio — AI Marketing Video Producer',
    icon: path.join(__dirname, '..', 'public', 'assets', 'vinacad.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.webContents.on('did-fail-load', () => {
      if (fsSync.existsSync(distIndex)) {
        mainWindow.loadFile(distIndex);
      }
    });
    mainWindow.loadURL('http://127.0.0.1:5173').catch(() => {
      if (fsSync.existsSync(distIndex)) {
        mainWindow.loadFile(distIndex);
      }
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    void closeVinacadWindow();
  });
}

function getSessionsRoot() {
  return path.join(app.getPath('userData'), 'sessions');
}

function registerMediaProtocol() {
  protocol.handle('vinacut-media', async (request) => {
    const url = new URL(request.url);
    const sessionId = url.hostname;
    const fileName = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    if (!/^[a-z0-9-]+$/i.test(sessionId) || !/^[\w.-]+\.mp4$/i.test(fileName)) {
      return new Response('Not found', { status: 404 });
    }
    const filePath = path.join(getSessionsRoot(), sessionId, fileName);
    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch {
      return new Response('Not found', { status: 404 });
    }
    const headers = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' };
    const range = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') || '');
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
      if (start >= stat.size || start > end) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
      }
      return new Response(Readable.toWeb(fsSync.createReadStream(filePath, { start, end })), {
        status: 206,
        headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': String(end - start + 1) },
      });
    }
    return new Response(Readable.toWeb(fsSync.createReadStream(filePath)), {
      status: 200,
      headers: { ...headers, 'Content-Length': String(stat.size) },
    });
  });
}

function configureDisplayCapture() {
  const vinacadPermissions = new Set(['clipboard-read', 'clipboard-sanitized-write', 'fullscreen']);
  const isVinacad = (webContents) => {
    try {
      return new URL(webContents?.getURL() || '').hostname.endsWith('vina-cad.com');
    } catch {
      return false;
    }
  };
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => (
    permission === 'display-capture' || (isVinacad(webContents) && vinacadPermissions.has(permission))
  ));
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'display-capture' || (isVinacad(webContents) && vinacadPermissions.has(permission)));
  });
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: false,
      });
      const source = sources.find((item) => item.id.startsWith('screen:')) || sources[0];
      callback(source ? { video: source } : null);
    } catch {
      callback(null);
    }
  }, { useSystemPicker: true });
}

async function runPackagedSmokeTest() {
  const started = Date.now();
  const outDir = path.dirname(smokeTestOutPath);
  await fs.mkdir(outDir, { recursive: true });
  try {
    let uiLoaded = false;
    for (let i = 0; i < 40; i++) {
      const rootLen = await mainWindow?.webContents?.executeJavaScript('document.getElementById("root")?.innerHTML?.length || 0').catch(() => 0);
      if (rootLen > 50) { uiLoaded = true; break; }
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!uiLoaded) throw new Error('Giao diện chính (#root) không tải được trong smoke test.');
    const fullPreset = planner.presetPlan('Quay video ngắn giới thiệu kiểm soát layer: mở bảng Lớp, khoá layer A-DIMS, tắt hiển thị layer A-FURNITURE');
    const smokePlan = { title: 'Smoke Test Packaged Build', scenes: fullPreset.scenes.slice(0, 2) };
    const { plan: checked, errors } = planner.validatePlan(smokePlan, vinacadEngine.SAMPLE_CONTEXT);
    if (errors.length) throw new Error(errors.join(' '));
    const recStart = Date.now();
    const recorded = await director.recordPlan({
      plan: checked,
      context: vinacadEngine.SAMPLE_CONTEXT,
      drawingPath: '__BUILTIN_SAMPLE__',
      sessionsRoot: getSessionsRoot(),
    });
    const recordMs = Date.now() - recStart;
    const renStart = Date.now();
    const rendered = await renderForSession({ sessionId: recorded.sessionId, quality: '4K master', sceneOverrides: [], force: true });
    const renderMs = Date.now() - renStart;
    const stat = await fs.stat(rendered.path);
    if (!stat.size || stat.size < 50000) throw new Error(`Video smoke test quá nhỏ: ${stat.size} bytes`);
    const videoEvidencePath = path.join(outDir, 'smoke-test.mp4');
    await fs.copyFile(rendered.path, videoEvidencePath);
    const actions = recorded.timeline?.actions || [];
    const report = {
      ok: true,
      generatedAt: new Date().toISOString(),
      executablePath: process.execPath,
      isPackaged: app.isPackaged,
      uiLoaded,
      sessionId: recorded.sessionId,
      scenes: checked.scenes.length,
      actionsTotal: actions.length,
      actionsOk: actions.filter((a) => a.ok).length,
      recordMs,
      renderMs,
      totalMs: Date.now() - started,
      videoPath: videoEvidencePath,
      videoBytes: stat.size,
      encoder: rendered.encoder || null,
    };
    await fs.writeFile(smokeTestOutPath, JSON.stringify(report, null, 2), 'utf8');
    await closeVinacadWindow().catch(() => {});
    if (smokeUserDataDir) await fs.rm(smokeUserDataDir, { recursive: true, force: true }).catch(() => {});
    app.exit(0);
  } catch (error) {
    const failReport = {
      ok: false,
      generatedAt: new Date().toISOString(),
      executablePath: process.execPath,
      isPackaged: app.isPackaged,
      error: error?.stack || String(error),
    };
    await fs.writeFile(smokeTestOutPath, JSON.stringify(failReport, null, 2), 'utf8').catch(() => {});
    await closeVinacadWindow().catch(() => {});
    if (smokeUserDataDir) await fs.rm(smokeUserDataDir, { recursive: true, force: true }).catch(() => {});
    app.exit(1);
  }
}

app.whenReady().then(() => {
  registerMediaProtocol();
  configureDisplayCapture();
  if (process.env.VINACUT_NO_MAIN_WINDOW !== '1') createWindow();
  if (isSmokeTest) { void runPackagedSmokeTest(); return; }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.env.VINACUT_NO_MAIN_WINDOW === '1') return;
  if (process.platform !== 'darwin') app.quit();
});

module.exports = { buildAiRequest, callAiChatInternal, isStructuredSchemaError, isEffortUnsupportedError, normalizeReasoningEffort };
