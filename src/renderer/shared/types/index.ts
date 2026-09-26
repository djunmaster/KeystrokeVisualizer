// ==================== Types ====================

// Config state
export interface ConfigState {
  isEnabled: boolean;
  position: Position;
  fadeOutDuration: number;
  autoStart: boolean;
  maxDisplayCount: number; // Maximum number of key display blocks
  language: 'zh-CN' | 'en-US';
}

export interface Position {
  x: number;
  y: number;
}

export interface PositionPreview {
  workArea: { x: number; y: number; width: number; height: number };
  overlaySize: { width: number; height: number };
  position: Position;
}

// Key press event
export interface KeyPressEvent {
  keys: string[];
  timestamp: number;
}

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

  // Config management
  CONFIG_CHANGED: 'config-changed',
  UPDATE_CONFIG: 'update-config',
  GET_CONFIG: 'get-config',

  // Position management
  UPDATE_POSITION: 'update-position',
  GET_PRESET_POSITION: 'get-preset-position',
  GET_PRESET_NAME: 'get-preset-name',
  GET_POSITION_PREVIEW: 'get-position-preview',

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
  position: { x: -1, y: -1 }, // -1 means use default position
  fadeOutDuration: 1000,
  autoStart: false,
  maxDisplayCount: 6, // Default to 6 display blocks
  language: 'zh-CN',
};
