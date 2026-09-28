// ==================== Types ====================

// Config state
export interface ConfigState {
  isEnabled: boolean;
  isPaused: boolean;
  displayMode: 'history' | 'keyboard';
  keyboardLayout: 'gaming' | 'arrows' | 'custom';
  customKeyboardLayouts: CustomKeyboardLayout[];
  activeCustomKeyboardLayoutId: string | null;
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
  Escape: [0x0001],
  F1: [0x003B], F2: [0x003C], F3: [0x003D], F4: [0x003E], F5: [0x003F], F6: [0x0040],
  F7: [0x0041], F8: [0x0042], F9: [0x0043], F10: [0x0044], F11: [0x0057], F12: [0x0058],
  '1': [0x0002], '2': [0x0003], '3': [0x0004], '4': [0x0005], '5': [0x0006],
  '6': [0x0007], '7': [0x0008], '8': [0x0009], '9': [0x000A], '0': [0x000B],
  Q: [0x0010], W: [0x0011], E: [0x0012], R: [0x0013], T: [0x0014], Y: [0x0015],
  U: [0x0016], I: [0x0017], O: [0x0018], P: [0x0019],
  A: [0x001E], S: [0x001F], D: [0x0020], F: [0x0021], G: [0x0022], H: [0x0023],
  J: [0x0024], K: [0x0025], L: [0x0026],
  Z: [0x002C], X: [0x002D], C: [0x002E], V: [0x002F], B: [0x0030], N: [0x0031], M: [0x0032],
  Backquote: [0x0029], Minus: [0x000C], Equal: [0x000D], Backspace: [0x000E], Tab: [0x000F],
  BracketLeft: [0x001A], BracketRight: [0x001B], Backslash: [0x002B], CapsLock: [0x003A],
  Semicolon: [0x0027], Quote: [0x0028], Enter: [0x001C], Comma: [0x0033], Period: [0x0034], Slash: [0x0035],
  Up: [0xE048], Left: [0xE04B], Down: [0xE050], Right: [0xE04D],
  Home: [0x0E47], End: [0x0E4F], PageUp: [0x0E49], PageDown: [0x0E51], Insert: [0x0E52], Delete: [0x0E53],
  Shift: [0x002A, 0x0036], Ctrl: [0x001D, 0x0E1D], Space: [0x0039],
  Alt: [0x0038, 0x0E38], Meta: [0x0E5B, 0x0E5C],
  ShiftLeft: [0x002A], ShiftRight: [0x0036], CtrlLeft: [0x001D], CtrlRight: [0x0E1D],
  AltLeft: [0x0038], AltRight: [0x0E38], MetaLeft: [0x0E5B], MetaRight: [0x0E5C],
  Numpad0: [0x0052], Numpad1: [0x004F], Numpad2: [0x0050], Numpad3: [0x0051], Numpad4: [0x004B],
  Numpad5: [0x004C], Numpad6: [0x004D], Numpad7: [0x0047], Numpad8: [0x0048], Numpad9: [0x0049],
  NumpadAdd: [0x004E], NumpadSubtract: [0x004A], NumpadMultiply: [0x0037], NumpadDivide: [0x0E35],
  NumpadDecimal: [0x0053], NumpadEnter: [0x0E1C], NumLock: [0x0045], ScrollLock: [0x0046], PrintScreen: [0x0E37],
  Spacer: [],
} as const;

export const KEYBOARD_PANEL_LAYOUTS = {
  gaming: [['W'], ['A', 'S', 'D'], ['Shift', 'Space', 'Ctrl']],
  arrows: [['Up'], ['Left', 'Down', 'Right'], ['Shift', 'Space', 'Ctrl']],
} as const;

