import { ipcMain } from 'electron';
import { ConfigStore } from './ConfigStore';
import { WindowManager } from './WindowManager';
import { IPC_CHANNELS, ConfigState } from '../renderer/shared/types';

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
  ipcMain.handle(IPC_CHANNELS.UPDATE_CONFIG, (_, partialConfig: Partial<ConfigState>): ConfigState => {
    // Validate position before saving to ensure config stores valid values
    if (partialConfig.position) {
      const nextCount =
        typeof partialConfig.maxDisplayCount === 'number'
          ? partialConfig.maxDisplayCount
          : configStore.get('maxDisplayCount');
      partialConfig.position = windowManager.validatePosition(
        partialConfig.position.x,
        partialConfig.position.y,
        nextCount
      );
    }

    const newConfig = configStore.updateConfig(partialConfig);

    // Broadcast config change to all windows
    windowManager.sendToAll(IPC_CHANNELS.CONFIG_CHANGED, newConfig);

    // Apply position change to overlay window
    if (partialConfig.position) {
      windowManager.updateOverlayPosition(partialConfig.position.x, partialConfig.position.y);
    }

    // Apply size change to overlay window
    if (typeof partialConfig.maxDisplayCount === 'number') {
      windowManager.updateOverlaySize(partialConfig.maxDisplayCount);
    }

    // Handle isEnabled state change (strict boolean check)
    if (typeof partialConfig.isEnabled === 'boolean') {
      if (partialConfig.isEnabled) {
        windowManager.showOverlay();
      } else {
        windowManager.hideOverlay();
      }
    }

    return newConfig;
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
