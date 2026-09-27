import { parse } from 'postcss';
import { CustomKeyStyle, ConfigState, KeyPressEvent, KeyStateEvent, KeyThemeId, KEY_THEME_IDS,
  MAX_CUSTOM_CSS_LENGTH, MAX_CUSTOM_STYLES, MAX_STYLE_NAME_LENGTH } from '../shared/types';

export { KEY_THEMES } from '../shared/types';

export const CONSECUTIVE_KEY_WINDOW_MS = 800;

export interface DisplayKeyPress extends KeyPressEvent {
  id: number;
  count: number;
  held: boolean;
  releasedAt: number | null;
}

export interface KeyDisplayState {
  history: DisplayKeyPress[];
  heldKeyCodes: number[];
  nextId: number;
}

export function createKeyDisplayState(): KeyDisplayState {
  return { history: [], heldKeyCodes: [], nextId: 0 };
}

function matchesKey(item: DisplayKeyPress, event: KeyPressEvent): boolean {
  return item.keyCode === event.keyCode && item.keys.length === event.keys.length &&
    item.keys.every((key, index) => key === event.keys[index]);
}

export function applyKeyPress(state: KeyDisplayState, event: KeyPressEvent, limit: number): KeyDisplayState {
  const lastIndex = state.history.length - 1;
  let mergeIndex = -1;
  if (event.repeat) {
    for (let index = lastIndex; index >= 0; index--) {
      if (matchesKey(state.history[index], event)) {
        mergeIndex = index;
        break;
      }
    }
  } else if (lastIndex >= 0 && matchesKey(state.history[lastIndex], event) &&
    event.timestamp - state.history[lastIndex].timestamp <= CONSECUTIVE_KEY_WINDOW_MS) {
    mergeIndex = lastIndex;
  }

  const previous = mergeIndex >= 0 ? state.history[mergeIndex] : undefined;
  const held = event.keyCode !== undefined;
  const item: DisplayKeyPress = {
    ...event,
    keys: [...event.keys],
    id: previous?.id ?? state.nextId,
    count: (previous?.count ?? 0) + 1,
    held,
    releasedAt: held ? null : event.timestamp,
  };
  const history = [...state.history.filter((_, index) => index !== mergeIndex), item].slice(-Math.max(1, limit));
  const heldKeyCodes = event.keyCode !== undefined && !state.heldKeyCodes.includes(event.keyCode)
    ? [...state.heldKeyCodes, event.keyCode] : state.heldKeyCodes;
  return { history, heldKeyCodes, nextId: state.nextId + (previous ? 0 : 1) };
}

export function applyKeyState(state: KeyDisplayState, event: KeyStateEvent): KeyDisplayState {
  const heldKeyCodes = [...event.keyCodes];
  return {
    ...state,
    heldKeyCodes,
    history: state.history.map((item) => item.held && item.keyCode !== undefined && !heldKeyCodes.includes(item.keyCode)
      ? { ...item, held: false, releasedAt: event.timestamp } : item),
  };
}

export function pruneHistory(state: KeyDisplayState, now: number, duration: number): KeyDisplayState {
  const history = state.history.filter((item) => item.held || item.releasedAt === null ||
    item.releasedAt + duration > now);
  return history.length === state.history.length ? state : { ...state, history };
}

export function getNextExpiry(history: DisplayKeyPress[], duration: number): number | null {
  let nextExpiry: number | null = null;
  for (const item of history) {
    if (!item.held && item.releasedAt !== null) {
      const expiry = item.releasedAt + duration;
      if (nextExpiry === null || expiry < nextExpiry) nextExpiry = expiry;
    }
  }
  return nextExpiry;
}

export function isPanelKeyHeld(scanCodes: readonly number[], heldKeyCodes: readonly number[]): boolean {
  return scanCodes.some((code) => heldKeyCodes.includes(code));
}

export const CUSTOM_CSS_TEMPLATE = `.kv-key {
  border-radius: 6px;
  font-weight: 600;
}

.kv-key[data-held="true"] {
  background: #69e0a5;
  color: #102619;
  box-shadow: 0 0 8px #69e0a550;
}

.kv-key[data-key="Space"] {
  border-color: #69e0a5;
}`;

type ThemePalette = {
  row: string; text: string; rowBorder: string; rowRadius: string; rowShadow: string;
  key: string; panel: string; keyText: string; keyBorder: string; keyRadius: string; keyShadow: string;
  modifier: string; modifierText: string; main: string; mainText: string; mainBorder: string;
  held: string; heldText: string; heldBorder: string; heldMain: string; count: string; plus: string;
};