export const KEYBOARD_PANEL_HEIGHT = 218;
export const KEYBOARD_PANEL_WIDTH = 400;
export const MIN_KEYBOARD_SCALE = 60;
export const MAX_KEYBOARD_SCALE = 160;
export const MAX_CUSTOM_KEYBOARD_LAYOUTS = 20;
export const MAX_LAYOUT_ROWS = 8;
export const MAX_ROW_KEYS = 20;
export const MAX_ROW_WIDTH = 1600;
export const MAX_KEY_LABEL_LENGTH = 12;
export const KEY_WIDTH_UNIT = 64;
export const KEYBOARD_KEY_HEIGHT = 54;
export const KEYBOARD_ROW_GAP = 12;
export const KEYBOARD_KEY_GAP = 8;
export const KEYBOARD_PADDING = 16;
export const MAX_KEYBOARD_PANEL_HEIGHT = KEYBOARD_PADDING * 2 + MAX_LAYOUT_ROWS * KEYBOARD_KEY_HEIGHT + (MAX_LAYOUT_ROWS - 1) * KEYBOARD_ROW_GAP;

export type KeyboardKeyId = keyof typeof KEYBOARD_PANEL_KEYS;
export interface KeyboardLayoutKey {
  key: KeyboardKeyId;
  width: number;
  label?: string;
}
export interface CustomKeyboardLayout {
  id: string;
  name: string;
  rows: KeyboardLayoutKey[][];
}

export function getKeyboardKeyLabel(key: KeyboardKeyId): string {
  const labels: Partial<Record<KeyboardKeyId, string>> = {
    Up: '\u2191', Left: '\u2190', Down: '\u2193', Right: '\u2192', Escape: 'Esc',
    Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', CapsLock: 'Caps', Backspace: 'Bksp',
    ShiftLeft: 'L Shift', ShiftRight: 'R Shift', CtrlLeft: 'L Ctrl', CtrlRight: 'R Ctrl',
    AltLeft: 'L Alt', AltRight: 'R Alt', Meta: 'Win', MetaLeft: 'L Win', MetaRight: 'R Win',
    NumpadAdd: 'Num +', NumpadSubtract: 'Num -', NumpadMultiply: 'Num *', NumpadDivide: 'Num /',
    NumpadDecimal: 'Num .', NumpadEnter: 'Num Ent', PrintScreen: 'PrtSc', PageUp: 'PgUp', PageDown: 'PgDn',
  };
  return labels[key] ?? (key.startsWith('Numpad') ? key.replace('Numpad', 'Num ') : key);
}

export function getKeyboardRows(layout: ConfigState['keyboardLayout'], customs: readonly CustomKeyboardLayout[] = [],
  activeId: string | null = null): KeyboardLayoutKey[][] {
  if (layout === 'custom') {
    const custom = customs.find((item) => item.id === activeId);
    if (custom) return custom.rows;
  }
  return KEYBOARD_PANEL_LAYOUTS[layout === 'arrows' ? 'arrows' : 'gaming'].map((row) => row.map((key) => ({
    key, width: key === 'Space' ? 1.75 : key === 'Shift' || key === 'Ctrl' ? 1.25 : 1,
  })));
}

export function getKeyboardPanelSize(rows: readonly (readonly KeyboardLayoutKey[])[]): { width: number; height: number } {
  return {
    width: Math.max(...rows.map((row) => row.reduce((sum, cell) => sum + cell.width * KEY_WIDTH_UNIT, 0) +
      Math.max(0, row.length - 1) * KEYBOARD_KEY_GAP)) + KEYBOARD_PADDING * 2,
    height: KEYBOARD_PADDING * 2 + rows.length * KEYBOARD_KEY_HEIGHT + Math.max(0, rows.length - 1) * KEYBOARD_ROW_GAP,
  };
}

export function getConfiguredKeyboardPanelSize(layout: ConfigState['keyboardLayout'], rows: KeyboardLayoutKey[][]) {
  return layout === 'custom' ? getKeyboardPanelSize(rows) : { width: KEYBOARD_PANEL_WIDTH, height: KEYBOARD_PANEL_HEIGHT };
}

