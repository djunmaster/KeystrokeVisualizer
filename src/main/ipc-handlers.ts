import { app, dialog, ipcMain, Notification } from 'electron';
import { readFile, stat, writeFile } from 'fs/promises';
import { basename } from 'path';
import { randomUUID } from 'crypto';
import { autoUpdater } from 'electron-updater';
import { ConfigStore } from './ConfigStore';
import { WindowManager } from './WindowManager';
import { KeyListener } from './KeyListener';
import { IPC_CHANNELS, ConfigState, MAX_KEYBOARD_SCALE, MIN_KEYBOARD_SCALE, PauseShortcutStatus, UpdateStatus,
  ConfigBackup, ConfigImportPreview, CONFIG_FILE_FORMAT, CONFIG_SCHEMA_VERSION, DEFAULT_CONFIG, MAX_CONFIG_FILE_BYTES,
  KeyboardPanelSize, MAX_ROW_WIDTH, MAX_KEYBOARD_PANEL_HEIGHT, KEYBOARD_PADDING, getKeyboardRows, getConfiguredKeyboardPanelSize, parseCustomKeyboardLayouts } from '../renderer/shared/types';
import { isKeyThemeId, parseCustomStyles } from '../renderer/overlay/key-state';

const MIN_FADE_OUT_DURATION = 200;
const MAX_FADE_OUT_DURATION = 3000;
const MIN_DISPLAY_COUNT = 1;
const MAX_DISPLAY_COUNT = 12;
const FIRST_UPDATE_CHECK_MS = 15_000;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function setupUpdateHandlers(configStore: ConfigStore, windowManager: WindowManager): void {
  const unsupportedReason: UpdateStatus['unsupportedReason'] = !app.isPackaged ? 'development'
    : process.platform !== 'win32' ? 'platform'
      : process.env.PORTABLE_EXECUTABLE_FILE ? 'portable' : undefined;
  const currentVersion = app.getVersion();
  let status: UpdateStatus = unsupportedReason
    ? { phase: 'unsupported', currentVersion, unsupportedReason }
    : { phase: 'idle', currentVersion };
  let notifiedVersion: string | null = null;
  let updateNotification: Notification | null = null;
  const setStatus = (next: Omit<UpdateStatus, 'currentVersion'>) => {
    status = { currentVersion, ...next };
    windowManager.sendToSettings(IPC_CHANNELS.UPDATE_STATUS_CHANGED, status);
  };
  const getStatus = () => status;

  ipcMain.handle(IPC_CHANNELS.GET_UPDATE_STATUS, () => status);

  const checkForUpdates = async (): Promise<UpdateStatus> => {
    if (unsupportedReason || status.phase === 'checking' || status.phase === 'available' || status.phase === 'downloading' ||
      status.phase === 'ready' || status.phase === 'installing') return status;
    setStatus({ phase: 'checking' });
    try {
      await autoUpdater.checkForUpdates();
      if (getStatus().phase === 'checking') setStatus({ phase: 'up-to-date' });
    } catch (error) {
      console.error('Failed to check for updates:', error);
      setStatus({ phase: 'error' });
    }
    return status;
  };
  ipcMain.handle(IPC_CHANNELS.CHECK_FOR_UPDATES, checkForUpdates);
  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_UPDATE, async (): Promise<UpdateStatus> => {
    if (status.phase !== 'available') throw new Error('No update is available to download');
    const availableVersion = status.availableVersion;
    setStatus({ phase: 'downloading', availableVersion, progress: 0 });
    try {
      await autoUpdater.downloadUpdate();
      if (getStatus().phase === 'downloading') setStatus({ phase: 'ready', availableVersion });
    } catch (error) {
      console.error('Failed to download update:', error);
      setStatus({ phase: 'error' });
    }
    return status;
  });
  ipcMain.handle(IPC_CHANNELS.INSTALL_UPDATE, (): UpdateStatus => {
    if (status.phase !== 'ready') throw new Error('No downloaded update is ready to install');
    setStatus({ phase: 'installing', availableVersion: status.availableVersion });
    windowManager.setQuitting(true);
    setImmediate(() => {
      try {
        autoUpdater.quitAndInstall(false, true);
      } catch (error) {
        windowManager.setQuitting(false);
        console.error('Failed to install update:', error);
        setStatus({ phase: 'error' });
      }
    });
    return status;
  });

  if (unsupportedReason) return;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on('update-available', (info) => {
    setStatus({ phase: 'available', availableVersion: info.version });
    if (notifiedVersion === info.version || !Notification.isSupported() ||
      windowManager.getSettingsWindow()?.isVisible()) return;
    notifiedVersion = info.version;
    const chinese = configStore.get('language') === 'zh-CN';
    updateNotification = new Notification({
      title: chinese ? '发现新版本' : 'Update available',
      body: chinese ? `版本 ${info.version} 已可下载。` : `Version ${info.version} is ready to download.`,
    });
    updateNotification.on('click', () => windowManager.showSettings());
    updateNotification.show();
  });
  autoUpdater.on('update-not-available', () => setStatus({ phase: 'up-to-date' }));
  autoUpdater.on('download-progress', (info) => {
    if (status.phase === 'downloading') {
      setStatus({ phase: 'downloading', availableVersion: status.availableVersion,
        progress: Math.max(0, Math.min(100, Math.round(info.percent))) });
    }
  });
  autoUpdater.on('update-downloaded', (info) => setStatus({ phase: 'ready', availableVersion: info.version }));
  autoUpdater.on('error', (error) => {
    console.error('Updater error:', error);
    if (status.phase === 'installing') windowManager.setQuitting(false);
    setStatus({ phase: 'error' });
  });

  const firstCheck = setTimeout(() => { void checkForUpdates(); }, FIRST_UPDATE_CHECK_MS);
  const recurringCheck = setInterval(() => { void checkForUpdates(); }, UPDATE_CHECK_INTERVAL_MS);
  firstCheck.unref();
  recurringCheck.unref();
  app.on('before-quit', () => {
    clearTimeout(firstCheck);
    clearInterval(recurringCheck);
    updateNotification = null;
  });
}

