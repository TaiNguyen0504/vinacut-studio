/// <reference types="vite/client" />

export type FocusRegion = 'auto' | 'full' | 'left' | 'center' | 'right';

export type StepChip = {
  label: string;
  ok?: boolean;
};

export type SceneItem = {
  id: string;
  label: string;
  kicker: string;
  description: string;
  duration: number;
  focus: FocusRegion;
  status: 'ready' | 'draft' | 'generating' | 'verified' | 'failed';
  tint: string;
  steps?: StepChip[];
};

export type DwgFileItem = {
  name: string;
  path: string;
  sizeLabel: string;
  isBuiltin?: boolean;
};

export type PlanStep = { type: string; [key: string]: unknown };

export type PlanScene = {
  label: string;
  description: string;
  focus: FocusRegion;
  hold: number;
  steps: PlanStep[];
};

export type ShotPlan = {
  title: string;
  scenes: PlanScene[];
};

export type ProductionVideo = {
  url: string;
  quality: string;
  width: number;
  height: number;
  duration: number;
  encoder: string;
};

export type RecordedScene = {
  label: string;
  description: string;
  focus: FocusRegion;
  start: number;
  end: number;
};

export type RecordedAction = {
  scene: number;
  type: string;
  ok: boolean;
  intent: string;
};

export type ProductionProgress = {
  phase: 'load' | 'plan' | 'record' | 'render';
  message?: string;
  detail?: string;
  percent?: number;
  scene?: number;
  total?: number;
};

export type SceneOverride = { description?: string; focus?: FocusRegion };

type AiPayload = {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

declare global {
  interface Window {
    vinacut?: {
      platform: string;
      version: string;
      chat: (payload: AiPayload & {
        system: string;
        prompt: string;
        imageBase64?: string;
        timeoutMs?: number;
      }) => Promise<string>;
      testConnection: (payload: AiPayload) => Promise<{ ok: boolean; model: string; baseUrl?: string; message: string; models?: string[] }>;
      listModels: (payload: { provider: string; baseUrl: string; apiKey: string }) => Promise<string[]>;
      computerUseTest: (payload: { baseUrl: string; apiKey: string; model: string }) => Promise<{ status: string; text: string }>;
      saveFile: (payload: { defaultPath: string; data: Uint8Array }) => Promise<string | null>;
      listRecentDwgs: () => Promise<DwgFileItem[]>;
      pickDwg: () => Promise<DwgFileItem | null>;
      vinacadPrepare: (payload?: { dwgPath?: string; visible?: boolean }) => Promise<{ ready: boolean; drawingName: string; message: string }>;
      vinacadClose: () => Promise<{ closed: boolean }>;
      captureSources: () => Promise<Array<{ id: string; name: string }>>;
      nativeCaptureStart: () => Promise<{ started: boolean; outputPath: string }>;
      nativeCaptureStop: () => Promise<Uint8Array | null>;
      vinacadCaptureStart: (payload?: { dwgPath?: string }) => Promise<{ started: boolean; title: string }>;
      vinacadCaptureStop: () => Promise<Uint8Array | null>;
      renderEditedVideo: (payload: {
        videoData: Uint8Array;
        scenes: Array<{ label: string; description: string; duration: number; focus?: FocusRegion }>;
        quality: string;
      }) => Promise<{ video: Uint8Array; duration: number }>;
      planVideo: (payload: AiPayload & { prompt: string; knowledge?: string; dwgPath: string }) => Promise<{
        plan: ShotPlan;
        context: unknown;
        source: 'ai' | 'preset';
        attempts?: number;
        message: string;
      }>;
      recordPlan: (payload: { plan: ShotPlan; context: unknown; dwgPath: string; quality: string }) => Promise<{
        sessionId: string;
        timeline: { title: string; duration: number; scenes: RecordedScene[]; actions: RecordedAction[] };
        video: ProductionVideo;
      }>;
      renderSession: (payload: { sessionId: string; quality: string; sceneOverrides: SceneOverride[] }) => Promise<{
        sessionId: string;
        video: ProductionVideo;
      }>;
      exportSession: (payload: { sessionId: string; quality: string; sceneOverrides: SceneOverride[]; defaultName?: string }) => Promise<string | null>;
      cancelProduction: () => Promise<boolean>;
      onProductionProgress: (callback: (data: ProductionProgress) => void) => () => void;
    };
  }
}