const palettes: Record<KeyThemeId, ThemePalette> = {
  classic: {
    row: 'rgba(0,0,0,.8)', text: '#fff', rowBorder: '1px solid transparent', rowRadius: '8px', rowShadow: '0 3px 8px #0003',
    key: 'rgba(255,255,255,.2)', panel: 'rgba(0,0,0,.8)', keyText: '#fff', keyBorder: '1px solid transparent', keyRadius: '4px', keyShadow: 'none',
    modifier: 'rgba(255,255,255,.2)', modifierText: '#fff', main: 'rgba(255,255,255,.2)', mainText: '#fff', mainBorder: '1px solid transparent',
    held: '#67e8f9', heldText: '#111827', heldBorder: '1px solid #a5f3fc', heldMain: '#67e8f9', count: '#a5f3fc', plus: '#ffffff99',
  },
  paper: {
    row: '#e6e9ec', text: '#25282d', rowBorder: '1px solid #c4c9cf', rowRadius: '8px', rowShadow: '0 3px 8px #0001',
    key: '#fff', panel: '#fff', keyText: '#25282d', keyBorder: '1px solid #c4c9cf', keyRadius: '4px', keyShadow: '0 2px 0 #b8bec6',
    modifier: '#fff', modifierText: '#25282d', main: '#fff', mainText: '#25282d', mainBorder: '1px solid #c4c9cf',
    held: '#2563eb', heldText: '#fff', heldBorder: '1px solid #1d4ed8', heldMain: '#2563eb', count: '#1d4ed8', plus: '#60676d',
  },
  mint: {
    row: '#161d19', text: '#e8f5ee', rowBorder: '1px solid #304437', rowRadius: '4px', rowShadow: 'inset 3px 0 #69e0a5',
    key: '#253d30', panel: '#161d19', keyText: '#e8f5ee', keyBorder: '1px solid #3b634d', keyRadius: '4px', keyShadow: 'none',
    modifier: 'transparent', modifierText: '#7aefb4', main: '#253d30', mainText: '#e8f5ee', mainBorder: '1px solid #3b634d',
    held: '#69e0a5', heldText: '#102619', heldBorder: '1px solid #a8f5cc', heldMain: '#69e0a5', count: '#7aefb4', plus: '#96b6a4',
  },
  neon: {
    row: '#191a22', text: '#ecfaff', rowBorder: '1px solid #61dced', rowRadius: '3px', rowShadow: '0 0 8px #61dced24',
    key: '#202c36', panel: '#202c36', keyText: '#91f3ff', keyBorder: '1px solid #61dced', keyRadius: '2px', keyShadow: '0 2px 0 #61dced',
    modifier: '#202c36', modifierText: '#91f3ff', main: '#422a3b', mainText: '#ffc4ee', mainBorder: '1px solid #f487ce',
    held: '#61dced', heldText: '#191a22', heldBorder: '1px solid #ecfaff', heldMain: '#f487ce', count: '#ffc4ee', plus: '#91f3ff',
  },
  contrast: {
    row: '#ffe45c', text: '#111', rowBorder: '2px solid #111', rowRadius: '2px', rowShadow: 'none',
    key: '#111', panel: '#111', keyText: '#fff', keyBorder: '2px solid #111', keyRadius: '2px', keyShadow: 'none',
    modifier: '#111', modifierText: '#fff', main: '#111', mainText: '#fff', mainBorder: '2px solid #111',
    held: '#ffe45c', heldText: '#111', heldBorder: '2px solid #111', heldMain: '#ffe45c', count: '#111', plus: '#111',
  },
  outline: {
    row: 'transparent', text: '#252525', rowBorder: '1px solid transparent', rowRadius: '4px', rowShadow: 'none',
    key: '#fff', panel: '#fff', keyText: '#252525', keyBorder: '1px solid #4f5357', keyRadius: '4px', keyShadow: '0 2px 3px #0002',
    modifier: '#fff', modifierText: '#252525', main: '#fff', mainText: '#252525', mainBorder: '1px solid #4f5357',
    held: '#e0f2fe', heldText: '#0c4a6e', heldBorder: '1px solid #0284c7', heldMain: '#e0f2fe', count: '#252525', plus: '#252525',
  },
};

export function isKeyThemeId(value: unknown): value is KeyThemeId {
  return typeof value === 'string' && (KEY_THEME_IDS as readonly string[]).includes(value);
}

function decodeCssEscapes(value: string): string {
  return value.replace(/\\([0-9a-f]{1,6})(?:\r\n|[ \t\r\n\f])?|\\([^\r\n\f])/gi, (_, hex: string, literal: string) => {
    if (!hex) return literal;
    const point = parseInt(hex, 16);
    return point === 0 || point > 0x10ffff ? '\uFFFD' : String.fromCodePoint(point);
  });
}