function parseConfigUpdate(input: unknown): Partial<ConfigState> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Config update must be an object');
  }

  const update: Partial<ConfigState> = {};
  for (const [key, value] of Object.entries(input)) {
    switch (key) {
      case 'isEnabled':
      case 'isPaused':
      case 'autoStart':
        if (typeof value !== 'boolean') throw new TypeError(`${key} must be a boolean`);
        update[key] = value;
        break;
      case 'displayMode':
        if (value !== 'history' && value !== 'keyboard') {
          throw new TypeError('displayMode must be history or keyboard');
        }
        update.displayMode = value;
        break;
      case 'keyboardLayout':
        if (value !== 'gaming' && value !== 'arrows' && value !== 'custom') {
          throw new TypeError('keyboardLayout must be gaming, arrows or custom');
        }
        update.keyboardLayout = value;
        break;
      case 'customKeyboardLayouts':
        update.customKeyboardLayouts = parseCustomKeyboardLayouts(value);
        break;
      case 'activeCustomKeyboardLayoutId':
        if (value !== null && typeof value !== 'string') throw new TypeError('activeCustomKeyboardLayoutId must be a string or null');
        update.activeCustomKeyboardLayoutId = value;
        break;
      case 'keyboardScale':
        if (!Number.isInteger(value) || (value as number) < MIN_KEYBOARD_SCALE ||
          (value as number) > MAX_KEYBOARD_SCALE || (value as number) % 10 !== 0) {
          throw new RangeError('keyboardScale must be 60 to 160 in steps of 10');
        }
        update.keyboardScale = value as number;
        break;
      case 'theme':
        if (!isKeyThemeId(value)) throw new TypeError('theme must be a supported key theme');
        update.theme = value;
        break;
      case 'customStyles':
        update.customStyles = parseCustomStyles(value);
        break;
      case 'activeCustomStyleId':
        if (value !== null && typeof value !== 'string') {
          throw new TypeError('activeCustomStyleId must be a string or null');
        }
        update.activeCustomStyleId = value;
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
      case 'displayId':
        if (value !== null && !Number.isSafeInteger(value)) throw new TypeError('displayId must be an integer or null');
        update.displayId = value as number | null;
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

export function parseConfigBackup(input: unknown): ConfigBackup {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Backup must be an object');
  const backup = input as Record<string, unknown>;
  if (backup.format !== CONFIG_FILE_FORMAT || backup.schemaVersion !== CONFIG_SCHEMA_VERSION) {
    throw new TypeError('Unsupported configuration file format or version');
  }
  if (typeof backup.appVersion !== 'string' || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(backup.appVersion) ||
    typeof backup.exportedAt !== 'string' || !Number.isFinite(Date.parse(backup.exportedAt))) {
    throw new TypeError('Invalid backup metadata');
  }
  const parsed = parseConfigUpdate(backup.config);
  if (Object.keys(DEFAULT_CONFIG).some((key) => !Object.prototype.hasOwnProperty.call(parsed, key))) {
    throw new TypeError('Backup is missing required settings');
  }
  const config = parsed as ConfigState;
  if (config.activeCustomStyleId !== null && !config.customStyles.some((style) => style.id === config.activeCustomStyleId)) {
    throw new RangeError('Backup references an unavailable custom style');
  }
  if ((config.activeCustomKeyboardLayoutId !== null || config.keyboardLayout === 'custom') &&
    !config.customKeyboardLayouts.some((layout) => layout.id === config.activeCustomKeyboardLayoutId)) {
    throw new RangeError('Backup references an unavailable custom layout');
  }
  return { format: CONFIG_FILE_FORMAT, schemaVersion: CONFIG_SCHEMA_VERSION,
    appVersion: backup.appVersion, exportedAt: backup.exportedAt, config };
}

function keyboardSize(config: ConfigState): KeyboardPanelSize {
  return getConfiguredKeyboardPanelSize(config.keyboardLayout,
    getKeyboardRows(config.keyboardLayout, config.customKeyboardLayouts, config.activeCustomKeyboardLayoutId));
}

/**
 * Setup all IPC handlers.
 */
export function setupIPCHandlers(
  configStore: ConfigStore,
  windowManager: WindowManager,
  keyListener: KeyListener,
  getPauseShortcutStatus: () => PauseShortcutStatus
): void {
  setupUpdateHandlers(configStore, windowManager);
  ipcMain.handle(IPC_CHANNELS.GET_KEY_STATE, () => keyListener.getKeyState());
  ipcMain.handle(IPC_CHANNELS.GET_PAUSE_SHORTCUT_STATUS, getPauseShortcutStatus);
  // ==================== Config Management ====================

  // Get current config
  ipcMain.handle(IPC_CHANNELS.GET_CONFIG, (): ConfigState => {
    return configStore.getConfig();
  });

  // Update config
  const applyConfigUpdate = (input: unknown): ConfigState => {
    const requested = parseConfigUpdate(input);
    const previous = configStore.getConfig();
    const nextStyles = requested.customStyles ?? previous.customStyles;
    if (typeof requested.activeCustomStyleId === 'string' &&
      !nextStyles.some((style) => style.id === requested.activeCustomStyleId)) {
      throw new RangeError('Active custom style is not available');
    }
    if (requested.customStyles && requested.activeCustomStyleId === undefined &&
      previous.activeCustomStyleId !== null &&
      !nextStyles.some((style) => style.id === previous.activeCustomStyleId)) {
      requested.activeCustomStyleId = null;
    }
    const layouts = requested.customKeyboardLayouts ?? previous.customKeyboardLayouts;
    if (typeof requested.activeCustomKeyboardLayoutId === 'string' &&
      !layouts.some((layout) => layout.id === requested.activeCustomKeyboardLayoutId)) {
      throw new RangeError('Active custom layout is not available');
    }
    if (requested.customKeyboardLayouts && requested.activeCustomKeyboardLayoutId === undefined &&
      !layouts.some((layout) => layout.id === previous.activeCustomKeyboardLayoutId)) {
      requested.activeCustomKeyboardLayoutId = null;
      if (requested.keyboardLayout === undefined && previous.keyboardLayout === 'custom') requested.keyboardLayout = 'gaming';
    }
    const next = { ...previous, ...requested };
    if (next.keyboardLayout === 'custom' && !layouts.some((layout) => layout.id === next.activeCustomKeyboardLayoutId)) {
      throw new RangeError('Select a saved custom layout first');
    }
    const nextSize = keyboardSize(next);
    if (typeof requested.displayId === 'number' && requested.displayId !== previous.displayId) {
      requested.position = windowManager.getPositionOnDisplay(
        requested.displayId, requested.position ?? previous.position,
        requested.maxDisplayCount ?? previous.maxDisplayCount,
        requested.displayMode ?? previous.displayMode,
        requested.keyboardScale ?? previous.keyboardScale, nextSize
      );
    } else if (requested.position) {
      requested.position = windowManager.validatePosition(
        requested.position.x,
        requested.position.y,
        requested.maxDisplayCount ?? previous.maxDisplayCount,
        requested.displayId ?? previous.displayId,
        requested.displayMode ?? previous.displayMode,
        requested.keyboardScale ?? previous.keyboardScale, nextSize
      );
    }

    const changed: Partial<ConfigState> = {};
    if (requested.isEnabled !== undefined && requested.isEnabled !== previous.isEnabled) changed.isEnabled = requested.isEnabled;
    if (requested.isPaused !== undefined && requested.isPaused !== previous.isPaused) changed.isPaused = requested.isPaused;
    if (requested.displayMode !== undefined && requested.displayMode !== previous.displayMode) changed.displayMode = requested.displayMode;
    if (requested.keyboardLayout !== undefined && requested.keyboardLayout !== previous.keyboardLayout) changed.keyboardLayout = requested.keyboardLayout;
    if (requested.activeCustomKeyboardLayoutId !== undefined && requested.activeCustomKeyboardLayoutId !== previous.activeCustomKeyboardLayoutId) {
      changed.activeCustomKeyboardLayoutId = requested.activeCustomKeyboardLayoutId;
    }
    if (requested.customKeyboardLayouts && JSON.stringify(requested.customKeyboardLayouts) !== JSON.stringify(previous.customKeyboardLayouts)) {
      changed.customKeyboardLayouts = requested.customKeyboardLayouts;
    }
    if (requested.keyboardScale !== undefined && requested.keyboardScale !== previous.keyboardScale) changed.keyboardScale = requested.keyboardScale;
    if (requested.theme !== undefined && requested.theme !== previous.theme) changed.theme = requested.theme;
    if (requested.activeCustomStyleId !== undefined && requested.activeCustomStyleId !== previous.activeCustomStyleId) {
      changed.activeCustomStyleId = requested.activeCustomStyleId;
    }
    if (requested.customStyles && (requested.customStyles.length !== previous.customStyles.length ||
      requested.customStyles.some((style, index) => {
        const saved = previous.customStyles[index];
        return style.id !== saved.id || style.name !== saved.name ||
          style.baseTheme !== saved.baseTheme || style.css !== saved.css;
      }))) {
      changed.customStyles = requested.customStyles;
    }
    if (requested.autoStart !== undefined && requested.autoStart !== previous.autoStart) changed.autoStart = requested.autoStart;
    if (requested.fadeOutDuration !== undefined && requested.fadeOutDuration !== previous.fadeOutDuration) changed.fadeOutDuration = requested.fadeOutDuration;
    if (requested.maxDisplayCount !== undefined && requested.maxDisplayCount !== previous.maxDisplayCount) changed.maxDisplayCount = requested.maxDisplayCount;
    if (requested.language !== undefined && requested.language !== previous.language) changed.language = requested.language;
    if (requested.displayId !== undefined && requested.displayId !== previous.displayId) changed.displayId = requested.displayId;
    if (requested.position && (requested.position.x !== previous.position.x || requested.position.y !== previous.position.y)) {
      changed.position = requested.position;
    }
    if (Object.keys(changed).length === 0) return previous;

    const oldSize = keyboardSize(previous);
    const resize = changed.maxDisplayCount !== undefined || changed.displayMode !== undefined ||
      (next.displayMode === 'keyboard' && (changed.keyboardScale !== undefined || oldSize.width !== nextSize.width || oldSize.height !== nextSize.height));
    // Compute the final position before the single store write so imports never publish intermediate settings.
    if (resize && changed.displayId === undefined && !requested.position) {
      changed.position = windowManager.getResizedOverlayPosition(next.maxDisplayCount, next.displayMode, next.keyboardScale, nextSize);
    }
    configStore.updateConfig(changed);
    if (resize || changed.position || changed.displayId !== undefined) {
      const position = configStore.get('position');
      windowManager.updateOverlayPosition(position.x, position.y);
    }

    const finalConfig = configStore.getConfig();
    windowManager.sendToAll(IPC_CHANNELS.CONFIG_CHANGED, finalConfig);

    return finalConfig;
  };

  // ==================== Position Management ====================

  ipcMain.handle(IPC_CHANNELS.GET_DISPLAYS, () => windowManager.getDisplays());

  // Save current Overlay window position to config
  ipcMain.handle(IPC_CHANNELS.UPDATE_POSITION, () => {
    windowManager.saveOverlayPosition();
  });

  // Get preset position coordinates (calculated in main process with Electron screen API)
  ipcMain.handle(IPC_CHANNELS.GET_PRESET_POSITION, (_, preset: string, displayId?: number): { x: number; y: number } => {
    return windowManager.getPresetPosition(preset, displayId);
  });

  // Get current preset name for a given position
  ipcMain.handle(IPC_CHANNELS.GET_PRESET_NAME, (_, position: { x: number; y: number }, displayId?: number): string => {
    return windowManager.detectPresetFromPosition(position, displayId);
  });
  ipcMain.handle(IPC_CHANNELS.UPDATE_CONFIG, (_, input: unknown) => applyConfigUpdate(input));

  let pendingImport: ConfigImportPreview | null = null;
  let transferBusy = false;
  const fileFilters = [{ name: 'JSON', extensions: ['json'] }];
  ipcMain.handle(IPC_CHANNELS.EXPORT_CONFIG, async (): Promise<string | null> => {
    if (transferBusy) throw new Error('Another file operation is in progress');
    transferBusy = true;
    try {
      const options = { defaultPath: `keystroke-config-${new Date().toISOString().slice(0, 10)}.json`, filters: fileFilters };
      const parent = windowManager.getSettingsWindow();
      const result = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options);
      if (result.canceled || !result.filePath) return null;
      const backup: ConfigBackup = { format: CONFIG_FILE_FORMAT, schemaVersion: CONFIG_SCHEMA_VERSION,
        appVersion: app.getVersion(), exportedAt: new Date().toISOString(), config: configStore.getConfig() };
      await writeFile(result.filePath, JSON.stringify(backup, null, 2) + '\n', 'utf8');
      return result.filePath;
    } finally { transferBusy = false; }
  });
  ipcMain.handle(IPC_CHANNELS.PREVIEW_CONFIG_IMPORT, async (): Promise<ConfigImportPreview | null> => {
    if (transferBusy) throw new Error('Another file operation is in progress');
    transferBusy = true;
    pendingImport = null;
    try {
      const options: Electron.OpenDialogOptions = { filters: fileFilters, properties: ['openFile'] };
      const parent = windowManager.getSettingsWindow();
      const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
      if (result.canceled || !result.filePaths[0]) return null;
      const file = result.filePaths[0];
      if ((await stat(file)).size > MAX_CONFIG_FILE_BYTES) throw new RangeError('Configuration file exceeds 2 MB');
      const content = await readFile(file, 'utf8');
      if (Buffer.byteLength(content, 'utf8') > MAX_CONFIG_FILE_BYTES) throw new RangeError('Configuration file exceeds 2 MB');
      const backup = parseConfigBackup(JSON.parse(content.replace(/^\uFEFF/, '')));
      pendingImport = { ...backup, token: randomUUID(), fileName: basename(file) };
      return pendingImport;
    } finally { transferBusy = false; }
  });
  ipcMain.handle(IPC_CHANNELS.APPLY_CONFIG_IMPORT, (_, token: unknown, includePosition: unknown): ConfigState => {
    if (!pendingImport || token !== pendingImport.token) throw new Error('Import preview is no longer available');
    if (typeof includePosition !== 'boolean') throw new TypeError('includePosition must be a boolean');
    const current = configStore.getConfig();
    const imported = pendingImport.config;
    const update: Partial<ConfigState> = { ...imported, isEnabled: current.isEnabled, isPaused: current.isPaused,
      autoStart: current.autoStart, displayId: current.displayId };
    if (includePosition) {
      const size = keyboardSize(imported);
      // The target screen remains local; imported coordinates are clamped to its current work area.
      update.position = windowManager.getPositionPreview(imported.position, imported.maxDisplayCount,
        current.displayId, imported.displayMode, imported.keyboardScale, size).position;
    } else delete update.position;
    const saved = applyConfigUpdate(update);
    pendingImport = null;
    return saved;
  });

  ipcMain.handle(IPC_CHANNELS.GET_POSITION_PREVIEW, (_, position: { x: number; y: number }, maxDisplayCount: number, displayId?: number, displayMode?: ConfigState['displayMode'], keyboardScale?: number, panelSize?: KeyboardPanelSize) => {
    if (!position || !Number.isSafeInteger(position.x) || !Number.isSafeInteger(position.y)) {
      throw new TypeError('position must contain integer x and y coordinates');
    }
    if (!Number.isInteger(maxDisplayCount) || maxDisplayCount < MIN_DISPLAY_COUNT || maxDisplayCount > MAX_DISPLAY_COUNT) {
      throw new RangeError('maxDisplayCount must be an integer between 1 and 12');
    }
    if (displayMode !== undefined && displayMode !== 'history' && displayMode !== 'keyboard') {
      throw new TypeError('displayMode must be history or keyboard');
    }
    if (keyboardScale !== undefined && (!Number.isInteger(keyboardScale) || keyboardScale < MIN_KEYBOARD_SCALE ||
      keyboardScale > MAX_KEYBOARD_SCALE || keyboardScale % 10 !== 0)) {
      throw new RangeError('keyboardScale must be 60 to 160 in steps of 10');
    }
    if (panelSize !== undefined && (!panelSize || !Number.isInteger(panelSize.width) || !Number.isInteger(panelSize.height) ||
      panelSize.width < KEYBOARD_PADDING * 2 || panelSize.width > MAX_ROW_WIDTH ||
      panelSize.height < KEYBOARD_PADDING * 2 || panelSize.height > MAX_KEYBOARD_PANEL_HEIGHT)) {
      throw new RangeError('Invalid keyboard panel dimensions');
    }
    return windowManager.getPositionPreview(position, maxDisplayCount, displayId, displayMode, keyboardScale, panelSize);
  });

  // ==================== Window Control ====================

  // Toggle enabled state
  ipcMain.handle(IPC_CHANNELS.TOGGLE_ENABLED, (): boolean => {
    const newState = configStore.toggleEnabled();

    // Broadcast config change
    const newConfig = configStore.getConfig();
    windowManager.sendToAll(IPC_CHANNELS.CONFIG_CHANGED, newConfig);

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
    if (configStore.get('isEnabled') && !configStore.get('isPaused')) {
      windowManager.showOverlay();
    }
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
