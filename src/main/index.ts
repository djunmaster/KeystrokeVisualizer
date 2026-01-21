// Main Process Entry
// Batch 6: Full main process integration

import { app, BrowserWindow } from 'electron';
import { ConfigStore } from './ConfigStore';
import { WindowManager } from './WindowManager';
import { TrayManager } from './TrayManager';
import { KeyListener } from './KeyListener';
import { setupIPCHandlers } from './ipc-handlers';

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Module instances
let configStore: ConfigStore;
let windowManager: WindowManager;
let trayManager: TrayManager;
let keyListener: KeyListener;
let shouldStopKeyListener = true;

/**
 * Initialize all modules
 */
function initializeModules(): void {
  // 1. ConfigStore (no dependencies)
  configStore = new ConfigStore();

  // 2. WindowManager (depends on ConfigStore)
  windowManager = new WindowManager(configStore);

  // 3. TrayManager (depends on WindowManager, ConfigStore)
  trayManager = new TrayManager(windowManager, configStore);

  // 4. KeyListener (depends on WindowManager)
  keyListener = new KeyListener(windowManager);

  // 5. Setup IPC handlers
  setupIPCHandlers(configStore, windowManager);
}

/**
 * Start the application
 */
function startApp(): void {
  const config = configStore.getConfig();

  // Create Overlay window (must be created first for correct z-index)
  windowManager.createOverlayWindow(config);

  // Create tray icon
  trayManager.create();

  // Start keyboard listener only when enabled (defer to avoid startup stalls)
  updateKeyListenerState(config.isEnabled);

  // Apply current auto-start setting
  updateAutoStart(config.autoStart);

  // Listen for config changes to update auto-start setting
  configStore.onDidChange((newConfig, oldConfig) => {
    updateAutoStart(newConfig.autoStart);
    if (!oldConfig || newConfig.isEnabled !== oldConfig.isEnabled) {
      updateKeyListenerState(newConfig.isEnabled);
    }
  });
}

/**
 * Update auto-start setting
 */
function updateAutoStart(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
  });
}

/**
 * Start/stop key listener based on enabled state.
 * Defers start so UI can render before hook initialization.
 */
function updateKeyListenerState(enabled: boolean): void {
  if (!keyListener) return;
  if (enabled) {
    setTimeout(() => keyListener.start(), 0);
  } else {
    keyListener.stop();
  }
}

/**
 * Cleanup resources
 */
function cleanup(): void {
  // Stop keyboard listener
  if (keyListener && shouldStopKeyListener) {
    keyListener.stop();
  }

  // Destroy tray
  if (trayManager) {
    trayManager.destroy();
  }

  // Destroy all windows
  if (windowManager) {
    windowManager.destroyAll();
  }
}

// ==================== App Lifecycle Events ====================

// App ready
app.whenReady().then(() => {
  initializeModules();
  startApp();
});

// Handle second instance launch (prevent multiple instances)
app.on('second-instance', () => {
  // Show settings window
  if (windowManager) {
    windowManager.showSettings();
  }
});

// All windows closed (tray app behavior: don't quit)
app.on('window-all-closed', () => {
  // Tray app: keep running when windows are closed
  // Do nothing, keep tray running
});

// App about to quit (set quitting flag)
app.on('before-quit', () => {
  // Skip stopping key listener to avoid exit stalls
  shouldStopKeyListener = false;
  if (windowManager) {
    windowManager.setQuitting(true);
  }
});

// App quitting (cleanup resources)
app.on('will-quit', () => {
  cleanup();
});

// macOS: dock icon clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // If no windows, show settings window
    if (windowManager) {
      windowManager.showSettings();
    }
  }
});
