import Store from 'electron-store';
import { ConfigState, DEFAULT_CONFIG, MAX_KEYBOARD_SCALE, MIN_KEYBOARD_SCALE, Position, parseCustomKeyboardLayouts } from '../renderer/shared/types';
import { isKeyThemeId, parseCustomStyles } from '../renderer/overlay/key-state';

function isPosition(value: unknown): value is Position {
  return typeof value === 'object' && value !== null &&
    'x' in value && typeof value.x === 'number' && Number.isInteger(value.x) &&
    'y' in value && typeof value.y === 'number' && Number.isInteger(value.y);
}

/**
 * Config storage manager.
 * Uses electron-store for persistence.
 */
export class ConfigStore {
  private store: Store<ConfigState>;

  constructor() {
    // Initialize electron-store
    this.store = new Store<ConfigState>({
      defaults: DEFAULT_CONFIG,
      name: 'config',
    });

    const persisted = this.store.store as unknown as Record<keyof ConfigState, unknown>;
    const repaired: Partial<ConfigState> = {};
    if (typeof persisted.isEnabled !== 'boolean') repaired.isEnabled = DEFAULT_CONFIG.isEnabled;
    if (typeof persisted.isPaused !== 'boolean') repaired.isPaused = DEFAULT_CONFIG.isPaused;
    if (persisted.displayMode !== 'history' && persisted.displayMode !== 'keyboard') {
      repaired.displayMode = DEFAULT_CONFIG.displayMode;
    }
    if (persisted.keyboardLayout !== 'gaming' && persisted.keyboardLayout !== 'arrows' && persisted.keyboardLayout !== 'custom') {
      repaired.keyboardLayout = DEFAULT_CONFIG.keyboardLayout;
    }
    let customLayouts: ConfigState['customKeyboardLayouts'];
    try {
      customLayouts = parseCustomKeyboardLayouts(persisted.customKeyboardLayouts);
    } catch {
      customLayouts = [];
      repaired.customKeyboardLayouts = customLayouts;
    }
    if (persisted.activeCustomKeyboardLayoutId !== null && (typeof persisted.activeCustomKeyboardLayoutId !== 'string' ||
      !customLayouts.some((layout) => layout.id === persisted.activeCustomKeyboardLayoutId))) {
      repaired.activeCustomKeyboardLayoutId = null;
    }
    if (persisted.keyboardLayout === 'custom' && !customLayouts.some((layout) => layout.id === persisted.activeCustomKeyboardLayoutId)) {
      repaired.keyboardLayout = DEFAULT_CONFIG.keyboardLayout;
    }
    if (!Number.isInteger(persisted.keyboardScale) ||
      (persisted.keyboardScale as number) < MIN_KEYBOARD_SCALE ||
      (persisted.keyboardScale as number) > MAX_KEYBOARD_SCALE ||
      (persisted.keyboardScale as number) % 10 !== 0) {
      repaired.keyboardScale = DEFAULT_CONFIG.keyboardScale;
    }
    if (!isKeyThemeId(persisted.theme)) repaired.theme = DEFAULT_CONFIG.theme;
    let customStyles: ConfigState['customStyles'];
    try {
      customStyles = parseCustomStyles(persisted.customStyles);
    } catch {
      customStyles = [];
      repaired.customStyles = customStyles;
    }
    if (persisted.activeCustomStyleId !== null && (
      typeof persisted.activeCustomStyleId !== 'string' ||
      !customStyles.some((style) => style.id === persisted.activeCustomStyleId)
    )) {
      repaired.activeCustomStyleId = null;
    }
    if (typeof persisted.autoStart !== 'boolean') repaired.autoStart = DEFAULT_CONFIG.autoStart;
    if (!Number.isInteger(persisted.fadeOutDuration) ||
      (persisted.fadeOutDuration as number) < 200 || (persisted.fadeOutDuration as number) > 3000) {
      repaired.fadeOutDuration = DEFAULT_CONFIG.fadeOutDuration;
    }
    if (!Number.isInteger(persisted.maxDisplayCount) ||
      (persisted.maxDisplayCount as number) < 1 || (persisted.maxDisplayCount as number) > 12) {
      repaired.maxDisplayCount = DEFAULT_CONFIG.maxDisplayCount;
    }
    if (!isPosition(persisted.position)) repaired.position = DEFAULT_CONFIG.position;
    if (persisted.displayId !== null && !Number.isSafeInteger(persisted.displayId)) {
      repaired.displayId = DEFAULT_CONFIG.displayId;
    }
    if (persisted.language !== 'zh-CN' && persisted.language !== 'en-US') {
      repaired.language = DEFAULT_CONFIG.language;
    }
    if (Object.keys(repaired).length > 0) this.store.set(repaired);
  }

  /**
   * Get a full config snapshot.
   * Merges with defaults to ensure all fields exist (for migration).
   */
  getConfig(): ConfigState {
    return { ...DEFAULT_CONFIG, ...this.store.store };
  }

  /**
   * Update config (partial update).
   */
  updateConfig(partialConfig: Partial<ConfigState>): ConfigState {
    const current = this.store.store;
    const changed = Object.fromEntries(
      Object.entries(partialConfig).filter(([key, value]) => {
        const previous = current[key as keyof ConfigState];
        if (key === 'customKeyboardLayouts') return JSON.stringify(value) !== JSON.stringify(previous);
        if (key === 'customStyles') {
          const nextStyles = value as ConfigState['customStyles'];
          const previousStyles = previous as ConfigState['customStyles'];
          return nextStyles.length !== previousStyles.length || nextStyles.some((style, index) => {
            const saved = previousStyles[index];
            return style.id !== saved.id || style.name !== saved.name ||
              style.baseTheme !== saved.baseTheme || style.css !== saved.css;
          });
        }
        return key === 'position' && value && previous
          ? (value as ConfigState['position']).x !== (previous as ConfigState['position']).x ||
              (value as ConfigState['position']).y !== (previous as ConfigState['position']).y
          : value !== previous;
      })
    ) as Partial<ConfigState>;

    if (Object.keys(changed).length > 0) {
      this.store.set(changed);
    }

    return { ...DEFAULT_CONFIG, ...current, ...changed };
  }

  /**
   * Get a single config field.
   */
  get<K extends keyof ConfigState>(key: K): ConfigState[K] {
    return this.store.get(key);
  }

  /**
   * Set a single config field.
   */
  set<K extends keyof ConfigState>(key: K, value: ConfigState[K]): void {
    this.updateConfig({ [key]: value });
  }

  /**
   * Reset to defaults.
   */
  reset(): ConfigState {
    this.store.store = { ...DEFAULT_CONFIG };
    return this.getConfig();
  }

  /**
   * Toggle enabled state.
   */
  toggleEnabled(): boolean {
    const currentState = this.get('isEnabled');
    const newState = !currentState;
    this.set('isEnabled', newState);
    return newState;
  }

  /**
   * Listen for config changes.
   */
  onDidChange(callback: (newConfig: ConfigState, oldConfig?: ConfigState) => void): void {
    this.store.onDidAnyChange((newValue, oldValue) => {
      callback(newValue as ConfigState, oldValue as ConfigState | undefined);
    });
  }
}
