import Store from 'electron-store';
import { ConfigState, DEFAULT_CONFIG } from '../renderer/shared/types';

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
    // Merge update
    Object.entries(partialConfig).forEach(([key, value]) => {
      this.store.set(key as keyof ConfigState, value);
    });

    return this.getConfig();
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
    this.store.set(key, value);
  }

  /**
   * Reset to defaults.
   */
  reset(): ConfigState {
    this.store.set(DEFAULT_CONFIG);
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
