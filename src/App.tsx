import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  Activity,
  Check,
  CircleCheck,
  CircleX,
  Clapperboard,
  Download,
  ExternalLink,
  FileCode2,
  Film,
  FolderOpen,
  Globe2,
  KeyRound,
  Library,
  ListChecks,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  TriangleAlert,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react';
import type {
  DwgFileItem,
  FocusRegion,
  PlanStep,
  ProductionProgress,
  ProductionVideo,
  RecordedAction,
  RecordedScene,
  SceneItem,
  SceneOverride,
  ShotPlan,
} from './vite-env';

const defaultModelCatalog: Record<string, string[]> = {
  Google: [
    'gemini-3.8-flash',
    'gemini-4-argon',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
  ],
  OpenAI: [
    'gpt-6.1-sol',
    'gpt-6-astra',
    'gpt-6.1-terra',
    'gpt-6-luna',
    'gpt-5.5',
    'gpt-5.4',
    'gpt-4.1',
    'gpt-4o',
  ],
  Anthropic: [
    'claude-sonnet-5-5',
    'claude-opus-5-5',
    'claude-fable-5-1',
    'claude-haiku-5-5',
    'claude-sonnet-4-20250514',
  ],
  Custom: [
    'claude-opus-5-5',
    'deepseek-v4.1-flash',
    'glm-5.3-flash',
    'minimax-m3.1-flash',
  ],
};

const modelDisplayLabels: Record<string, string> = {
  'gemini-3.8-flash': 'gemini-3.8-flash — Gemini 3.8 Flash (Mặc định · Nhanh)',
  'gemini-4-argon': 'gemini-4-argon — Gemini 4 Argon (Flagship · Suy luận sâu)',
  'gemini-3.6-flash': 'gemini-3.6-flash — Gemini 3.6 Flash',
  'gemini-3.5-flash-lite': 'gemini-3.5-flash-lite — Gemini 3.5 Flash Lite',
  'gemini-3.1-flash-lite': 'gemini-3.1-flash-lite — Gemini 3.1 Flash Lite',
  'gemini-2.5-pro': 'gemini-2.5-pro — Gemini 2.5 Pro (Legacy)',
  'gemini-2.5-flash': 'gemini-2.5-flash — Gemini 2.5 Flash (Legacy)',
  'gpt-6.1-sol': 'gpt-6.1-sol — GPT-6.1 Sol (Mặc định · Đa năng)',
  'gpt-6-astra': 'gpt-6-astra — GPT-6 Astra (Flagship · Suy luận & Agent)',
  'gpt-6.1-terra': 'gpt-6.1-terra — GPT-6.1 Terra',
  'gpt-6-luna': 'gpt-6-luna — GPT-6 Luna (Tối ưu chi phí)',
  'gpt-5.5': 'gpt-5.5 — GPT-5.5',
  'gpt-5.4': 'gpt-5.4 — GPT-5.4',
  'gpt-4.1': 'gpt-4.1 — GPT-4.1 (Legacy)',
  'gpt-4o': 'gpt-4o — GPT-4o (Legacy)',
  'claude-sonnet-5-5': 'claude-sonnet-5-5 — Claude Sonnet 5.5 (Mặc định · Cân bằng)',
  'claude-opus-5-5': 'claude-opus-5-5 — Claude Opus 5.5 (Flagship)',
  'claude-fable-5-1': 'claude-fable-5-1 — Claude Fable 5.1',
  'claude-haiku-5-5': 'claude-haiku-5-5 — Claude Haiku 5.5 (Nhanh)',
  'claude-sonnet-4-20250514': 'claude-sonnet-4-20250514 — Claude Sonnet 4 (Legacy)',
  'deepseek-v4.1-flash': 'deepseek-v4.1-flash — DeepSeek V4.1 Flash (Nhanh · Tiết kiệm)',
  'glm-5.3-flash': 'glm-5.3-flash — GLM 5.3 Flash (Đa phương thức · Nhanh)',
  'minimax-m3.1-flash': 'minimax-m3.1-flash — MiniMax M3.1 Flash (Đa phương thức · Nhanh)',
};

const scriptPresets = [
  {
    title: 'Quản lý & Đổi màu Layer',
    prompt:
      'Tạo video quảng cáo khoảng 30 giây cho tính năng Layer trên VinaCAD Web:\n1. Mở bảng Lớp ở thanh bên trái.\n2. Chọn layer A-WALLS và đổi tên thành A-WALLS-MAIN.\n3. Đổi màu layer A-WALLS-MAIN sang màu cam (#FFB347) để thấy tường trên bản vẽ đổi màu ngay.\n4. Quay về toàn cảnh mặt bằng, sau đó xoá layer trống TEMP-EMPTY.',
  },
  {
    title: 'Vẽ nhanh & Bắt điểm Osnap',
    prompt:
      'Tạo video quảng cáo tính năng vẽ nhanh với bắt điểm (Osnap) trên VinaCAD Web:\n1. Mở đầu bằng toàn cảnh mặt bằng.\n2. Vẽ một tủ bếp bằng lệnh RECTANG, bắt đúng góc tường trong bếp.\n3. Vẽ một đường LINE ngang phòng khách, cho thấy marker bắt điểm.\n4. Kết thúc ở toàn cảnh bản vẽ.',
  },
  {
    title: 'Khoá & Ẩn Layer',
    prompt:
      'Quay video ngắn giới thiệu kiểm soát layer: mở bảng Lớp, khoá layer A-DIMS để tránh sửa nhầm kích thước, tắt hiển thị layer A-FURNITURE để xem mặt bằng gọn hơn, rồi bật lại hiển thị.',
  },
];

const PANEL_VI: Record<string, string> = { Prop: 'Thuộc tính', Layers: 'Lớp', Blocks: 'Khối', XREF: 'XREF', Traces: 'Dấu vết', Activity: 'Hoạt động' };
const TINTS = ['blue', 'purple', 'orange', 'green', 'cyan'];

