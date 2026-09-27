// ==================== Types ====================

// Config state
export interface ConfigState {
  isEnabled: boolean;
  isPaused: boolean;
  displayMode: 'history' | 'keyboard';
  keyboardLayout: 'gaming' | 'arrows';
  keyboardScale: number;
  theme: KeyThemeId;
  activeCustomStyleId: string | null;
  customStyles: CustomKeyStyle[];
  position: Position;
  displayId: number | null;
  fadeOutDuration: number;
  autoStart: boolean;
  maxDisplayCount: number; // Maximum number of key display blocks
  language: 'zh-CN' | 'en-US';
}

export const KEY_THEME_IDS = ['classic', 'paper', 'mint', 'neon', 'contrast', 'outline'] as const;
export type KeyThemeId = typeof KEY_THEME_IDS[number];

export interface CustomKeyStyle {
  id: string;
  name: string;
  baseTheme: KeyThemeId;
  css: string;
}

export const MAX_CUSTOM_STYLES = 20;
export const MAX_STYLE_NAME_LENGTH = 40;
export const MAX_CUSTOM_CSS_LENGTH = 16000;

export const KEY_THEMES: ReadonlyArray<{
  id: KeyThemeId;
  name: Record<ConfigState['language'], string>;
  swatches: readonly string[];
}> = [
  { id: 'classic', name: { 'zh-CN': '经典磨砂', 'en-US': 'Classic Frosted' }, swatches: ['#242424', '#505050', '#67e8f9'] },
  { id: 'paper', name: { 'zh-CN': '纸白键帽', 'en-US': 'Paper Keycaps' }, swatches: ['#e6e9ec', '#ffffff', '#2563eb'] },
  { id: 'mint', name: { 'zh-CN': '薄荷终端', 'en-US': 'Mint Terminal' }, swatches: ['#161d19', '#253d30', '#69e0a5'] },
  { id: 'neon', name: { 'zh-CN': '霓虹电竞', 'en-US': 'Neon Gaming' }, swatches: ['#191a22', '#61dced', '#f487ce'] },
  { id: 'contrast', name: { 'zh-CN': '高对比教学', 'en-US': 'High Contrast' }, swatches: ['#ffe45c', '#111111', '#ffffff'] },
  { id: 'outline', name: { 'zh-CN': '极简描边', 'en-US': 'Minimal Outline' }, swatches: ['#ffffff', '#4f5357', '#e0f2fe'] },
];

export interface Position {
  x: number;
  y: number;
}

export interface PositionPreview {
  displayId: number;
  workArea: { x: number; y: number; width: number; height: number };
  overlaySize: { width: number; height: number };
  position: Position;
}

export interface DisplayInfo {
  id: number;
  label: string;
  isPrimary: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
}

// Key press event
export interface KeyPressEvent {
  keys: string[];
  timestamp: number;
  keyCode?: number;
  repeat?: boolean;
}

export interface KeyStateEvent {
  keyCodes: number[];
  timestamp: number;
}

export interface PauseShortcutStatus {
  accelerator: string;
  registered: boolean;
}

export interface UpdateStatus {
  phase: 'unsupported' | 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'installing' | 'error';
  currentVersion: string;
  availableVersion?: string;
  progress?: number;
  unsupportedReason?: 'development' | 'portable' | 'platform';
}

export const PAUSE_ACCELERATOR = 'CommandOrControl+Shift+F9';

// Physical scan codes from uiohook-napi; keep the native module out of renderers.
export const KEYBOARD_PANEL_KEYS = {
  W: [0x0011], A: [0x001E], S: [0x001F], D: [0x0020],
  Up: [0xE048], Left: [0xE04B], Down: [0xE050], Right: [0xE04D],
  Shift: [0x002A, 0x0036], Ctrl: [0x001D, 0x0E1D], Space: [0x0039],
} as const;

export const KEYBOARD_PANEL_LAYOUTS = {
  gaming: [['W'], ['A', 'S', 'D'], ['Shift', 'Space', 'Ctrl']],
  arrows: [['Up'], ['Left', 'Down', 'Right'], ['Shift', 'Space', 'Ctrl']],
} as const;

export const KEYBOARD_PANEL_HEIGHT = 218;
export const KEYBOARD_PANEL_WIDTH = 400;
export const MIN_KEYBOARD_SCALE = 60;
export const MAX_KEYBOARD_SCALE = 160;

// Preset positions
export type PresetPosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left'
  | 'bottom-center'
  | 'top-center'
  | 'custom';

// ==================== IPC Channels ====================

export const IPC_CHANNELS = {
  // Key events
  KEY_PRESSED: 'key-pressed',
  KEY_STATE_CHANGED: 'key-state-changed',
  GET_KEY_STATE: 'get-key-state',
  GET_PAUSE_SHORTCUT_STATUS: 'get-pause-shortcut-status',
  GET_UPDATE_STATUS: 'get-update-status',
  CHECK_FOR_UPDATES: 'check-for-updates',
  DOWNLOAD_UPDATE: 'download-update',
  INSTALL_UPDATE: 'install-update',
  UPDATE_STATUS_CHANGED: 'update-status-changed',

  // Config management
  CONFIG_CHANGED: 'config-changed',
  UPDATE_CONFIG: 'update-config',
  GET_CONFIG: 'get-config',

  // Position management
  UPDATE_POSITION: 'update-position',
  GET_PRESET_POSITION: 'get-preset-position',
  GET_PRESET_NAME: 'get-preset-name',
  GET_POSITION_PREVIEW: 'get-position-preview',
  GET_DISPLAYS: 'get-displays',
  DISPLAYS_CHANGED: 'displays-changed',

  // Window control
  TOGGLE_ENABLED: 'toggle-enabled',
  OPEN_SETTINGS: 'open-settings',
  CLOSE_SETTINGS: 'close-settings',
  SHOW_OVERLAY: 'show-overlay',
  HIDE_OVERLAY: 'hide-overlay',
  SET_MOUSE_PASSTHROUGH: 'set-mouse-passthrough',

  // Tray control
  QUIT_APP: 'quit-app',
} as const;

// IPC channel type
export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

// ==================== Default Config ====================

export const DEFAULT_CONFIG: ConfigState = {
  isEnabled: false,
  isPaused: false,
  displayMode: 'history',
  keyboardLayout: 'gaming',
  keyboardScale: 100,
  theme: 'classic',
  activeCustomStyleId: null,
  customStyles: [],
  position: { x: -1, y: -1 }, // -1 means use default position
  displayId: null,
  fadeOutDuration: 1000,
  autoStart: false,
  maxDisplayCount: 6, // Default to 6 display blocks
  language: 'zh-CN',
};
