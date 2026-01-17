// 配置状态类型定义
export interface ConfigState {
  isEnabled: boolean;
  position: Position;
  fadeOutDuration: number;
  autoStart: boolean;
}

export interface Position {
  x: number;
  y: number;
}

// 按键事件类型
export interface KeyPressEvent {
  keys: string[];
  timestamp: number;
}

// 预设位置枚举
export type PresetPosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left'
  | 'bottom-center'
  | 'top-center'
  | 'custom';

// IPC 通道名称常量
export const IPC_CHANNELS = {
  KEY_PRESSED: 'key-pressed',
  CONFIG_CHANGED: 'config-changed',
  UPDATE_CONFIG: 'update-config',
  TOGGLE_ENABLED: 'toggle-enabled',
  GET_CONFIG: 'get-config',
  UPDATE_POSITION: 'update-position',
  OPEN_SETTINGS: 'open-settings',
} as const;

// 默认配置
export const DEFAULT_CONFIG: ConfigState = {
  isEnabled: false,
  position: { x: -1, y: -1 }, // -1 表示使用默认位置
  fadeOutDuration: 1000,
  autoStart: false,
};