const formatTime = (seconds: number) => {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${remaining.toFixed(1).padStart(4, '0')}`;
};

const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function cleanUiError(error: unknown, fallback = 'Không kết nối được tới endpoint.'): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : fallback;
  const stripped = raw.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/i, '').trim();
  if (!stripped) return fallback;
  if (/^<!doctype\s+html/i.test(stripped) || /<html[\s>]/i.test(stripped)) {
    const titleMatch = stripped.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : 'HTML Error';
    return `Endpoint trả về trang HTML (${title}) thay vì JSON API. Hãy kiểm tra lại Base URL (ví dụ thêm /v1).`;
  }
  const singleLine = stripped.replace(/\s+/g, ' ').trim();
  return singleLine.length > 260 ? `${singleLine.slice(0, 257)}…` : singleLine;
}

function normalizeSavedModel(provider: string, rawModel?: string): string {
  const catalog = defaultModelCatalog[provider] || defaultModelCatalog.Google;
  if (!rawModel || rawModel === 'custom-model-id') return catalog[0];
  const upgradeMap: Record<string, string> = {
    'gemini-2.0-flash': 'gemini-3.8-flash',
    'gpt-4o-mini': 'gpt-6-luna',
    'o3-mini': 'gpt-6-astra',
    'claude-3-7-sonnet-latest': 'claude-sonnet-5-5',
    'claude-3-5-sonnet-latest': 'claude-sonnet-5-5',
  };
  return upgradeMap[rawModel] || rawModel;
}

function normalizeSavedBaseUrl(provider: string, rawUrl?: string): string {
  const trimmed = rawUrl?.trim() || '';
  if (provider === 'Google') {
    if (!trimmed || /\/v1$/i.test(trimmed)) return 'https://generativelanguage.googleapis.com/v1beta';
    return trimmed;
  }
  const fallback = provider === 'Anthropic'
    ? 'https://api.anthropic.com/v1'
    : provider === 'OpenAI'
      ? 'https://api.openai.com/v1'
      : 'https://api.kingofapi.store/v1';
  if (!trimmed) return fallback;
  const cleaned = trimmed
    .replace(/\/+$/, '')
    .replace(/\/v1\/chat\/completions$/i, '/v1')
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/v1\/messages$/i, '/v1')
    .replace(/\/messages$/i, '')
    .replace(/\/v1\/models$/i, '/v1')
    .replace(/\/models$/i, '');
  try {
    const u = new URL(cleaned);
    if (!u.pathname || u.pathname === '/') return `${cleaned}/v1`;
  } catch {
    // Keep partial user input
  }
  return cleaned;
}

function describeStep(step: PlanStep): string {
  const s = step as Record<string, unknown>;
  switch (step.type) {
    case 'open_panel':
      return `Mở bảng ${PANEL_VI[String(s.panel)] || s.panel}`;
    case 'select_layer':
    case 'set_current_layer':
      return `Chọn ${s.layer}`;
    case 'rename_layer':
      return `Đổi tên ${s.layer} → ${s.to}`;
    case 'set_layer_color':
      return `Màu ${s.layer} ${s.color}`;
    case 'toggle_layer':
      return `${s.property === 'locked' ? 'Khoá/mở' : 'Ẩn/hiện'} ${s.layer}`;
    case 'create_layer':
      return s.name ? `Tạo layer ${s.name}` : 'Tạo layer mới';
    case 'delete_layer':
      return `Xoá ${s.layer}`;
    case 'command': {
      const inputs = Array.isArray(s.inputs) ? s.inputs : [];
      const points = inputs.filter((i) => i && typeof i === 'object' && 'point' in i).length;
      return `Lệnh ${s.name}${points ? ` · ${points} điểm` : ''}`;
    }
    case 'hover':
      return 'Rê chuột bắt điểm';
    case 'select':
      return `Chọn ${Array.isArray(s.points) ? s.points.length : ''} đối tượng`;
    case 'zoom_extents':
      return 'Toàn cảnh';
    case 'zoom_to':
      return 'Phóng to vùng';
    case 'toggle_mode':
      return `Bật/tắt ${s.mode}`;
    case 'click':
      return `Bấm "${s.text}"`;
    case 'pause':
      return `Giữ ${s.seconds}s`;
    case 'escape':
      return 'Huỷ lệnh';
    default:
      return step.type;
  }
}

function estimateSceneSeconds(scene: ShotPlan['scenes'][number]): number {
  const stepSeconds = scene.steps.reduce((sum, step) => {
    if (step.type === 'pause') return sum + Number((step as Record<string, unknown>).seconds || 1);
    if (step.type === 'command') return sum + 4;
    if (step.type === 'rename_layer' || step.type === 'set_layer_color') return sum + 3.5;
    return sum + 1.6;
  }, 0);
  return Math.round(0.75 + stepSeconds + (scene.hold || 1.6));
}

function planToItems(plan: ShotPlan): SceneItem[] {
  let offset = 0;
  return plan.scenes.map((scene, index) => {
    const duration = estimateSceneSeconds(scene);
    const item: SceneItem = {
      id: `scene-${String(index + 1).padStart(2, '0')}`,
      label: scene.label,
      kicker: `~${clock(offset)} — ${clock(offset + duration)}`,
      description: scene.description,
      duration,
      focus: scene.focus || 'auto',
      status: 'draft',
      tint: TINTS[index % TINTS.length],
      steps: scene.steps.map((step) => ({ label: describeStep(step) })),
    };
    offset += duration;
    return item;
  });
}

function sessionToItems(scenes: RecordedScene[], actions: RecordedAction[], plan: ShotPlan | null): SceneItem[] {
  return scenes.map((scene, index) => {
    const sceneActions = actions.filter((a) => a.scene === index);
    const planSteps = plan?.scenes[index]?.steps || [];
    return {
      id: `scene-${String(index + 1).padStart(2, '0')}`,
      label: scene.label,
      kicker: `${clock(scene.start)} — ${clock(scene.end)}`,
      description: scene.description,
      duration: Math.max(1, Math.round((scene.end - scene.start) * 10) / 10),
      focus: scene.focus || 'auto',
      status: sceneActions.every((a) => a.ok) ? 'verified' : 'failed',
      tint: TINTS[index % TINTS.length],
      steps: sceneActions.map((action, i) => ({
        label: planSteps[i] ? describeStep(planSteps[i]) : action.intent,
        ok: action.ok,
      })),
    };
  });
}

function recomputeFootageKickers(list: SceneItem[]): SceneItem[] {
  let offset = 0;
  return list.map((scene, index) => {
    const dur = Math.max(2, Math.min(60, Math.round(Number(scene.duration) || 6)));
    const item: SceneItem = {
      ...scene,
      duration: dur,
      kicker: `${clock(offset)} — ${clock(offset + dur)}`,
      tint: TINTS[index % TINTS.length],
    };
    offset += dur;
    return item;
  });
}

function withEdits(base: ShotPlan, items: SceneItem[]): ShotPlan {
  return {
    ...base,
    scenes: base.scenes.map((scene, index) => (items[index]
      ? { ...scene, label: items[index].label, description: items[index].description, focus: items[index].focus }
      : scene)),
  };
}

const PHASE_LABEL: Record<ProductionProgress['phase'], string> = {
  load: 'Mở VinaCAD',
  plan: 'Lên kịch bản',
  record: 'Quay 4K',
  render: 'Dựng video',
};

function App() {
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState('');
  const [prompt, setPrompt] = useState(scriptPresets[0].prompt);
  const [busy, setBusy] = useState<null | 'plan' | 'record' | 'render' | 'export'>(null);
  const [progress, setProgress] = useState<ProductionProgress | null>(null);

  const [plan, setPlan] = useState<ShotPlan | null>(null);
  const [planContext, setPlanContext] = useState<unknown>(null);
  const [planSource, setPlanSource] = useState<'ai' | 'preset' | null>(null);
  const [session, setSession] = useState<{ sessionId: string; title: string; duration: number; scenes: RecordedScene[]; actions: RecordedAction[] } | null>(null);
  const [video, setVideo] = useState<ProductionVideo | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showUtilities, setShowUtilities] = useState(false);
  const [isPreparingVinacad, setIsPreparingVinacad] = useState(false);

  const [modelCatalog, setModelCatalog] = useState<Record<string, string[]>>(defaultModelCatalog);
  const [provider, setProvider] = useState('Google');
  const [model, setModel] = useState('gemini-3.8-flash');
  const [customModelMode, setCustomModelMode] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://generativelanguage.googleapis.com/v1beta');
  const [connectionTesting, setConnectionTesting] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState(
    'Dán API Key rồi bấm kiểm tra để xác thực endpoint và đồng bộ model đang khả dụng từ nhà cung cấp.',
  );
  const [lastError, setLastError] = useState('');
  const [toast, setToast] = useState('');

  const [dwgFiles, setDwgFiles] = useState<DwgFileItem[]>([
    { name: 'Sample_FloorPlan_ISO.dwg (Mặt bằng mẫu tích hợp)', path: '__BUILTIN_SAMPLE__', sizeLabel: 'Mẫu chuẩn MKT', isBuiltin: true },
  ]);
  const [selectedDwgPath, setSelectedDwgPath] = useState('__BUILTIN_SAMPLE__');

  const [isPlaying, setIsPlaying] = useState(false);
  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [quality, setQuality] = useState('4K master');

  // Manually imported or recorded footage (secondary path: captions only).
  const [footageBytes, setFootageBytes] = useState<Uint8Array | null>(null);
  const [footageSrc, setFootageSrc] = useState('');
  const [footageName, setFootageName] = useState('');

  const [knowledgeName, setKnowledgeName] = useState('project-playbook.md');
  const [knowledgeText, setKnowledgeText] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const knowledgeFileInputRef = useRef<HTMLInputElement>(null);
  const nativeCaptureActiveRef = useRef(false);
  const autoVinacadCaptureActiveRef = useRef(false);

  const mode: 'session' | 'footage' | 'plan' | 'empty' = video ? 'session' : footageSrc ? 'footage' : plan ? 'plan' : 'empty';
  const previewSrc = video?.url || footageSrc;
  const hasFootage = Boolean(previewSrc);
  const totalDuration = useMemo(
    () => (mode === 'session' && session ? Math.round(session.duration) : scenes.reduce((sum, scene) => sum + scene.duration, 0)),
    [mode, session, scenes],
  );
  const qualityLabel = quality === '1080p social' ? 'Full HD 1080p' : quality === 'Vertical cut' ? 'Dọc 9:16' : '4K 60fps';
  const verifiedCount = session ? session.actions.filter((a) => a.ok).length : 0;

  const activePlaybackScene = useMemo(() => {
    if (!scenes.length) return null;
    if (isPlaying && mode === 'session' && session) {
      const hit = session.scenes.findIndex((scene) => videoTime >= scene.start && videoTime < scene.end);
      if (hit >= 0) return scenes[hit] ?? null;
    }
    return scenes.find((scene) => scene.id === selectedSceneId) ?? scenes[0];
  }, [scenes, selectedSceneId, isPlaying, videoTime, mode, session]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!window.vinacut?.onProductionProgress) return;
    return window.vinacut.onProductionProgress((data) => setProgress(data));
  }, []);

  useEffect(() => {
    window.vinacut?.listRecentDwgs?.()
      .then((items) => {
        if (Array.isArray(items) && items.length > 0) setDwgFiles(items);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setVideoTime(0);
    setVideoDuration(0);
    setIsPlaying(false);
  }, [previewSrc]);

  useEffect(() => {
    const savedConfig = localStorage.getItem('vinacut-ai-config');
    const savedProject = localStorage.getItem('vinacut-project');
    const savedKnowledge = localStorage.getItem('vinacut-knowledge');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        const nextProvider = config.provider || 'Google';
        const nextBase = normalizeSavedBaseUrl(nextProvider, config.baseUrl);
        const nextModel = normalizeSavedModel(nextProvider, config.model);
        setProvider(nextProvider);
        setBaseUrl(nextBase);
        setModel(nextModel);
        if (nextModel && nextModel !== 'custom-model-id') {
          setModelCatalog((prev) => {
            const existing = prev[nextProvider] || defaultModelCatalog[nextProvider] || [];
            return existing.includes(nextModel) ? prev : { ...prev, [nextProvider]: [nextModel, ...existing] };
          });
        }
        if (config.apiKey) setApiKey(String(config.apiKey));
      } catch {
        // Keep safe defaults
      }
    }
    if (savedProject) {
      try {
        const project = JSON.parse(savedProject);
        if (project.prompt) setPrompt(project.prompt);
        if (['4K master', '1080p social', 'Vertical cut'].includes(project.quality)) setQuality(project.quality);
        if (project.selectedDwgPath) setSelectedDwgPath(project.selectedDwgPath);
        if (project.plan && Array.isArray(project.plan.scenes)) {
          setPlan(project.plan);
          setPlanContext(project.planContext ?? null);
          setPlanSource(project.planSource ?? null);
          setScenes(planToItems(project.plan));
        }
      } catch {
        // Ignore stale project data
      }
    }
    if (savedKnowledge) {
      try {
        const knowledge = JSON.parse(savedKnowledge);
        if (knowledge.name && knowledge.text) {
          setKnowledgeName(knowledge.name);
          setKnowledgeText(knowledge.text);
          return;
        }
      } catch {
        // Fall back to bundled playbook
      }
    }
    fetch('./knowledge/project-playbook.md')
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error('Playbook unavailable'))))
      .then((text) => setKnowledgeText(text))
      .catch(() => setKnowledgeText(''));
  }, []);

  useEffect(() => {
    if (!footageBytes || footageBytes.byteLength < 1024) return;
    const copy = new Uint8Array(footageBytes.byteLength);
    copy.set(footageBytes);
    const url = URL.createObjectURL(new Blob([copy.buffer as ArrayBuffer], { type: 'video/mp4' }));
    setFootageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [footageBytes]);

  const persistAiConfig = (nextProvider = provider, nextModel = model, nextBaseUrl = baseUrl, nextKey = apiKey) => {
    localStorage.setItem('vinacut-ai-config', JSON.stringify({ provider: nextProvider, model: nextModel, baseUrl: nextBaseUrl, apiKey: nextKey }));
  };

  const mergeDiscoveredModels = (targetProvider: string, discovered: string[]) => {
    if (!Array.isArray(discovered) || !discovered.length) return;
    setModelCatalog((prev) => {
      const existing = prev[targetProvider] || defaultModelCatalog[targetProvider] || [];
      return { ...prev, [targetProvider]: Array.from(new Set([...existing, ...discovered])) };
    });
  };

  const refreshModelsFromApi = async () => {
    if (!window.vinacut?.listModels || loadingModels) return;
    setLoadingModels(true);
    const normalizedBase = normalizeSavedBaseUrl(provider, baseUrl);
    if (normalizedBase !== baseUrl) setBaseUrl(normalizedBase);
    try {
      const discovered = await window.vinacut.listModels({ provider, baseUrl: normalizedBase, apiKey: apiKey.trim() });
      if (Array.isArray(discovered) && discovered.length > 0) {
        mergeDiscoveredModels(provider, discovered);
        if (!model || model === 'custom-model-id') setModel(discovered[0]);
        setConnectionMessage(`Đã đồng bộ ${discovered.length} model trực tiếp từ API ${provider} (${discovered.slice(0, 4).join(', ')}).`);
        setToast(`Đã đồng bộ ${discovered.length} model từ API ${provider}.`);
      } else {
        setToast(`Giữ danh sách model mặc định của ${provider} (dán API Key để đồng bộ thêm).`);
      }
    } catch {
      setToast('Giữ danh sách model mặc định.');
    } finally {
      setLoadingModels(false);
    }
  };

  const handleProviderChange = (nextProvider: string) => {
    setCustomModelMode(false);
    setProvider(nextProvider);
    const nextModels = modelCatalog[nextProvider] || defaultModelCatalog[nextProvider] || defaultModelCatalog.Google;
    const nextModel = nextModels[0];
    const nextBase = normalizeSavedBaseUrl(nextProvider);
    setModel(nextModel);
    setBaseUrl(nextBase);
    persistAiConfig(nextProvider, nextModel, nextBase, apiKey);
  };

  const handleModelChange = (nextModel: string) => {
    if (nextModel === '__custom') {
      setCustomModelMode(true);
      setModel('');
      return;
    }
    setCustomModelMode(false);
    setModel(nextModel);
    persistAiConfig(provider, nextModel, baseUrl, apiKey);
  };

  const handlePickDwg = async () => {
    if (!window.vinacut?.pickDwg) {
      setToast('Chọn file DWG chỉ khả dụng trong app Electron.');
      return;
    }
    try {
      const picked = await window.vinacut.pickDwg();
      if (!picked) return;
      setDwgFiles((current) => (current.some((item) => item.path === picked.path) ? current : [picked, ...current]));
      setSelectedDwgPath(picked.path);
      setToast(`Đã chọn bản vẽ: ${picked.name}`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Không chọn được file bản vẽ.');
    }
  };

  const handlePrepareVinacad = async () => {
    if (!window.vinacut?.vinacadPrepare || isPreparingVinacad) return;
    setIsPreparingVinacad(true);
    setToast('Đang mở VinaCAD Web và nạp bản vẽ…');
    try {
      const res = await window.vinacut.vinacadPrepare({ dwgPath: selectedDwgPath, visible: true });
      setToast(res.message || 'Đã mở sẵn cửa sổ VinaCAD Web.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Không mở được VinaCAD Web.');
    } finally {
      setIsPreparingVinacad(false);
    }
  };

  const handleCloseVinacad = async () => {
    if (!window.vinacut?.vinacadClose) return;
    try {
      await window.vinacut.vinacadClose();
      setToast('Đã đóng cửa sổ VinaCAD.');
    } catch {
      setToast('Không có cửa sổ VinaCAD nào đang mở.');
    }
  };

  const failWith = (error: unknown, fallback: string) => {
    const message = cleanUiError(error, fallback);
    setLastError(message);
    setToast(`Lỗi: ${message}`);
  };

  const sceneOverrides = (): SceneOverride[] => scenes.map((item) => ({ description: item.description, focus: item.focus }));

  const requestPlan = async (): Promise<{ plan: ShotPlan; context: unknown } | null> => {
    if (!window.vinacut?.planVideo) {
      setToast('Hãy chạy trong cửa sổ Desktop Electron để AI điều khiển VinaCAD.');
      return null;
    }
    if (!prompt.trim()) {
      setToast('Hãy nhập kịch bản/prompt trước.');
      return null;
    }
    const cleanKey = apiKey.trim();
    const normalizedBase = normalizeSavedBaseUrl(provider, baseUrl);
    if (normalizedBase !== baseUrl) setBaseUrl(normalizedBase);
    if (cleanKey) persistAiConfig(provider, model, normalizedBase, cleanKey);
    setBusy('plan');
    setLastError('');
    setProgress({ phase: 'plan', message: cleanKey ? 'AI đang đọc brief và lên kịch bản…' : 'Đang tìm kịch bản mẫu phù hợp…' });
    try {
      const res = await window.vinacut.planVideo({
        provider,
        baseUrl: normalizedBase,
        apiKey: cleanKey,
        model: model.trim(),
        prompt,
        knowledge: knowledgeText.trim(),
        dwgPath: selectedDwgPath,
      });
      setPlan(res.plan);
      setPlanContext(res.context);
      setPlanSource(res.source);
      setSession(null);
      setVideo(null);
      setFootageBytes(null);
      setFootageSrc('');
      const items = planToItems(res.plan);
      setScenes(items);
      setSelectedSceneId(items[0]?.id || '');
      setToast(res.message);
      return { plan: res.plan, context: res.context };
    } catch (error) {
      failWith(error, 'Không lập được kịch bản.');
      return null;
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const recordAndRender = async (planArg?: ShotPlan, contextArg?: unknown) => {
    const base = planArg ?? (plan ? withEdits(plan, scenes) : null);
    if (!base || !window.vinacut?.recordPlan) return;
    setBusy('record');
    setLastError('');
    setProgress({ phase: 'load', message: 'Đang mở VinaCAD Web ở chế độ quay 4K ngầm…' });
    try {
      const res = await window.vinacut.recordPlan({
        plan: base,
        context: contextArg ?? planContext,
        dwgPath: selectedDwgPath,
        quality,
      });
      setPlan(base);
      setSession({
        sessionId: res.sessionId,
        title: res.timeline.title,
        duration: res.timeline.duration,
        scenes: res.timeline.scenes,
        actions: res.timeline.actions,
      });
      setVideo(res.video);
      setFootageBytes(null);
      setFootageSrc('');
      const items = sessionToItems(res.timeline.scenes, res.timeline.actions, base);
      setScenes(items);
      setSelectedSceneId(items[0]?.id || '');
      setToast(`Hoàn tất! Video ${res.video.width}×${res.video.height} · ${res.timeline.actions.length} thao tác đã kiểm chứng.`);
    } catch (error) {
      failWith(error, 'Quay video thất bại.');
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const runOneClick = async () => {
    if (busy) return;
    if (isCapturing) {
      setToast('Bạn đang quay thủ công. Hãy bấm "Dừng quay" trước.');
      return;
    }
    const planned = plan && mode === 'plan' ? { plan: withEdits(plan, scenes), context: planContext } : await requestPlan();
    if (planned) await recordAndRender(planned.plan, planned.context);
  };

  const reRender = async () => {
    if (busy) return;
    if (mode === 'session' && session && window.vinacut?.renderSession) {
      setBusy('render');
      setProgress({ phase: 'render', percent: 0, message: 'Đang dựng lại với phụ đề & góc máy mới…' });
      try {
        const res = await window.vinacut.renderSession({ sessionId: session.sessionId, quality, sceneOverrides: sceneOverrides() });
        setVideo(res.video);
        setToast('Đã dựng lại video (không cần quay lại).');
      } catch (error) {
        failWith(error, 'Không dựng lại được video.');
      } finally {
        setBusy(null);
        setProgress(null);
      }
      return;
    }
    if (mode === 'footage' && footageBytes && window.vinacut?.renderEditedVideo) {
      setBusy('render');
      setProgress({ phase: 'render', message: 'FFmpeg đang chèn phụ đề vào footage…' });
      try {
        const result = await window.vinacut.renderEditedVideo({
          videoData: footageBytes,
          scenes: scenes.map((s) => ({ label: s.label, description: s.description, duration: s.duration, focus: s.focus })),
          quality,
        });
        setFootageBytes(result.video);
        setToast('Đã chèn phụ đề vào footage.');
      } catch (error) {
        failWith(error, 'Không dựng được footage.');
      } finally {
        setBusy(null);
        setProgress(null);
      }
    }
  };

  const stopProduction = async () => {
    await window.vinacut?.cancelProduction?.().catch(() => false);
    setToast('Đang dừng tác vụ…');
  };

  const updateSceneField = (id: string, patch: Partial<SceneItem>) => {
    setScenes((current) => {
      const next = current.map((scene) => (scene.id === id ? { ...scene, ...patch } : scene));
      return mode === 'footage' ? recomputeFootageKickers(next) : next;
    });
  };

  const addFootageScene = () => {
    const id = `scene-${Date.now()}`;
    const nextScene: SceneItem = {
      id,
      label: `Cảnh ${scenes.length + 1}`,
      kicker: '',
      description: 'Nhập phụ đề sẽ hiển thị ở cảnh này.',
      duration: 6,
      focus: 'full',
      status: 'ready',
      tint: 'cyan',
    };
    setScenes(recomputeFootageKickers([...scenes, nextScene]));
    setSelectedSceneId(id);
  };

  const deleteScene = (id: string) => {
    const index = scenes.findIndex((s) => s.id === id);
    if (index < 0) return;
    if (mode === 'session') {
      setToast('Video đã quay: hãy sửa phụ đề/góc máy rồi dựng lại, hoặc quay lại với kịch bản mới.');
      return;
    }
    if (scenes.length <= 1) {
      setToast('Cần giữ lại ít nhất 1 cảnh.');
      return;
    }
    const filtered = scenes.filter((s) => s.id !== id);
    if (mode === 'plan' && plan) {
      const edited = withEdits(plan, scenes);
      const nextPlan = { ...edited, scenes: edited.scenes.filter((_, i) => i !== index) };
      setPlan(nextPlan);
      const items = planToItems(nextPlan);
      setScenes(items);
      setSelectedSceneId(items[0]?.id || '');
      return;
    }
    setScenes(recomputeFootageKickers(filtered));
    if (selectedSceneId === id) setSelectedSceneId(filtered[0].id);
  };

  const handlePlay = async () => {
    const element = videoRef.current;
    if (!element) return;
    if (element.paused) {
      try {
        await element.play();
        setIsPlaying(true);
      } catch {
        setToast('Không thể phát video này trong preview.');
      }
    } else {
      element.pause();
      setIsPlaying(false);
    }
  };

  const seekTo = (nextTime: number) => {
    setVideoTime(nextTime);
    if (videoRef.current) videoRef.current.currentTime = nextTime;
  };

  const seekVideo = (event: ChangeEvent<HTMLInputElement>) => seekTo(Number(event.target.value));

  const saveProject = () => {
    localStorage.setItem(
      'vinacut-project',
      JSON.stringify({ prompt, quality, selectedDwgPath, plan: plan ? withEdits(plan, scenes) : null, planContext, planSource }),
    );
    persistAiConfig(provider, model, baseUrl, apiKey);
    setToast('Đã lưu kịch bản, cấu hình AI và project vào máy.');
  };

  const exportVideo = async () => {
    if (busy) return;
    setShowExport(false);
    if (mode === 'session' && session && window.vinacut?.exportSession) {
      setBusy('export');
      setProgress({ phase: 'render', percent: 0, message: `Đang dựng bản ${qualityLabel} để xuất…` });
      try {
        const saved = await window.vinacut.exportSession({
          sessionId: session.sessionId,
          quality,
          sceneOverrides: sceneOverrides(),
          defaultName: `VinaCAD_${(session.title || 'MKT').replace(/[^\w-]+/g, '_')}_${quality.replace(/\s+/g, '-')}.mp4`,
        });
        setToast(saved ? `Đã xuất video: ${saved}` : 'Đã huỷ xuất video.');
      } catch (error) {
        failWith(error, 'Xuất video thất bại.');
      } finally {
        setBusy(null);
        setProgress(null);
      }
      return;
    }
    if (mode === 'footage' && footageBytes && window.vinacut?.saveFile) {
      setBusy('export');
      try {
        let data = footageBytes;
        if (window.vinacut.renderEditedVideo && scenes.some((s) => s.description.trim())) {
          const rendered = await window.vinacut.renderEditedVideo({
            videoData: footageBytes,
            scenes: scenes.map((s) => ({ label: s.label, description: s.description, duration: s.duration, focus: s.focus })),
            quality,
          });
          data = rendered.video;
        }
        const savedPath = await window.vinacut.saveFile({ defaultPath: `VinaCAD_MKT_${quality.replace(/\s+/g, '-')}.mp4`, data });
        setToast(savedPath ? `Đã xuất video: ${savedPath}` : 'Đã huỷ xuất video.');
      } catch (error) {
        failWith(error, 'Xuất video thất bại.');
      } finally {
        setBusy(null);
      }
      return;
    }
    setToast('Chưa có video để xuất. Hãy "Quay & dựng" trước.');
  };

  const testConnection = async () => {
    if (connectionTesting) return;
    const cleanApiKey = apiKey.trim();
    if (!cleanApiKey) {
      setConnectionMessage('Hãy dán API Key (Google AI Studio, OpenAI, Anthropic hoặc Custom API) trước khi kiểm tra.');
      return;
    }
    if (!window.vinacut?.testConnection) {
      setConnectionMessage('Hãy chạy ứng dụng bằng cửa sổ Electron để kiểm tra kết nối.');
      return;
    }
    const normalizedBase = normalizeSavedBaseUrl(provider, baseUrl);
    if (normalizedBase !== baseUrl) setBaseUrl(normalizedBase);
    setConnectionTesting(true);
    setConnectionMessage('Đang kiểm tra kết nối và đồng bộ danh sách model…');
    try {
      const res = await window.vinacut.testConnection({ provider, baseUrl: normalizedBase, apiKey: cleanApiKey, model: model.trim() });
      if (Array.isArray(res.models) && res.models.length > 0) mergeDiscoveredModels(provider, res.models);
      const finalModel = res.model || model.trim();
      const finalBase = res.baseUrl || normalizedBase;
      if (finalModel && finalModel !== model.trim()) setModel(finalModel);
      if (finalBase && finalBase !== baseUrl) setBaseUrl(finalBase);
      persistAiConfig(provider, finalModel, finalBase, cleanApiKey);
      const cleanMsg = cleanUiError(res.message, 'Đã kiểm tra kết nối.');
      setConnectionMessage(cleanMsg);
      if (res.ok === false) {
        setLastError(cleanMsg);
        setToast('Đã đồng bộ model & lưu cấu hình, nhưng gọi thử API báo lỗi.');
      } else {
        setLastError('');
        setToast('Đã kết nối và lưu API Key.');
      }
    } catch (error) {
      const msg = cleanUiError(error, 'Không kết nối được tới endpoint.');
      setConnectionMessage(`Lỗi: ${msg}`);
    } finally {
      setConnectionTesting(false);
    }
  };

  const useFootage = (data: Uint8Array | null, fileName: string) => {
    if (!data || data.byteLength < 1024) {
      setToast('File quay không có khung hình. Hãy thử lại.');
      return;
    }
    setVideo(null);
    setSession(null);
    setFootageBytes(data);
    setFootageName(fileName);
    if (mode !== 'footage') {
      setScenes(recomputeFootageKickers([{
        id: 'scene-footage-1',
        label: 'Cảnh 1',
        kicker: '',
        description: '',
        duration: 6,
        focus: 'full',
        status: 'ready',
        tint: 'blue',
      }]));
    }
    setToast(`Đã nạp footage: ${fileName}. Thêm phụ đề ở bảng phân cảnh rồi bấm "Chèn phụ đề".`);
  };

  const importReference = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    useFootage(new Uint8Array(await file.arrayBuffer()), file.name);
  };

  const importKnowledge = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      if (!text.trim()) {
        setToast('File playbook (.md) đang trống.');
        return;
      }
      setKnowledgeName(file.name);
      setKnowledgeText(text);
      localStorage.setItem('vinacut-knowledge', JSON.stringify({ name: file.name, text }));
      setToast(`Đã nạp playbook: ${file.name}`);
    };
    reader.onerror = () => setToast('Không đọc được file playbook.');
    reader.readAsText(file);
    event.target.value = '';
  };

  const stopCapture = () => {
    if (autoVinacadCaptureActiveRef.current && window.vinacut?.vinacadCaptureStop) {
      autoVinacadCaptureActiveRef.current = false;
      setIsCapturing(false);
      setToast('Đang hoàn tất footage VinaCAD…');
      window.vinacut
        .vinacadCaptureStop()
        .then((data) => useFootage(data, 'vinacad-web-capture.mp4'))
        .catch((error) => setToast(error instanceof Error ? error.message : 'Không thể hoàn tất footage VinaCAD.'));
      return;
    }
    if (nativeCaptureActiveRef.current && window.vinacut?.nativeCaptureStop) {
      nativeCaptureActiveRef.current = false;
      setIsCapturing(false);
      window.vinacut
        .nativeCaptureStop()
        .then((data) => useFootage(data, 'screen-capture.mp4'))
        .catch((error) => setToast(error instanceof Error ? error.message : 'Không thể hoàn tất file quay.'));
    }
  };

  const startVinacadCapture = async () => {
    if (!window.vinacut?.vinacadCaptureStart) {
      setToast('Quay thủ công chỉ khả dụng trong bản Desktop Electron.');
      return;
    }
    try {
      await window.vinacut.vinacadCaptureStart({ dwgPath: selectedDwgPath });
      autoVinacadCaptureActiveRef.current = true;
      setIsCapturing(true);
      setToast('Đã mở VinaCAD Web và bắt đầu quay. Bấm "Dừng quay" khi xong.');
    } catch (error) {
      setToast(error instanceof Error ? `Không mở được VinaCAD: ${error.message}` : 'Không mở được VinaCAD Web.');
    }
  };

  const busyLabel = busy === 'plan' ? 'AI đang lên kịch bản…' : busy === 'record' ? 'Đang quay & dựng 4K…' : busy === 'render' ? 'Đang dựng lại…' : 'Đang xuất…';
  const progressPercent = progress?.percent !== undefined
    ? progress.percent
    : progress?.phase === 'record' && progress.total
      ? ((progress.scene || 0) - 0.5) / progress.total
      : null;
  const mainAction = plan && mode === 'plan' ? () => recordAndRender() : runOneClick;

  return (
    <div className="app-shell simple-shell">
      <header className="simple-header">
        <div className="brand-lockup">
          <div className="brand-mark">
            <img src="./assets/vinacad.png" alt="VinaCAD" />
          </div>
          <div>
            <div className="brand-name">VinaCut AI Studio</div>
            <div className="brand-subtitle">Prompt → video demo VinaCAD 4K, thao tác thật & đã kiểm chứng</div>
          </div>
        </div>

        <div className="project-context">
          <span className="status-dot" />
          <strong>{dwgFiles.find((d) => d.path === selectedDwgPath)?.name.replace(/\s*\(.*\)$/, '') || 'Sample_FloorPlan_ISO.dwg'}</strong>
          <span>·</span>
          <span>
            {scenes.length} cảnh · {totalDuration}s · {qualityLabel}
          </span>
        </div>

        <div className="simple-header-actions">
          <button className={`ghost-button header-key-btn ${apiKey.trim() ? 'connected' : 'missing'}`} onClick={() => setShowSettings(true)}>
            <KeyRound size={13} />
            {apiKey.trim() ? `${provider} · ${model}` : 'Dán API Key AI'}
          </button>
          <button
            className="ghost-button"
            onClick={handlePrepareVinacad}
            disabled={isPreparingVinacad || Boolean(busy)}
            title="Mở cửa sổ VinaCAD Web để xem bản vẽ hoặc quay thủ công"
          >
            <ExternalLink size={13} />
            {isPreparingVinacad ? 'Đang mở…' : 'Mở VinaCAD'}
          </button>
          <button className="primary-button" onClick={() => setShowExport(true)} disabled={!hasFootage || Boolean(busy)}>
            <Download size={13} /> Xuất video
          </button>
          <button className="icon-button" onClick={() => setShowUtilities((current) => !current)} aria-label="Mở công cụ project">
            <MoreHorizontal size={17} />
          </button>
          {showUtilities && (
            <div className="utility-menu">
              <button
                onClick={() => {
                  setShowSettings(true);
                  setShowUtilities(false);
                }}
              >
                <Settings2 size={15} /> Cấu hình AI <span>{provider}</span>
              </button>
              <button
                onClick={() => {
                  knowledgeFileInputRef.current?.click();
                  setShowUtilities(false);
                }}
              >
                <Library size={15} /> Nạp playbook .md <span>{knowledgeText ? 'đã nạp' : 'chưa có'}</span>
              </button>
              <button
                onClick={() => {
                  saveProject();
                  setShowUtilities(false);
                }}
              >
                <Save size={15} /> Lưu project
              </button>
              <button
                onClick={() => {
                  handleCloseVinacad();
                  setShowUtilities(false);
                }}
              >
                <X size={15} /> Đóng cửa sổ VinaCAD
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="simple-main">
        <section className="simple-studio-grid">
          <div className="simple-preview-column">
            <div className="preview-card">
              <div className="preview-toolbar">
                <div className="toolbar-left">
                  <span className="live-indicator">
                    <span /> XEM TRƯỚC
                  </span>
                  <span className="toolbar-divider" />
                  <span title={video ? session?.title : footageName}>
                    {video ? `${session?.title || 'VinaCAD'} · ${video.width}×${video.height}` : footageName || 'Chưa có video'}
                  </span>
                </div>
                <div className="toolbar-right">
                  <button
                    className={`capture-button ${isCapturing ? 'recording' : 'auto-capture'}`}
                    onClick={isCapturing ? stopCapture : startVinacadCapture}
                    disabled={Boolean(busy)}
                  >
                    {isCapturing ? (
                      <>
                        <Square size={12} fill="currentColor" /> Dừng quay
                      </>
                    ) : (
                      <>
                        <Globe2 size={12} /> Quay thủ công
                      </>
                    )}
                  </button>
                  <button className="capture-button" title="Nạp video có sẵn để chèn phụ đề" onClick={() => fileInputRef.current?.click()} disabled={Boolean(busy)}>
                    <Upload size={12} /> Nạp video có sẵn
                  </button>
                </div>
                <input ref={fileInputRef} className="hidden-file-input" type="file" accept="video/*" onChange={importReference} />
              </div>

              <div className="video-stage">
                {hasFootage ? (
                  <>
                    <video
                      ref={videoRef}
                      className="reference-video"
                      src={previewSrc}
                      onLoadedMetadata={(event) => setVideoDuration(event.currentTarget.duration)}
                      onTimeUpdate={(event) => setVideoTime(event.currentTarget.currentTime)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={(event) => {
                        setIsPlaying(false);
                        setVideoTime(event.currentTarget.duration);
                      }}
                    />
                    <div className="video-top-badges">
                      <span>VinaCAD Web</span>
                      <span className="badge-separator">•</span>
                      <span>
                        {video
                          ? `${video.width >= 3840 ? '4K' : video.height > video.width ? 'Dọc 9:16' : '1080p'} · 60fps · ${verifiedCount}/${session?.actions.length || 0} thao tác ✓`
                          : 'Footage nhập vào'}
                      </span>
                    </div>
                    <button className="play-overlay" onClick={handlePlay} aria-label={isPlaying ? 'Tạm dừng preview' : 'Phát preview'}>
                      {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                    </button>
                  </>
                ) : (
                  <div className="empty-video-state">
                    <div className="empty-video-icon">
                      <Film size={24} />
                    </div>
                    <strong>{plan ? 'Kịch bản đã sẵn sàng — bấm "Quay & dựng 4K"' : 'Viết kịch bản, AI sẽ tự quay VinaCAD và dựng video 4K'}</strong>
                    <span>
                      Mọi thao tác được thực hiện trên giao diện VinaCAD thật và được kiểm chứng; bước nào không làm được sẽ báo lỗi rõ ràng thay vì dựng video sai.
                    </span>
                    <div className="empty-video-actions">
                      <button className="primary-button" onClick={mainAction} disabled={Boolean(busy)}>
                        <WandSparkles size={14} /> {plan ? 'Quay & dựng 4K' : 'Tự động lên kịch bản & quay'}
                      </button>
                      <button className="empty-video-action" onClick={() => fileInputRef.current?.click()} disabled={Boolean(busy)}>
                        <Upload size={14} /> Hoặc nạp video có sẵn
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {hasFootage ? (
                <div className="preview-controls">
                  <div className="scrubber">
                    <span className="scrubber-fill" style={{ width: `${videoDuration ? (videoTime / videoDuration) * 100 : 0}%` }} />
                    <span className="scrubber-knob" style={{ left: `${videoDuration ? (videoTime / videoDuration) * 100 : 0}%` }} />
                    <input
                      aria-label="Tua video"
                      type="range"
                      min="0"
                      max={videoDuration || 1}
                      step="0.05"
                      value={Math.min(videoTime, videoDuration || 1)}
                      onChange={seekVideo}
                    />
                  </div>
                  <div className="control-row">
                    <span>{formatTime(videoTime)}</span>
                    <span className="control-center">
                      <button onClick={() => seekTo(Math.max(0, videoTime - 5))} aria-label="Lùi 5 giây">
                        <RotateCcw size={14} />
                      </button>
                      <button className="small-play" onClick={handlePlay}>
                        {isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
                      </button>
                      <button onClick={() => seekTo(Math.min(videoDuration || 0, videoTime + 5))} aria-label="Tiến 5 giây">
                        <RotateCcw size={14} className="flip-icon" />
                      </button>
                    </span>
                    <span>{formatTime(videoDuration)}</span>
                  </div>
                </div>
              ) : (
                <div className="preview-empty-controls">
                  Quay offscreen 3840×2160 · chuột/bàn phím thật · camera tự lấy khung theo thao tác · phụ đề tiếng Việt · xuất 4K / 1080p / dọc 9:16.
                </div>
              )}
            </div>

            <div className="storyboard-card">
              <div className="storyboard-header">
                <div>
                  <span className="section-kicker">
                    {mode === 'session'
                      ? `ĐÃ QUAY · ${verifiedCount}/${session?.actions.length || 0} THAO TÁC ĐÃ KIỂM CHỨNG`
                      : mode === 'plan'
                        ? `KỊCH BẢN ${planSource === 'ai' ? 'DO AI LẬP' : 'MẪU OFFLINE'} · DUYỆT RỒI BẤM QUAY`
                        : mode === 'footage'
                          ? 'PHỤ ĐỀ CHO FOOTAGE NHẬP VÀO'
                          : 'PHÂN CẢNH'}
                  </span>
                  <h3>
                    {plan?.title && mode !== 'footage' ? `${plan.title} · ` : ''}
                    {scenes.length} cảnh · {totalDuration}s
                  </h3>
                </div>
                <div className="storyboard-actions">
                  {mode === 'footage' && (
                    <button className="small-ghost" onClick={addFootageScene}>
                      <Plus size={13} /> Thêm cảnh
                    </button>
                  )}
                  {(mode === 'session' || mode === 'footage') && (
                    <button className="primary-button compact-btn" onClick={reRender} disabled={Boolean(busy)} title="Áp dụng phụ đề & góc máy mới mà không cần quay lại">
                      <RefreshCw size={13} className={busy === 'render' ? 'spin-icon' : ''} />
                      {busy === 'render' ? 'Đang dựng…' : mode === 'footage' ? 'Chèn phụ đề' : 'Dựng lại (không quay lại)'}
                    </button>
                  )}
                  {mode === 'plan' && (
                    <button className="primary-button compact-btn" onClick={() => recordAndRender()} disabled={Boolean(busy)}>
                      <Clapperboard size={13} /> Quay & dựng 4K
                    </button>
                  )}
                </div>
              </div>

              <div className="storyboard-list">
                {!scenes.length && (
                  <div className="storyboard-empty">
                    <ListChecks size={16} />
                    <span>
                      Chưa có kịch bản. Viết yêu cầu ở cột bên phải rồi bấm <b>Lên kịch bản</b> để AI chia phân cảnh và thao tác.
                    </span>
                  </div>
                )}
                {scenes.map((scene, idx) => {
                  const isCurrent = activePlaybackScene?.id === scene.id;
                  return (
                    <div key={scene.id} className={`storyboard-item ${isCurrent ? 'active' : ''} ${scene.status}`} onClick={() => setSelectedSceneId(scene.id)}>
                      <div className="storyboard-item-top">
                        <span className="scene-badge">
                          {scene.status === 'verified' ? <CircleCheck size={11} /> : scene.status === 'failed' ? <CircleX size={11} /> : null} Cảnh {idx + 1}
                        </span>
                        <input
                          className="scene-title-input"
                          value={scene.label}
                          onChange={(e) => updateSceneField(scene.id, { label: e.target.value })}
                          placeholder="Tên cảnh…"
                        />
                        <span className="scene-kicker">{scene.kicker}</span>
                        <select
                          className="scene-focus-select"
                          value={scene.focus}
                          onChange={(e) => updateSceneField(scene.id, { focus: e.target.value as FocusRegion })}
                          title="Góc máy của cảnh"
                        >
                          <option value="auto">Góc máy: Tự động theo thao tác</option>
                          <option value="full">Góc máy: Toàn màn hình</option>
                          <option value="left">Góc máy: Bảng bên trái</option>
                          <option value="center">Góc máy: Giữa bản vẽ</option>
                          <option value="right">Góc máy: Bên phải</option>
                        </select>
                        {mode === 'footage' ? (
                          <label className="scene-duration-box" title="Thời lượng cảnh (giây)">
                            <input
                              type="number"
                              min={2}
                              max={60}
                              value={scene.duration}
                              onChange={(e) => updateSceneField(scene.id, { duration: Number(e.target.value) || 6 })}
                            />
                            <span>s</span>
                          </label>
                        ) : (
                          <span className="scene-duration-box readonly">{scene.duration}s</span>
                        )}
                        {mode !== 'session' && (
                          <button
                            className="scene-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteScene(scene.id);
                            }}
                            title="Xoá cảnh này"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <input
                        className="scene-caption-input"
                        value={scene.description}
                        onChange={(e) => updateSceneField(scene.id, { description: e.target.value })}
                        placeholder="Phụ đề tiếng Việt in trên video ở cảnh này…"
                      />
                      {scene.steps && scene.steps.length > 0 && (
                        <div className="step-chips">
                          {scene.steps.map((step, i) => (
                            <span key={i} className={`step-chip ${step.ok === true ? 'ok' : step.ok === false ? 'fail' : ''}`}>
                              {step.ok === true && <Check size={10} />}
                              {step.ok === false && <X size={10} />}
                              {step.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="simple-prompt-panel">
            <div className="prompt-heading">
              <div className="agent-orb">
                <Sparkles size={18} />
              </div>
              <div>
                <span className="section-kicker">AI MARKETING DIRECTOR</span>
                <h2>Kịch bản → Video 4K</h2>
                <p>Mô tả tính năng cần quảng cáo. AI lập phân cảnh, engine thao tác VinaCAD thật, kiểm chứng từng bước và dựng video 4K.</p>
              </div>
            </div>

            {!apiKey.trim() && (
              <div className="quick-key-banner">
                <div className="quick-key-title">
                  <KeyRound size={14} />
                  <strong>Dán API Key để AI hiểu mọi kịch bản</strong>
                </div>
                <div className="quick-key-row">
                  <input
                    type="password"
                    value={apiKey}
                    placeholder="Google AI Studio (AIza…), OpenAI (sk-…) hoặc Anthropic"
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      persistAiConfig(provider, model, baseUrl, e.target.value);
                    }}
                  />
                  <button className="primary-button" onClick={testConnection} disabled={connectionTesting}>
                    {connectionTesting ? 'Đang thử…' : 'Kiểm tra'}
                  </button>
                </div>
                <small>Chưa có key: chỉ dùng được các kịch bản mẫu offline trên bản vẽ mẫu.</small>
              </div>
            )}

            <div className="step-block">
              <label className="prompt-label">
                <span>1. BẢN VẼ CAD (.DWG / .DXF)</span>
                <button className="tiny-link" onClick={handlePickDwg} disabled={Boolean(busy)}>
                  <FolderOpen size={12} /> Chọn file…
                </button>
              </label>
              <div className="dwg-selector-row">
                <FileCode2 size={15} className="dwg-icon" />
                <select value={selectedDwgPath} onChange={(e) => setSelectedDwgPath(e.target.value)} disabled={Boolean(busy)}>
                  {dwgFiles.map((file) => (
                    <option key={file.path} value={file.path}>
                      {file.name} ({file.sizeLabel})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="step-block">
              <label className="prompt-label" htmlFor="director-prompt">
                <span>2. KỊCH BẢN / YÊU CẦU</span>
                <span className="shortcut">Mẫu ↓</span>
              </label>
              <div className="preset-chips">
                {scriptPresets.map((preset) => (
                  <button
                    key={preset.title}
                    type="button"
                    className="preset-chip"
                    onClick={() => {
                      setPrompt(preset.prompt);
                      setToast(`Đã nạp mẫu: ${preset.title}`);
                    }}
                  >
                    {preset.title}
                  </button>
                ))}
              </div>
              <div className="prompt-box">
                <textarea
                  id="director-prompt"
                  value={prompt}
                  maxLength={6000}
                  onChange={(event) => setPrompt(event.target.value)}
                  aria-label="Kịch bản marketing"
                  placeholder="Mô tả tính năng cần quay, thứ tự thao tác và thông điệp phụ đề…"
                />
                <div className="prompt-footer">
                  <span>
                    <WandSparkles size={13} /> Thao tác thật · kiểm chứng · camera tự động · phụ đề
                  </span>
                  <span>{prompt.length}/6000</span>
                </div>
              </div>
            </div>

            <div className="prompt-context">
              <div>
                <Library size={14} />
                <span>{knowledgeText ? `Playbook: ${knowledgeName}` : 'Chưa nạp playbook .md'}</span>
              </div>
              <button className="tiny-link" onClick={() => knowledgeFileInputRef.current?.click()}>
                Đính kèm .md
              </button>
              <input
                ref={knowledgeFileInputRef}
                className="hidden-file-input"
                type="file"
                accept=".md,.markdown,text/markdown,text/plain"
                onChange={importKnowledge}
              />
            </div>

            <div className="prompt-context">
              <div>
                <Film size={14} />
                <span>Chất lượng dựng</span>
              </div>
              <select className="quality-select" value={quality} onChange={(e) => setQuality(e.target.value)} disabled={Boolean(busy)}>
                <option value="4K master">4K 3840×2160 · 60fps</option>
                <option value="1080p social">Full HD 1920×1080 · 60fps</option>
                <option value="Vertical cut">Dọc 1080×1920 (Reels/TikTok)</option>
              </select>
            </div>

            {busy && (
              <div className="live-progress-card">
                <div className="live-progress-top">
                  <span className="button-spinner" />
                  <strong>{progress ? `${PHASE_LABEL[progress.phase]}: ${progress.message || ''}` : busyLabel}</strong>
                </div>
                {progress?.detail && <small>{progress.detail}</small>}
                <div className="live-progress-bar">
                  <span style={{ width: `${progressPercent !== null ? Math.round(progressPercent * 100) : 12}%` }} />
                </div>
              </div>
            )}

            <div className="run-button-row">
              <button className="ghost-button plan-button" onClick={() => requestPlan()} disabled={Boolean(busy)} title="AI lập phân cảnh để bạn duyệt trước khi quay">
                <ListChecks size={15} /> Lên kịch bản
              </button>
              <button className={`run-agent-button simple-run-button ${busy ? 'running' : ''}`} onClick={mainAction} disabled={Boolean(busy)}>
                {busy ? (
                  <>
                    <span className="button-spinner" /> {busyLabel}
                  </>
                ) : (
                  <>
                    <Clapperboard size={17} /> {plan && mode === 'plan' ? 'Quay & dựng 4K' : 'Tự động: kịch bản → video'}
                  </>
                )}
              </button>
              {busy && busy !== 'export' && (
                <button className="ghost-button cancel-run-btn" onClick={stopProduction}>
                  Dừng
                </button>
              )}
            </div>

            <div className={`prompt-status ${lastError ? 'has-error' : ''}`} title={lastError || undefined}>
              {lastError ? <TriangleAlert size={13} /> : <span className="status-dot" />}
              {lastError
                ? `Lỗi: ${lastError}`
                : apiKey.trim()
                  ? `AI: ${provider} (${model}) · quay offscreen 4K · encoder GPU tự chọn`
                  : 'Chưa có API Key: chỉ kịch bản mẫu offline. Dán key để AI hiểu mọi yêu cầu.'}
            </div>
          </aside>
        </section>
      </main>

      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="modal-card settings-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="section-kicker">KẾT NỐI AI MODEL</span>
                <h2>Cấu hình API Key & Model</h2>
                <p>
                  Dán API Key từ <b>Google AI Studio</b>, OpenAI hoặc Anthropic. Key được lưu trên máy này và chỉ dùng để AI lập kịch bản.
                </p>
              </div>
              <button className="icon-button" onClick={() => setShowSettings(false)}>
                <X size={17} />
              </button>
            </div>
            <div className="settings-form">
              <label className="field-label">
                Nhà cung cấp
                <select value={provider} onChange={(event) => handleProviderChange(event.target.value)}>
                  {Object.keys(modelCatalog).map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                API Key
                <input
                  type="password"
                  value={apiKey}
                  placeholder={provider === 'Google' ? 'AIzaSy...' : provider === 'Custom' ? 'kapi_... hoặc sk-...' : 'sk-...'}
                  onChange={(event) => setApiKey(event.target.value)}
                />
              </label>
              <label className="field-label">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Model</span>
                  <button type="button" className="tiny-link" onClick={refreshModelsFromApi} disabled={loadingModels} title="Đồng bộ danh sách model từ API của hãng">
                    <RefreshCw size={11} className={loadingModels ? 'spin-icon' : ''} /> {loadingModels ? 'Đang đồng bộ…' : 'Đồng bộ model từ API'}
                  </button>
                </div>
                <select value={customModelMode ? '__custom' : model} onChange={(event) => handleModelChange(event.target.value)}>
                  {(modelCatalog[provider] || defaultModelCatalog.Google).map((item) => (
                    <option key={item} value={item}>
                      {modelDisplayLabels[item] || item}
                    </option>
                  ))}
                  <option value="__custom">Nhập Model ID tùy chỉnh…</option>
                </select>
              </label>
              {customModelMode && (
                <label className="field-label">
                  Model ID tùy chỉnh
                  <input value={model} placeholder="Ví dụ: claude-opus-5-5, deepseek-v4.1-flash, gemini-3.8-flash" onChange={(event) => setModel(event.target.value)} />
                </label>
              )}
              <label className="field-label">
                Base URL
                <input
                  value={baseUrl}
                  placeholder={
                    provider === 'Google'
                      ? 'https://generativelanguage.googleapis.com/v1beta'
                      : provider === 'Anthropic'
                        ? 'https://api.anthropic.com/v1'
                        : provider === 'Custom'
                          ? 'https://api.kingofapi.store/v1'
                          : 'https://api.openai.com/v1'
                  }
                  onChange={(event) => setBaseUrl(event.target.value)}
                />
              </label>
              <div
                className={`connection-note ${
                  connectionMessage.startsWith('Lỗi:') || connectionMessage.includes('báo lỗi:')
                    ? 'is-error'
                    : connectionMessage.startsWith('Đã kết nối')
                      ? 'is-ok'
                      : ''
                }`}
              >
                <Activity size={14} />
                <span>{connectionMessage}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="ghost-button" onClick={testConnection} disabled={connectionTesting}>
                {connectionTesting ? (
                  <>
                    <span className="button-spinner" /> Đang kiểm tra…
                  </>
                ) : (
                  <>
                    <Activity size={15} /> Kiểm tra kết nối
                  </>
                )}
              </button>
              <button className="ghost-button" onClick={() => setShowSettings(false)}>
                Đóng
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  const normalizedBase = normalizeSavedBaseUrl(provider, baseUrl);
                  if (normalizedBase !== baseUrl) setBaseUrl(normalizedBase);
                  persistAiConfig(provider, model, normalizedBase, apiKey.trim());
                  setShowSettings(false);
                  setToast('Đã lưu cấu hình AI.');
                }}
              >
                <Check size={15} /> Lưu kết nối
              </button>
            </div>
          </div>
        </div>
      )}

      {showExport && (
        <div className="modal-backdrop" onClick={() => setShowExport(false)}>
          <div className="modal-card export-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="section-kicker">XUẤT VIDEO</span>
                <h2>Xuất bản MP4</h2>
                <p>
                  {mode === 'session'
                    ? 'Video được dựng lại từ bản quay gốc 4K theo đúng chất lượng bạn chọn, kèm phụ đề và góc máy hiện tại.'
                    : 'Footage nhập vào được chèn phụ đề theo bảng phân cảnh và xuất theo chất lượng đã chọn.'}
                </p>
              </div>
              <button className="icon-button" onClick={() => setShowExport(false)}>
                <X size={17} />
              </button>
            </div>
            <div className="export-preview">
              <div className="export-icon">
                <Film size={21} />
              </div>
              <div>
                <strong>{session?.title || footageName || 'VinaCAD Marketing'}</strong>
                <span>
                  {scenes.length} phân cảnh · {totalDuration} giây{mode === 'session' ? ` · ${verifiedCount} thao tác đã kiểm chứng` : ''}
                </span>
              </div>
              <div className="export-ready">
                <Check size={13} /> Sẵn sàng
              </div>
            </div>
            <div className="export-options">
              <button className={`export-option ${quality === '4K master' ? 'active' : ''}`} onClick={() => setQuality('4K master')}>
                <span>Bản 4K Master</span>
                <small>3840 × 2160 · 60fps</small>
              </button>
              <button className={`export-option ${quality === '1080p social' ? 'active' : ''}`} onClick={() => setQuality('1080p social')}>
                <span>Bản Full HD</span>
                <small>1920 × 1080 · 60fps</small>
              </button>
              <button className={`export-option ${quality === 'Vertical cut' ? 'active' : ''}`} onClick={() => setQuality('Vertical cut')}>
                <span>Bản dọc (Reels/TikTok)</span>
                <small>1080 × 1920 · 9:16</small>
              </button>
            </div>
            <div className="modal-footer">
              <button className="ghost-button" onClick={() => setShowExport(false)}>
                Quay lại
              </button>
              <button className="primary-button" onClick={exportVideo}>
                <Download size={15} /> Dựng & xuất .MP4
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast">
          <span className="toast-icon">{toast.startsWith('Lỗi') ? <TriangleAlert size={13} /> : <Check size={13} />}</span>
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
