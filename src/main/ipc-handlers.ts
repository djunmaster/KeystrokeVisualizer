import { ipcMain } from 'electron';
import { ConfigStore } from './ConfigStore';
import { WindowManager } from './WindowManager';
import { IPC_CHANNELS, ConfigState } from '../renderer/shared/types';

const MIN_FADE_OUT_DURATION = 200;
const MAX_FADE_OUT_DURATION = 3000;
const MIN_DISPLAY_COUNT = 1;
const MAX_DISPLAY_COUNT = 12;

function parseConfigUpdate(input: unknown): Partial<ConfigState> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Config update must be an object');
  }

  const update: Partial<ConfigState> = {};
  for (const [key, value] of Object.entries(input)) {
    switch (key) {
      case 'isEnabled':
      case 'autoStart':
        if (typeof value !== 'boolean') throw new TypeError(`${key} must be a boolean`);
        update[key] = value;
        break;
      case 'fadeOutDuration':
        if (!Number.isInteger(value) || (value as number) < MIN_FADE_OUT_DURATION || (value as number) > MAX_FADE_OUT_DURATION) {
          throw new RangeError('fadeOutDuration must be between 200 and 3000 ms');
        }
        update.fadeOutDuration = value as number;
        break;
      case 'maxDisplayCount':
        if (!Number.isInteger(value) || (value as number) < MIN_DISPLAY_COUNT || (value as number) > MAX_DISPLAY_COUNT) {
          throw new RangeError('maxDisplayCount must be an integer between 1 and 12');
        }
        update.maxDisplayCount = value as number;
        break;
      case 'language':
        if (value !== 'zh-CN' && value !== 'en-US') {
          throw new TypeError('language must be zh-CN or en-US');
        }
        update.language = value;
        break;
      case 'position': {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw new TypeError('position must contain integer x and y coordinates');
        }
        const position = value as Record<string, unknown>;
        if (!Number.isSafeInteger(position.x) || !Number.isSafeInteger(position.y)) {
          throw new TypeError('position must contain integer x and y coordinates');
        }
        update.position = { x: position.x as number, y: position.y as number };
        break;
      }
      default:
        throw new TypeError(`Unknown config key: ${key}`);
    }
  }
  return update;
}

/**
 * Setup all IPC handlers.
 */