export function parseCustomKeyboardLayouts(input: unknown): CustomKeyboardLayout[] {
  if (!Array.isArray(input) || input.length > MAX_CUSTOM_KEYBOARD_LAYOUTS) {
    throw new RangeError(`customKeyboardLayouts must contain at most ${MAX_CUSTOM_KEYBOARD_LAYOUTS} layouts`);
  }
  const ids = new Set<string>();
  const names = new Set<string>();
  return input.map((value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Layout must be an object');
    const layout = value as Record<string, unknown>;
    if (Object.keys(layout).some((key) => !['id', 'name', 'rows'].includes(key)) ||
      typeof layout.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(layout.id) || ids.has(layout.id) ||
      typeof layout.name !== 'string' || !layout.name.trim() || layout.name.trim().length > MAX_STYLE_NAME_LENGTH ||
      names.has(layout.name.trim())) throw new TypeError('Layout must have a unique id and name');
    if (!Array.isArray(layout.rows) || layout.rows.length < 1 || layout.rows.length > MAX_LAYOUT_ROWS) {
      throw new RangeError(`Layout must have 1 to ${MAX_LAYOUT_ROWS} rows`);
    }
    ids.add(layout.id);
    names.add(layout.name.trim());
    const keys = new Set<string>();
    const rows = layout.rows.map((row: unknown) => {
      if (!Array.isArray(row) || row.length < 1 || row.length > MAX_ROW_KEYS) {
        throw new RangeError(`Row must have 1 to ${MAX_ROW_KEYS} keys`);
      }
      const cells = row.map((value: unknown): KeyboardLayoutKey => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Key must be an object');
        const cell = value as Record<string, unknown>;
        if (Object.keys(cell).some((key) => !['key', 'width', 'label'].includes(key)) ||
          typeof cell.key !== 'string' || !Object.prototype.hasOwnProperty.call(KEYBOARD_PANEL_KEYS, cell.key) ||
          (cell.key !== 'Spacer' && keys.has(cell.key))) throw new TypeError('Key must be a supported, unique physical key');
        if (typeof cell.width !== 'number' || !Number.isFinite(cell.width) || cell.width < 0.5 || cell.width > 8 ||
          cell.width * 4 % 1 !== 0) throw new RangeError('Key width must be 0.5 to 8 in steps of 0.25');
        if (cell.label !== undefined && (typeof cell.label !== 'string' || cell.label.length > MAX_KEY_LABEL_LENGTH)) {
          throw new TypeError(`Key label must have at most ${MAX_KEY_LABEL_LENGTH} characters`);
        }
        keys.add(cell.key);
        return { key: cell.key as KeyboardKeyId, width: cell.width,
          ...(typeof cell.label === 'string' && cell.label.trim() ? { label: cell.label.trim() } : {}) };
      });
      if (getKeyboardPanelSize([cells]).width > MAX_ROW_WIDTH) throw new RangeError('Row is too wide');
      return cells;
    });
    if ([...keys].every((key) => key === 'Spacer')) throw new TypeError('Layout must contain a physical key');
    return { id: layout.id, name: layout.name.trim(), rows };
  });
}

export const CONFIG_FILE_FORMAT = 'keystroke-visualizer-config';
export const CONFIG_SCHEMA_VERSION = 1;
export const MAX_CONFIG_FILE_BYTES = 2 * 1024 * 1024;
export interface ConfigBackup {
  format: typeof CONFIG_FILE_FORMAT;
  schemaVersion: typeof CONFIG_SCHEMA_VERSION;
  appVersion: string;
  exportedAt: string;
  config: ConfigState;
}
export interface ConfigImportPreview extends ConfigBackup {
  token: string;
  fileName: string;
}

export interface KeyboardPanelSize { width: number; height: number }

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
  EXPORT_CONFIG: 'export-config',
  PREVIEW_CONFIG_IMPORT: 'preview-config-import',
  APPLY_CONFIG_IMPORT: 'apply-config-import',

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
  customKeyboardLayouts: [],
  activeCustomKeyboardLayoutId: null,
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
