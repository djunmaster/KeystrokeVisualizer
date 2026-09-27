// Main Process Entry
// Batch 6: Full main process integration

import { app, BrowserWindow, globalShortcut } from 'electron';
import { ConfigStore } from './ConfigStore';
import { WindowManager } from './WindowManager';
import { TrayManager } from './TrayManager';
import { KeyListener } from './KeyListener';
import { setupIPCHandlers } from './ipc-handlers';
import { IPC_CHANNELS, PAUSE_ACCELERATOR } from '../renderer/shared/types';

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
let pendingKeyListenerStart: ReturnType<typeof setTimeout> | null = null;
let pauseShortcutRegistered = false;

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
  keyListener = new KeyListener(windowManager, configStore);

  // 5. Setup IPC handlers
  setupIPCHandlers(configStore, windowManager, keyListener, () => ({
    accelerator: PAUSE_ACCELERATOR,
    registered: pauseShortcutRegistered,
  }));
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

  try {
    pauseShortcutRegistered = globalShortcut.register(PAUSE_ACCELERATOR, () => {
      if (!configStore.get('isEnabled')) return;
      configStore.set('isPaused', !configStore.get('isPaused'));
      windowManager.sendToAll(IPC_CHANNELS.CONFIG_CHANGED, configStore.getConfig());
    });
  } catch (error) {
    console.warn('Failed to register pause shortcut:', error);
  }
  keyListener.setPauseShortcutRegistered(pauseShortcutRegistered);
  if (!pauseShortcutRegistered) console.warn('Pause shortcut is unavailable:', PAUSE_ACCELERATOR);

  updateDisplayState(config.isEnabled && !config.isPaused);

  // Apply current auto-start setting
  updateAutoStart(config.autoStart);

  // Listen for config changes to update auto-start and key listener state
  configStore.onDidChange((newConfig, oldConfig) => {
    // Only update auto-start if the value actually changed
    if (!oldConfig || newConfig.autoStart !== oldConfig.autoStart) {
      updateAutoStart(newConfig.autoStart);
    }
    if (!oldConfig || newConfig.isEnabled !== oldConfig.isEnabled || newConfig.isPaused !== oldConfig.isPaused) {
      updateDisplayState(newConfig.isEnabled && !newConfig.isPaused);
    }
  });
}

function updateDisplayState(active: boolean): void {
  updateKeyListenerState(active);
  if (active) {
    windowManager.showOverlay();
  } else {
    windowManager.hideOverlay();
  }
}

/**
 * Update auto-start setting
 * Uses setImmediate to avoid blocking the UI thread on Windows
 */
function updateAutoStart(enabled: boolean): void {
  if (!app.isPackaged || (process.platform !== 'win32' && process.platform !== 'darwin')) return;
  setImmediate(() => {
    app.setLoginItemSettings({
      openAtLogin: enabled,
    });
  });
}

/**
 * Start/stop key listener based on enabled state.
 * Defers start so UI can render before hook initialization.
 */
function updateKeyListenerState(enabled: boolean): void {
  if (!keyListener) return;
  if (pendingKeyListenerStart !== null) {
    clearTimeout(pendingKeyListenerStart);
    pendingKeyListenerStart = null;
  }
  if (enabled) {
    pendingKeyListenerStart = setTimeout(() => {
      pendingKeyListenerStart = null;
      try {
        keyListener.start();
      } catch (error) {
        console.error('Failed to start keyboard listener:', error);
        configStore.set('isEnabled', false);
        windowManager.hideOverlay();
        windowManager.sendToAll(IPC_CHANNELS.CONFIG_CHANGED, configStore.getConfig());
      }
    }, 0);
  } else {
    try {
      keyListener.stop();
    } catch (error) {
      console.error('Failed to stop keyboard listener:', error);
    }
  }
}

/**
 * Cleanup resources
 */
function cleanup(): void {
  globalShortcut.unregister(PAUSE_ACCELERATOR);
  pauseShortcutRegistered = false;
  if (pendingKeyListenerStart !== null) {
    clearTimeout(pendingKeyListenerStart);
    pendingKeyListenerStart = null;
  }
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
  if (!gotTheLock) return;
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
  if (pendingKeyListenerStart !== null) {
    clearTimeout(pendingKeyListenerStart);
    pendingKeyListenerStart = null;
  }
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