export function setupIPCHandlers(configStore: ConfigStore, windowManager: WindowManager): void {
  // ==================== Config Management ====================

  // Get current config
  ipcMain.handle(IPC_CHANNELS.GET_CONFIG, (): ConfigState => {
    return configStore.getConfig();
  });

  // Update config
  ipcMain.handle(IPC_CHANNELS.UPDATE_CONFIG, (_, input: unknown): ConfigState => {
    const requested = parseConfigUpdate(input);
    const previous = configStore.getConfig();
    if (requested.position) {
      requested.position = windowManager.validatePosition(
        requested.position.x,
        requested.position.y,
        requested.maxDisplayCount ?? previous.maxDisplayCount
      );
    }

    const changed: Partial<ConfigState> = {};
    if (requested.isEnabled !== undefined && requested.isEnabled !== previous.isEnabled) changed.isEnabled = requested.isEnabled;
    if (requested.autoStart !== undefined && requested.autoStart !== previous.autoStart) changed.autoStart = requested.autoStart;
    if (requested.fadeOutDuration !== undefined && requested.fadeOutDuration !== previous.fadeOutDuration) changed.fadeOutDuration = requested.fadeOutDuration;
    if (requested.maxDisplayCount !== undefined && requested.maxDisplayCount !== previous.maxDisplayCount) changed.maxDisplayCount = requested.maxDisplayCount;
    if (requested.language !== undefined && requested.language !== previous.language) changed.language = requested.language;
    if (requested.position && (requested.position.x !== previous.position.x || requested.position.y !== previous.position.y)) {
      changed.position = requested.position;
    }
    if (Object.keys(changed).length === 0) return previous;

    // Resize before applying an explicit position so the requested coordinates win.
    if (changed.maxDisplayCount !== undefined) {
      windowManager.updateOverlaySize(changed.maxDisplayCount);
    }
    configStore.updateConfig(changed);
    if (changed.position) {
      windowManager.updateOverlayPosition(changed.position.x, changed.position.y);
    }
    if (changed.isEnabled !== undefined) {
      if (changed.isEnabled) {
        windowManager.showOverlay();
      } else {
        windowManager.hideOverlay();
      }
    }

    const finalConfig = configStore.getConfig();
    windowManager.sendToAll(IPC_CHANNELS.CONFIG_CHANGED, finalConfig);

    return finalConfig;
  });

  // ==================== Position Management ====================

  // Save current Overlay window position to config
  ipcMain.handle(IPC_CHANNELS.UPDATE_POSITION, () => {
    // Read actual window position (don't modify it)
    const overlayWindow = windowManager.getOverlayWindow();
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const [x, y] = overlayWindow.getPosition();
      configStore.set('position', { x, y });
      // Broadcast config change to all windows
      windowManager.sendToAll(IPC_CHANNELS.CONFIG_CHANGED, configStore.getConfig());
    }
  });

  // Get preset position coordinates (calculated in main process with Electron screen API)
  ipcMain.handle(IPC_CHANNELS.GET_PRESET_POSITION, (_, preset: string): { x: number; y: number } => {
    return windowManager.getPresetPosition(preset);
  });

  // Get current preset name for a given position
  ipcMain.handle(IPC_CHANNELS.GET_PRESET_NAME, (_, position: { x: number; y: number }): string => {
    return windowManager.detectPresetFromPosition(position);
  });

  ipcMain.handle(IPC_CHANNELS.GET_POSITION_PREVIEW, (_, position: { x: number; y: number }, maxDisplayCount: number) => {
    if (!position || !Number.isSafeInteger(position.x) || !Number.isSafeInteger(position.y)) {
      throw new TypeError('position must contain integer x and y coordinates');
    }
    if (!Number.isInteger(maxDisplayCount) || maxDisplayCount < MIN_DISPLAY_COUNT || maxDisplayCount > MAX_DISPLAY_COUNT) {
      throw new RangeError('maxDisplayCount must be an integer between 1 and 12');
    }
    return windowManager.getPositionPreview(position, maxDisplayCount);
  });

  // ==================== Window Control ====================

  // Toggle enabled state
  ipcMain.handle(IPC_CHANNELS.TOGGLE_ENABLED, (): boolean => {
    const newState = configStore.toggleEnabled();

    // Broadcast config change
    const newConfig = configStore.getConfig();
    windowManager.sendToAll(IPC_CHANNELS.CONFIG_CHANGED, newConfig);

    // Update overlay visibility
    if (newState) {
      windowManager.showOverlay();
    } else {
      windowManager.hideOverlay();
    }

    return newState;
  });

  // Open Settings window
  ipcMain.handle(IPC_CHANNELS.OPEN_SETTINGS, () => {
    windowManager.showSettings();
  });

  // Close Settings window
  ipcMain.handle(IPC_CHANNELS.CLOSE_SETTINGS, () => {
    windowManager.hideSettings();
  });

  // Show Overlay window
  ipcMain.handle(IPC_CHANNELS.SHOW_OVERLAY, () => {
    windowManager.showOverlay();
  });

  // Hide Overlay window
  ipcMain.handle(IPC_CHANNELS.HIDE_OVERLAY, () => {
    windowManager.hideOverlay();
  });

  // Set mouse pass-through for Overlay window
  ipcMain.handle(IPC_CHANNELS.SET_MOUSE_PASSTHROUGH, (_, enabled: boolean) => {
    windowManager.setOverlayMousePassThrough(enabled);
  });

  // ==================== App Control ====================

  // Quit app (handled in TrayManager)
  // This is just a placeholder, actual implementation in main/index.ts
}