function parseKeyCss(css: string) {
  if (typeof css !== 'string' || css.length > MAX_CUSTOM_CSS_LENGTH) {
    throw new TypeError(`CSS must be a string of at most ${MAX_CUSTOM_CSS_LENGTH} characters`);
  }
  const root = parse(css, { from: undefined, map: false });
  root.walkAtRules((rule) => {
    if (rule.parent?.type !== 'root' && rule.parent?.type !== 'atrule') {
      throw new TypeError('Nested selectors are not supported');
    }
    const name = decodeCssEscapes(rule.name).toLowerCase();
    if ((name !== 'media' && name !== 'supports') || !rule.nodes) {
      throw new TypeError(`Unsupported CSS rule: @${rule.name}`);
    }
    rule.name = name;
  });
  root.walkRules((rule) => {
    if (rule.parent?.type !== 'root' && rule.parent?.type !== 'atrule') {
      throw new TypeError('Nested selectors are not supported');
    }
    if (!rule.selector.trim()) throw new TypeError('CSS selector cannot be empty');
  });
  root.walkDecls((declaration) => {
    if (declaration.parent?.type !== 'rule') throw new TypeError('CSS declarations need a selector');
    const value = decodeCssEscapes(declaration.value.replace(/\/\*[\s\S]*?\*\//g, ''));
    const property = decodeCssEscapes(declaration.prop).toLowerCase();
    if (/\b(?:url|image|image-set|-webkit-image-set|paint|expression)\s*\(/i.test(value) ||
      property === 'behavior' || property === '-moz-binding') {
      throw new TypeError('External resources and executable CSS are not supported');
    }
  });
  return root;
}

export function validateCustomCss(css: string): { valid: boolean; error?: string } {
  try {
    parseKeyCss(css);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function parseCustomStyles(value: unknown): CustomKeyStyle[] {
  if (!Array.isArray(value) || value.length > MAX_CUSTOM_STYLES) {
    throw new TypeError(`customStyles must contain at most ${MAX_CUSTOM_STYLES} styles`);
  }
  const ids = new Set<string>();
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new TypeError('Invalid custom style');
    const style = entry as Record<string, unknown>;
    if (Object.keys(style).some((key) => !['id', 'name', 'baseTheme', 'css'].includes(key)) ||
      typeof style.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(style.id) || ids.has(style.id) ||
      typeof style.name !== 'string' || !style.name.trim() || style.name.trim().length > MAX_STYLE_NAME_LENGTH ||
      !isKeyThemeId(style.baseTheme) || typeof style.css !== 'string') {
      throw new TypeError('Custom styles need a unique id, a name, a base theme, and CSS');
    }
    parseKeyCss(style.css);
    ids.add(style.id);
    return { id: style.id, name: style.name.trim(), baseTheme: style.baseTheme, css: style.css };
  });
}

export function getActiveKeyStyle(config: Pick<ConfigState, 'theme' | 'customStyles' | 'activeCustomStyleId'>): { theme: KeyThemeId; css: string } {
  const custom = config.customStyles.find((style) => style.id === config.activeCustomStyleId);
  return custom ? { theme: custom.baseTheme, css: custom.css } : { theme: config.theme, css: '' };
}

export function getThemeCss(theme: KeyThemeId, scope: string, customCss = ''): string {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(scope)) throw new TypeError('Invalid style scope');
  const prefix = `:where([data-style-scope="${scope}"])`;
  const palette = palettes[theme] ?? palettes.classic;
  const scoped = (selector: string) => `${prefix} :where(${selector})`;
  let result = `${scoped('.kv-row')} { background:${palette.row}; color:${palette.text}; border:${palette.rowBorder}; border-radius:${palette.rowRadius}; box-shadow:${palette.rowShadow}; }
${scoped('.kv-key')} { background:${palette.key}; color:${palette.keyText}; border:${palette.keyBorder}; border-radius:${palette.keyRadius}; box-shadow:${palette.keyShadow}; transition:background-color 100ms,color 100ms,border-color 100ms,box-shadow 100ms; }
${scoped('.kv-key[data-role="modifier"]')} { background:${palette.modifier}; color:${palette.modifierText}; }
${scoped('.kv-key[data-role="main"]')} { background:${palette.main}; color:${palette.mainText}; border:${palette.mainBorder}; }
${scoped('.kv-panel-key')} { background:${palette.panel}; border-radius:${palette.rowRadius}; font-size:var(--kv-panel-font-size,18px); line-height:1; }
${scoped('.kv-key[data-held="true"]')} { background:${palette.held}; color:${palette.heldText}; border:${palette.heldBorder}; box-shadow:inset 0 1px 3px #0002; }
${scoped('.kv-key[data-role="main"][data-held="true"]')} { background:${palette.heldMain}; }
${scoped('.kv-count')} { color:${palette.count}; }
${scoped('.kv-plus')} { color:${palette.plus}; }
@media (prefers-reduced-motion: reduce) { ${scoped('.kv-key')} { transition:none; } }
`;
  if (customCss.trim()) {
    try {
      const root = parseKeyCss(customCss);
      // :is() preserves selector lists containing commas inside pseudo classes.
      root.walkRules((rule) => { rule.selector = `${prefix} :is(${rule.selector})`; });
      result += root.toString();
    } catch {
      // Persisted files can be edited externally; keep the built-in theme usable.
    }
  }
  return result;
}
