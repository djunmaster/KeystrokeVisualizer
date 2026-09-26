import Store from 'electron-store';
import { ConfigState, DEFAULT_CONFIG, Position } from '../renderer/shared/types';

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
