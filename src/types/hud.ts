export type HudModuleId =
  | 'code_studio'
  | 'notes_tasks'
  | 'data_analyzer'
  | 'system_terminal'
  | 'vision_cam'
  | 'workspace_dir';

export type WorkspaceCategory =
  | 'Documentos'
  | 'Vídeos'
  | 'Músicas'
  | 'Programas'
  | 'Downloads'
  | 'Imagens';

export interface WeatherData {
  temperatureC: number;
  apparentTempC: number;
  condition: string;
  locationName: string;
  windKmh: number;
  humidity: number;
  updatedAt: string;
}

export interface GroundingLink {
  title: string;
  uri: string;
}

export interface QuickLinkAction {
  siteName: string;
  url: string;
}

export interface NoteTaskItem {
  id: string;
  text: string;
  type: 'note' | 'task';
  completed: boolean;
  createdAt: string;
}

export interface CodeStudioState {
  title: string;
  language: string;
  code: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'jarvis' | 'system';
  text: string;
  timestamp: string;
  groundingLinks?: GroundingLink[];
  quickLinkAction?: QuickLinkAction;
  imagePreview?: string;
}

export interface HudClientAction {
  type:
    | 'update_weather'
    | 'open_external_link'
    | 'open_hud_module'
    | 'manage_notes_tasks'
    | 'set_hud_mode'
    | 'write_to_code_studio';
  payload: Record<string, unknown>;
}

export interface JarvisChatResponse {
  reply: string;
  clientActions: HudClientAction[];
  groundingLinks: GroundingLink[];
  latencyMs: number;
  weatherUpdate?: WeatherData;
}

export interface QuickLinkItem {
  id: string;
  label: string;
  url: string;
  category: string;
}

export type ReactorState = 'idle' | 'listening' | 'processing' | 'speaking' | 'alert';
