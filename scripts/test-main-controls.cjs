const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const plain = (value) => JSON.parse(JSON.stringify(value));

function load(relativePath, dependencies = {}, globals = {}) {
  const file = path.join(root, relativePath);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, process, console, Buffer, setTimeout, clearTimeout, setImmediate,
    require: (name) => dependencies[name] ?? require(name), ...globals,
  }, { filename: file });
  return module.exports;
}

const shared = load('src/renderer/shared/types/index.ts');
const styleHelpers = load('src/renderer/overlay/key-state.ts', { '../shared/types': shared });

test('settings preload forwards the keyboard scale to the position preview IPC', () => {
  let api;
  const calls = [];
  load('src/preload/settings.ts', {
    electron: {
      contextBridge: { exposeInMainWorld(name, value) { assert.equal(name, 'electronAPI'); api = value; } },
      ipcRenderer: { invoke(...args) { calls.push(args); } },
    },
    '../renderer/shared/types': shared,
  });
  api.getPositionPreview({ x: 10, y: 20 }, 6, 1, 'keyboard', 150);
  assert.deepEqual(plain(calls[0].slice(0, 6)), [shared.IPC_CHANNELS.GET_POSITION_PREVIEW, { x: 10, y: 20 }, 6, 1, 'keyboard', 150]);
});

function createStore(partial = {}) {
  let config = { ...plain(shared.DEFAULT_CONFIG), ...partial };
  const listeners = [];
  const writes = [];
  return {
    writes,
    getConfig: () => ({ ...config }), get: (key) => config[key],
    updateConfig(update) {
      writes.push(update);
      const previous = config;
      config = { ...config, ...update };
      listeners.forEach((callback) => callback(config, previous));
      return this.getConfig();
    },
    set(key, value) { this.updateConfig({ [key]: value }); },
    toggleEnabled() { this.set('isEnabled', !config.isEnabled); return config.isEnabled; },
    onDidChange(callback) { listeners.push(callback); },
  };
}

async function boot(partial = {}, { registered = true, failStart = false } = {}) {
  const store = createStore(partial);
  const timers = new Map();
  const events = new Map();
  const powerEvents = new Map();
  const calls = { starts: 0, stops: 0, shows: 0, hides: 0, unregistered: 0, broadcasts: [], sessions: [] };
  let accelerator, shortcut;
  const windows = {
    createOverlayWindow() {}, showOverlay() { calls.shows++; }, hideOverlay() { calls.hides++; },
    sendToAll(channel, value) { calls.broadcasts.push({ channel, value: { ...value } }); },
    destroyAll() {}, setQuitting() {}, showSettings() {},
  };
  const listener = {
    setPauseShortcutRegistered() {},
    setSessionActive(active) { calls.sessions.push(active); },
    start() { calls.starts++; if (failStart) throw new Error('Hook unavailable'); },
    stop() { calls.stops++; },
  };
  load('src/main/index.ts', {
    electron: {
      app: {
        isPackaged: false, requestSingleInstanceLock: () => true,
        whenReady: () => Promise.resolve(), on: (name, callback) => events.set(name, callback),
      },
      BrowserWindow: { getAllWindows: () => [] },
      powerMonitor: {
        on(name, callback) { powerEvents.set(name, callback); },
        off(name, callback) { if (powerEvents.get(name) === callback) powerEvents.delete(name); },
      },
      globalShortcut: {
        register(value, callback) { accelerator = value; shortcut = callback; return registered; },
        unregister() { calls.unregistered++; }, unregisterAll() { calls.unregistered++; },
      },
    },
    './ConfigStore': { ConfigStore: class { constructor() { return store; } } },
    './WindowManager': { WindowManager: class { constructor() { return windows; } } },
    './TrayManager': { TrayManager: class { create() {} destroy() {} } },
    './KeyListener': { KeyListener: class { constructor() { return listener; } } },
    './ipc-handlers': { setupIPCHandlers() {} }, '../renderer/shared/types': shared,
  }, {
    console: { error() {}, warn() {} },
    setTimeout(callback) { const id = {}; timers.set(id, callback); return id; },
    clearTimeout: (id) => timers.delete(id),
  });
  await Promise.resolve();
  return {
    store, calls, events, timers, powerEvents, get accelerator() { return accelerator; },
    emitPower(name) { assert.equal(typeof powerEvents.get(name), 'function'); powerEvents.get(name)(); },
    toggleShortcut() { assert.equal(typeof shortcut, 'function'); shortcut(); },
    flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach((callback) => callback()); },
  };
}

test('pause cancels pending startup, hides overlay, and resumes input using the global shortcut', async () => {
  const h = await boot({ isEnabled: true });
  assert.equal(h.accelerator, shared.PAUSE_ACCELERATOR);
  h.toggleShortcut();
  assert.equal(h.store.get('isPaused'), true);
  assert.equal(h.calls.stops, 1);
  assert.equal(h.calls.hides, 1);
  h.flush();
  assert.equal(h.calls.starts, 0);
  h.toggleShortcut();
  h.flush();
  assert.equal(h.calls.starts, 1);
  assert.equal(h.store.get('isPaused'), false);
  assert.equal(h.calls.broadcasts.at(-1).value.isPaused, false);
});

test('a paused startup stays hidden and does not initialize the native hook', async () => {
  const h = await boot({ isEnabled: true, isPaused: true });
  h.flush();
  assert.equal(h.calls.starts, 0);
  assert.ok(h.calls.hides > 0);
  h.toggleShortcut();
  h.flush();
  assert.equal(h.calls.starts, 1);
});

test('disabled state blocks shortcut resume and enabling preserves an existing pause', async () => {
  const h = await boot({ isEnabled: false, isPaused: true });
  h.toggleShortcut();
  assert.equal(h.store.get('isPaused'), true);
  h.store.set('isEnabled', true);
  h.flush();
  assert.equal(h.calls.starts, 0);
  h.store.set('isPaused', false);
  h.flush();
  assert.equal(h.calls.starts, 1);
});

test('shortcut registration failure leaves settings pause and resume functional', async () => {
  const h = await boot({ isEnabled: true }, { registered: false });
  h.store.set('isPaused', true);
  h.flush();
  assert.equal(h.calls.starts, 0);
  h.store.set('isPaused', false);
  h.flush();
  assert.equal(h.calls.starts, 1);
});

test('quitting cancels deferred startup and unregisters the shortcut without stopping the hook', async () => {
  const h = await boot({ isEnabled: true });
  h.events.get('before-quit')();
  h.events.get('will-quit')();
  h.flush();
  assert.equal(h.calls.starts, 0);
  assert.equal(h.calls.stops, 0);
  assert.equal(h.calls.unregistered, 1);
});

test('hook startup failure disables display and broadcasts the final config', async () => {
  const h = await boot({ isEnabled: true }, { failStart: true });
  h.flush();
  assert.equal(h.store.get('isEnabled'), false);
  assert.ok(h.calls.hides > 0);
  assert.equal(h.calls.broadcasts.at(-1).value.isEnabled, false);
});

test('lock, unlock, suspend and resume clear input state without changing display settings or restarting the hook', async () => {
  const h = await boot({ isEnabled: true });
  h.flush();
  const config = h.store.getConfig();
  for (const [event, active] of [['lock-screen', false], ['unlock-screen', true], ['suspend', false], ['resume', true]]) {
    h.emitPower(event);
    assert.equal(h.calls.sessions.at(-1), active);
  }
  assert.deepEqual(h.store.getConfig(), config);
  assert.equal(h.calls.starts, 1);
  assert.equal(h.calls.stops, 0);
});

test('overlapping lock and sleep events keep input blocked until both conditions end', async () => {
  for (const order of [
    ['lock-screen', 'suspend', 'resume', 'unlock-screen'],
    ['suspend', 'lock-screen', 'unlock-screen', 'resume'],
  ]) {
    const h = await boot();
    order.forEach((event) => h.emitPower(event));
    assert.deepEqual(h.calls.sessions, [false, false, false, true]);
  }
});

test('unlocking does not resume a user-paused or disabled display', async () => {
  for (const config of [{ isEnabled: true, isPaused: true }, { isEnabled: false }]) {
    const h = await boot(config);
    h.emitPower('lock-screen');
    h.emitPower('unlock-screen');
    h.flush();
    assert.equal(h.calls.starts, 0);
    assert.equal(h.store.get('isEnabled'), config.isEnabled);
    assert.equal(h.store.get('isPaused'), config.isPaused ?? false);
  }
});

test('quitting removes session event handlers and prevents later state updates', async () => {
  const h = await boot();
  assert.equal(h.powerEvents.size, 4);
  h.events.get('before-quit')();
  h.events.get('will-quit')();
  assert.equal(h.powerEvents.size, 0);
});

function persistedConfigHarness(partial = {}) {
  let storage;
  class MockStore {
    constructor({ defaults }) {
      storage = this;
      this.store = { ...plain(defaults), ...partial };
      this.writes = 0;
    }
    set(update) { Object.assign(this.store, update); this.writes++; }
    get(key) { return this.store[key]; }
  }
  const { ConfigStore } = load('src/main/ConfigStore.ts', {
    'electron-store': { default: MockStore }, '../renderer/shared/types': shared,
    '../renderer/overlay/key-state': styleHelpers,
  });
  const configStore = new ConfigStore();
  return { configStore, storage };
}

test('invalid persisted pause, mode, and layout are repaired together', () => {
  const { configStore, storage } = persistedConfigHarness({ isPaused: 'true', displayMode: 'unknown', keyboardLayout: null });
  const config = configStore.getConfig();
  assert.equal(config.isPaused, false);
  assert.equal(config.displayMode, 'history');
  assert.equal(config.keyboardLayout, 'gaming');
  assert.equal(storage.writes, 1);
});

test('invalid persisted keyboard scale is repaired to the default', () => {
  for (const invalid of [59, 161, 105, '150']) {
    const { configStore, storage } = persistedConfigHarness({ keyboardScale: invalid });
    assert.equal(configStore.getConfig().keyboardScale, 100);
    assert.equal(storage.writes, 1);
  }
});

function ipcHarness(partial = {}, { packaged = false, portable = false, checkFails = false, downloadFails = false,
  importContent, cancelDialog = false, fileSize } = {}) {
  const handlers = new Map();
  const updateEvents = new Map();
  const timers = [];
  const notices = [];
  const files = new Map();
  const store = createStore({ isEnabled: true, displayId: 1, ...partial });
  const calls = { sizes: [], previews: [], positions: [], displays: [], broadcasts: 0, updates: [], checks: 0, downloads: 0, installs: 0, settings: 0, quitting: [] };
  const windows = {
    updateOverlaySize(...args) { calls.sizes.push(args); },
    getResizedOverlayPosition(...args) { calls.sizes.push(args); return store.get('position'); },
    validatePosition(...args) { calls.positions.push(args); return { x: args[0], y: args[1] }; },
    getPositionOnDisplay(...args) { calls.displays.push(args); return args[1]; },
    updateOverlayPosition() {},
    getPositionPreview(...args) { calls.previews.push(args); return { position: { x: 10, y: 20 } }; },
    sendToAll() { calls.broadcasts++; },
    sendToSettings(channel, value) { calls.updates.push({ channel, value }); },
    getSettingsWindow: () => null,
    showSettings() { calls.settings++; },
    setQuitting(value) { calls.quitting.push(value); },
    showOverlay() { assert.fail('IPC must not bypass centralized pause visibility'); },
    hideOverlay() {},
  };
  const state = { keyCodes: [17], timestamp: 123 };
  const shortcut = { accelerator: shared.PAUSE_ACCELERATOR, registered: false };
  const updater = {
    on(name, callback) { updateEvents.set(name, callback); },
    checkForUpdates() { calls.checks++; return checkFails ? Promise.reject(new Error('offline')) : Promise.resolve(null); },
    downloadUpdate() {
      calls.downloads++;
      if (downloadFails) return Promise.reject(new Error('download failed'));
      updateEvents.get('download-progress')?.({ percent: 42.6 });
      updateEvents.get('update-downloaded')?.({ version: '1.1.0' });
      return Promise.resolve([]);
    },
    quitAndInstall() { calls.installs++; },
  };
  class MockNotification {
    constructor(options) { this.options = options; this.events = new Map(); notices.push(this); }
    static isSupported() { return true; }
    on(name, callback) { this.events.set(name, callback); }
    show() {}
  }
  const moduleAPI = load('src/main/ipc-handlers.ts', {
    electron: {
      ipcMain: { handle: (channel, callback) => handlers.set(channel, callback) },
      app: { isPackaged: packaged, getVersion: () => '1.0.0', on() {} },
      Notification: MockNotification,
      dialog: {
        showSaveDialog: async () => ({ canceled: cancelDialog, filePath: 'backup.json' }),
        showOpenDialog: async () => ({ canceled: cancelDialog, filePaths: ['backup.json'] }),
      },
    },
    'fs/promises': {
      stat: async () => ({ size: fileSize ?? Buffer.byteLength(importContent ?? '') }),
      readFile: async () => importContent,
      writeFile: async (file, content) => { files.set(file, content); },
    },
    'electron-updater': { autoUpdater: updater },
    '../renderer/shared/types': shared,
    '../renderer/overlay/key-state': styleHelpers,
  }, {
    console: { error() {} },
    process: { platform: 'win32', env: portable ? { PORTABLE_EXECUTABLE_FILE: 'portable.exe' } : {} },
    setTimeout(callback, delay) { const timer = { callback, delay, unref() {} }; timers.push(timer); return timer; },
    clearTimeout() {},
    setInterval(callback, delay) { return { callback, delay, unref() {} }; },
    clearInterval() {},
    setImmediate(callback) { callback(); },
  });
  moduleAPI.setupIPCHandlers(store, windows, { getKeyState: () => state }, () => shortcut);
  return { store, calls, state, shortcut, updater, updateEvents, timers, notices, files, moduleAPI,
    emitUpdate(name, value) { updateEvents.get(name)?.(value); },
    invoke(channel, ...args) {
    assert.equal(typeof handlers.get(channel), 'function', `Missing handler: ${channel}`);
    return handlers.get(channel)(null, ...args);
  } };
}

test('development and portable builds cannot start an in-app update', async () => {
  for (const options of [{}, { packaged: true, portable: true }]) {
    const h = ipcHarness({}, options);
    const status = h.invoke(shared.IPC_CHANNELS.GET_UPDATE_STATUS);
    assert.equal(status.phase, 'unsupported');
    assert.equal(status.unsupportedReason, options.portable ? 'portable' : 'development');
    assert.equal(h.timers.length, 0);
    await h.invoke(shared.IPC_CHANNELS.CHECK_FOR_UPDATES);
    assert.equal(h.calls.checks, 0);
    assert.throws(() => h.invoke(shared.IPC_CHANNELS.INSTALL_UPDATE));
  }
});

const customLayout = (overrides = {}) => ({ id: 'work', name: 'Work', rows: [
  [{ key: 'Q', width: 1 }, { key: 'E', width: 1, label: 'Use' }],
  [{ key: 'CtrlRight', width: 1.25 }, { key: 'Space', width: 2 }],
], ...overrides });

test('custom layouts validate physical keys, dimensions, names and unique ids', () => {
  const layout = customLayout({ name: ' Work ' });
  assert.equal(shared.parseCustomKeyboardLayouts([layout])[0].name, 'Work');
  for (const invalid of [
    [layout, layout], [customLayout({ name: '' })], [customLayout({ rows: [] })],
    [customLayout({ rows: [[]] })], [customLayout({ extra: true })],
    [customLayout({ rows: [[{ key: '__proto__', width: 1 }]] })],
    [customLayout({ rows: [[{ key: 'Q', width: 1 }, { key: 'Q', width: 1 }]] })],
    ...[0, 0.3, 9, Infinity, '1'].map((width) => [customLayout({ rows: [[{ key: 'Q', width }]] })]),
  ]) assert.throws(() => shared.parseCustomKeyboardLayouts(invalid));
  assert.deepEqual(plain(shared.getKeyboardPanelSize(layout.rows)), { width: 248, height: 152 });
});

test('custom layout selection and deletion maintain references and resize the active panel', () => {
  const h = ipcHarness({ displayMode: 'keyboard' });
  const layout = customLayout();
  const saved = h.invoke(shared.IPC_CHANNELS.UPDATE_CONFIG, {
    keyboardLayout: 'custom', customKeyboardLayouts: [layout], activeCustomKeyboardLayoutId: layout.id,
  });
  assert.equal(saved.keyboardLayout, 'custom');
  assert.equal(saved.activeCustomKeyboardLayoutId, layout.id);
  assert.equal(h.calls.sizes.length, 1);
  assert.equal(h.store.writes.length, 1);
  h.invoke(shared.IPC_CHANNELS.UPDATE_CONFIG, { customKeyboardLayouts: [] });
  assert.equal(h.store.get('keyboardLayout'), 'gaming');
  assert.equal(h.store.get('activeCustomKeyboardLayoutId'), null);
  assert.equal(h.calls.sizes.length, 2);
});

test('invalid custom layout references reject the entire update before side effects', () => {
  for (const update of [
    { keyboardLayout: 'custom' }, { activeCustomKeyboardLayoutId: 'missing' },
    { customKeyboardLayouts: [customLayout({ rows: [[]] })] },
  ]) {
    const h = ipcHarness();
    const previous = h.store.getConfig();
    assert.throws(() => h.invoke(shared.IPC_CHANNELS.UPDATE_CONFIG, { theme: 'paper', ...update }));
    assert.deepEqual(h.store.getConfig(), previous);
    assert.equal(h.calls.broadcasts, 0);
  }
});

test('custom layout migration preserves valid layouts and repairs a missing active layout', () => {
  const valid = persistedConfigHarness({ keyboardLayout: 'custom', customKeyboardLayouts: [customLayout()], activeCustomKeyboardLayoutId: 'work' });
  assert.equal(valid.configStore.get('keyboardLayout'), 'custom');
  assert.equal(valid.storage.writes, 0);
  const stale = persistedConfigHarness({ keyboardLayout: 'custom', customKeyboardLayouts: [], activeCustomKeyboardLayoutId: 'missing' });
  assert.equal(stale.configStore.get('keyboardLayout'), 'gaming');
  assert.equal(stale.configStore.get('activeCustomKeyboardLayoutId'), null);
  assert.equal(stale.storage.writes, 1);
});

const backup = (config = {}, overrides = {}) => ({
  format: 'keystroke-visualizer-config', schemaVersion: 1, appVersion: '1.0.1',
  exportedAt: '2026-09-28T00:00:00.000Z', config: { ...plain(shared.DEFAULT_CONFIG), ...config }, ...overrides,
});

test('export writes a versioned JSON file containing saved layouts and styles', async () => {
  const layout = customLayout();
  const h = ipcHarness({ customKeyboardLayouts: [layout], customStyles: [customStyle()] });
  assert.equal(await h.invoke(shared.IPC_CHANNELS.EXPORT_CONFIG), 'backup.json');
  const content = JSON.parse(h.files.get('backup.json'));
  assert.equal(content.schemaVersion, 1);
  assert.equal(content.format, 'keystroke-visualizer-config');
  assert.deepEqual(content.config.customKeyboardLayouts, [layout]);
  assert.deepEqual(content.config.customStyles, [customStyle()]);
  assert.equal(h.moduleAPI.parseConfigBackup(content).config.theme, 'classic');
});

test('canceling import or export leaves files and configuration untouched', async () => {
  const h = ipcHarness({}, { cancelDialog: true });
  assert.equal(await h.invoke(shared.IPC_CHANNELS.EXPORT_CONFIG), null);
  assert.equal(await h.invoke(shared.IPC_CHANNELS.PREVIEW_CONFIG_IMPORT), null);
  assert.equal(h.files.size, 0);
  assert.equal(h.store.writes.length, 0);
});

test('import previews first, applies once, and preserves this computer settings', async () => {
  const layout = customLayout();
  const config = { theme: 'paper', keyboardLayout: 'custom', customKeyboardLayouts: [layout], activeCustomKeyboardLayoutId: layout.id,
    autoStart: true, isEnabled: false, isPaused: true, displayId: 99, position: { x: 99999, y: 99999 } };
  const h = ipcHarness({ autoStart: false, isPaused: false, position: { x: 10, y: 20 } }, { importContent: JSON.stringify(backup(config)) });
  const preview = await h.invoke(shared.IPC_CHANNELS.PREVIEW_CONFIG_IMPORT);
  assert.equal(preview.config.theme, 'paper');
  assert.equal(h.store.writes.length, 0);
  const applied = h.invoke(shared.IPC_CHANNELS.APPLY_CONFIG_IMPORT, preview.token, false);
  assert.equal(applied.theme, 'paper');
  assert.equal(applied.keyboardLayout, 'custom');
  assert.equal(applied.autoStart, false);
  assert.equal(applied.isEnabled, true);
  assert.equal(applied.isPaused, false);
  assert.equal(applied.displayId, 1);
  assert.deepEqual(plain(applied.position), { x: 10, y: 20 });
  assert.equal(h.store.writes.length, 1);
  assert.throws(() => h.invoke(shared.IPC_CHANNELS.APPLY_CONFIG_IMPORT, preview.token, false));
});

test('malformed, oversized, or unsupported backups fail before writing any config', async () => {
  for (const invalid of ['{', JSON.stringify(backup({}, { schemaVersion: 2 })),
    JSON.stringify(backup({ keyboardLayout: 'custom', activeCustomKeyboardLayoutId: 'missing' })),
    JSON.stringify(backup({ customStyles: [customStyle({ css: '@import "bad";' })] })),
    JSON.stringify(backup({ unknown: true })), JSON.stringify(backup({}, { config: {} })),
  ]) {
    const h = ipcHarness({}, { importContent: invalid });
    await assert.rejects(h.invoke(shared.IPC_CHANNELS.PREVIEW_CONFIG_IMPORT));
    assert.equal(h.store.writes.length, 0);
  }
  const large = ipcHarness({}, { importContent: '{}', fileSize: shared.MAX_CONFIG_FILE_BYTES + 1 });
  await assert.rejects(large.invoke(shared.IPC_CHANNELS.PREVIEW_CONFIG_IMPORT));
});

test('imported position is resolved against the local screen and stale preview tokens cannot be applied', async () => {
  const h = ipcHarness({}, { importContent: JSON.stringify(backup({ position: { x: -1, y: -1 }, displayId: 999 })) });
  const stale = await h.invoke(shared.IPC_CHANNELS.PREVIEW_CONFIG_IMPORT);
  const current = await h.invoke(shared.IPC_CHANNELS.PREVIEW_CONFIG_IMPORT);
  assert.throws(() => h.invoke(shared.IPC_CHANNELS.APPLY_CONFIG_IMPORT, stale.token, true));
  const applied = h.invoke(shared.IPC_CHANNELS.APPLY_CONFIG_IMPORT, current.token, true);
  assert.equal(h.calls.previews[0][2], 1);
  assert.deepEqual(plain(applied.position), { x: 10, y: 20 });
  assert.equal(applied.displayId, 1);
});

test('installed build checks, downloads, and installs only after the update is ready', async () => {
  const h = ipcHarness({}, { packaged: true });
  assert.equal(h.timers.length, 1);
  assert.equal(h.invoke(shared.IPC_CHANNELS.GET_UPDATE_STATUS).phase, 'idle');
  assert.throws(() => h.invoke(shared.IPC_CHANNELS.INSTALL_UPDATE));
  await h.invoke(shared.IPC_CHANNELS.CHECK_FOR_UPDATES);
  assert.equal(h.calls.checks, 1);
  h.emitUpdate('update-available', { version: '1.1.0' });
  assert.equal(h.invoke(shared.IPC_CHANNELS.GET_UPDATE_STATUS).phase, 'available');
  assert.equal(h.notices.length, 1);
  h.notices[0].events.get('click')();
  assert.equal(h.calls.settings, 1);
  await h.invoke(shared.IPC_CHANNELS.DOWNLOAD_UPDATE);
  assert.equal(h.calls.downloads, 1);
  assert.ok(h.calls.updates.some(({ value }) => value.phase === 'downloading' && value.progress === 43));
  assert.equal(h.invoke(shared.IPC_CHANNELS.GET_UPDATE_STATUS).phase, 'ready');
  h.invoke(shared.IPC_CHANNELS.INSTALL_UPDATE);
  assert.equal(h.calls.installs, 1);
  assert.deepEqual(h.calls.quitting, [true]);
});

test('automatic checks run after startup and a failed check can be retried', async () => {
  const h = ipcHarness({}, { packaged: true, checkFails: true });
  assert.equal(h.timers[0].delay, 15_000);
  h.timers[0].callback();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.invoke(shared.IPC_CHANNELS.GET_UPDATE_STATUS).phase, 'error');
  assert.equal(h.calls.checks, 1);
  h.updater.checkForUpdates = () => { h.calls.checks++; return Promise.resolve(null); };
  await h.invoke(shared.IPC_CHANNELS.CHECK_FOR_UPDATES);
  assert.equal(h.invoke(shared.IPC_CHANNELS.GET_UPDATE_STATUS).phase, 'up-to-date');
  assert.equal(h.calls.checks, 2);
});

test('failed downloads never enable the install action', async () => {
  const h = ipcHarness({}, { packaged: true, downloadFails: true });
  h.emitUpdate('update-available', { version: '1.1.0' });
  await h.invoke(shared.IPC_CHANNELS.DOWNLOAD_UPDATE);
  assert.equal(h.invoke(shared.IPC_CHANNELS.GET_UPDATE_STATUS).phase, 'error');
  assert.throws(() => h.invoke(shared.IPC_CHANNELS.INSTALL_UPDATE));
  assert.equal(h.calls.installs, 0);
});

test('IPC exposes current physical state and shortcut availability', () => {
  const h = ipcHarness();
  assert.deepEqual(h.invoke(shared.IPC_CHANNELS.GET_KEY_STATE), h.state);
  assert.deepEqual(h.invoke(shared.IPC_CHANNELS.GET_PAUSE_SHORTCUT_STATUS), h.shortcut);
});

test('mode and count changes resize with the new mode and preserve explicit coordinates', () => {
  const h = ipcHarness();
  const config = h.invoke(shared.IPC_CHANNELS.UPDATE_CONFIG, {
    displayMode: 'keyboard', keyboardLayout: 'arrows', maxDisplayCount: 12, position: { x: 20, y: 40 },
  });
  assert.equal(config.displayMode, 'keyboard');
  assert.equal(config.keyboardLayout, 'arrows');
  assert.equal(h.calls.sizes.length, 0, 'Explicit coordinates take precedence over resize anchoring');
  assert.equal(h.calls.positions[0][4], 'keyboard');
  assert.deepEqual(plain(config.position), { x: 20, y: 40 });
});

test('keyboard scale is validated, persisted and sent to window resizing and preview', () => {
  const h = ipcHarness({ displayMode: 'keyboard' });
  const updated = h.invoke(shared.IPC_CHANNELS.UPDATE_CONFIG, { keyboardScale: 150 });
  assert.equal(updated.keyboardScale, 150);
  assert.equal(h.calls.sizes[0][2], 150);
  h.invoke(shared.IPC_CHANNELS.GET_POSITION_PREVIEW, { x: 20, y: 40 }, 6, 1, 'keyboard', 150);
  assert.equal(h.calls.previews[0][4], 150);
  for (const invalid of [59, 161, 105, '100']) {
    assert.throws(() => h.invoke(shared.IPC_CHANNELS.UPDATE_CONFIG, { keyboardScale: invalid }));
  }
});

test('paused IPC enable and explicit show requests cannot show the overlay', () => {
  const h = ipcHarness();
  h.invoke(shared.IPC_CHANNELS.UPDATE_CONFIG, { isPaused: true, isEnabled: false });
  h.invoke(shared.IPC_CHANNELS.TOGGLE_ENABLED);
  h.invoke(shared.IPC_CHANNELS.SHOW_OVERLAY);
  assert.equal(h.store.get('isPaused'), true);
});

test('invalid new fields are rejected before any resize, config write, or broadcast', () => {
  for (const update of [{ isPaused: 'true' }, { displayMode: 'panel' }, { keyboardLayout: 'qwerty' }]) {
    const h = ipcHarness();
    const previous = h.store.getConfig();
    assert.throws(() => h.invoke(shared.IPC_CHANNELS.UPDATE_CONFIG, { maxDisplayCount: 12, ...update }));
    assert.deepEqual(h.store.getConfig(), previous);
    assert.equal(h.calls.sizes.length, 0);
    assert.equal(h.calls.broadcasts, 0);
  }
});

test('position preview forwards the mode while rejecting invalid modes', () => {
  const h = ipcHarness();
  h.invoke(shared.IPC_CHANNELS.GET_POSITION_PREVIEW, { x: 20, y: 40 }, 6, 1, 'keyboard');
  assert.equal(h.calls.previews[0][3], 'keyboard');
  assert.throws(() => h.invoke(shared.IPC_CHANNELS.GET_POSITION_PREVIEW, { x: 20, y: 40 }, 6, 1, 'bad'));
});

const customStyle = (overrides = {}) => ({
  id: 'sample', name: 'Sample Style', baseTheme: 'mint', css: '.kv-key { color: #fff; }', ...overrides,
});

test('IPC persists a built-in theme and a custom style atomically without resizing', () => {
  const h = ipcHarness();
  const style = customStyle();
  const updated = h.invoke(shared.IPC_CHANNELS.UPDATE_CONFIG, {
    theme: 'mint', customStyles: [style], activeCustomStyleId: style.id,
  });
  assert.equal(updated.theme, 'mint');
  assert.equal(updated.activeCustomStyleId, style.id);
  assert.deepEqual(plain(updated.customStyles), [style]);
  assert.equal(h.store.writes.length, 1);
  assert.equal(h.calls.sizes.length, 0);
  assert.equal(h.calls.broadcasts, 1);
});

test('IPC skips equivalent theme and custom-style updates', () => {
  const style = customStyle();
  const h = ipcHarness({ theme: 'mint', customStyles: [style], activeCustomStyleId: style.id });
  h.invoke(shared.IPC_CHANNELS.UPDATE_CONFIG, {
    theme: 'mint', activeCustomStyleId: style.id, customStyles: [plain(style)],
  });
  assert.equal(h.store.writes.length, 0);
  assert.equal(h.calls.broadcasts, 0);
});

test('invalid themes and custom-style structures fail before all side effects', () => {
  const invalidUpdates = [
    { theme: 'unknown' }, { theme: null }, { customStyles: null },
    { customStyles: [customStyle({ id: '' })] },
    { customStyles: [customStyle(), customStyle()] },
    { customStyles: [customStyle({ name: '' })] },
    { customStyles: [customStyle({ name: 'x'.repeat(shared.MAX_STYLE_NAME_LENGTH + 1) })] },
    { customStyles: [customStyle({ baseTheme: 'unknown' })] },
    { customStyles: [customStyle({ css: 123 })] },
    { customStyles: [customStyle({ css: 'x'.repeat(shared.MAX_CUSTOM_CSS_LENGTH + 1) })] },
    { customStyles: [customStyle({ css: '.kv-key { color: #fff;' })] },
    { customStyles: [customStyle({ extra: true })] },
    { customStyles: [{ id: 'sample', name: 'Sample', baseTheme: 'mint' }] },
    { customStyles: Array.from({ length: shared.MAX_CUSTOM_STYLES + 1 }, (_, index) => customStyle({ id: `style-${index}` })) },
    { activeCustomStyleId: 123 }, { activeCustomStyleId: 'missing' },
  ];
  for (const update of invalidUpdates) {
    const h = ipcHarness();
    const previous = h.store.getConfig();
    assert.throws(() => h.invoke(shared.IPC_CHANNELS.UPDATE_CONFIG, { maxDisplayCount: 12, ...update }));
    assert.deepEqual(h.store.getConfig(), previous);
    assert.equal(h.store.writes.length, 0);
    assert.equal(h.calls.sizes.length, 0);
    assert.equal(h.calls.broadcasts, 0);
  }
});

test('explicit unknown active style is rejected even when a valid new style is included', () => {
  const h = ipcHarness();
  assert.throws(() => h.invoke(shared.IPC_CHANNELS.UPDATE_CONFIG, {
    displayMode: 'keyboard', customStyles: [customStyle()], activeCustomStyleId: 'missing',
  }));
  assert.equal(h.store.writes.length, 0);
  assert.equal(h.calls.sizes.length, 0);
  assert.equal(h.calls.broadcasts, 0);
});

test('deleting the active custom style clears its reference and returns to the built-in theme', () => {
  const h = ipcHarness({ theme: 'mint', customStyles: [customStyle()], activeCustomStyleId: 'sample' });
  const updated = h.invoke(shared.IPC_CHANNELS.UPDATE_CONFIG, { customStyles: [] });
  assert.equal(updated.activeCustomStyleId, null);
  assert.equal(updated.theme, 'mint');
  assert.deepEqual(plain(h.store.writes[0]), { customStyles: [], activeCustomStyleId: null });
  assert.equal(h.calls.broadcasts, 1);
});

test('removing an inactive custom style preserves the active style', () => {
  const active = customStyle();
  const h = ipcHarness({ customStyles: [active, customStyle({ id: 'other' })], activeCustomStyleId: active.id });
  const updated = h.invoke(shared.IPC_CHANNELS.UPDATE_CONFIG, { customStyles: [active] });
  assert.equal(updated.activeCustomStyleId, active.id);
});

test('persisted unknown themes and malformed style arrays repair in a single write', () => {
  const { configStore, storage } = persistedConfigHarness({ theme: 'old-theme', customStyles: [customStyle({ name: 7 })], activeCustomStyleId: 'sample' });
  const config = configStore.getConfig();
  assert.equal(config.theme, 'classic');
  assert.deepEqual(plain(config.customStyles), []);
  assert.equal(config.activeCustomStyleId, null);
  assert.equal(storage.writes, 1);
});

test('valid persisted custom styles survive migration while dangling references clear', () => {
  const style = customStyle();
  const valid = persistedConfigHarness({ theme: 'outline', customStyles: [style], activeCustomStyleId: 'sample' });
  assert.deepEqual(plain(valid.configStore.get('customStyles')), [style]);
  assert.equal(valid.configStore.get('activeCustomStyleId'), 'sample');
  assert.equal(valid.storage.writes, 0);
  const stale = persistedConfigHarness({ customStyles: [style], activeCustomStyleId: 'missing' });
  assert.equal(stale.configStore.get('activeCustomStyleId'), null);
  assert.equal(stale.storage.writes, 1);
});

test('ConfigStore skips cloned equivalent styles and persists a changed style once', () => {
  const style = customStyle();
  const { configStore, storage } = persistedConfigHarness({ customStyles: [style], activeCustomStyleId: style.id });
  configStore.updateConfig({ customStyles: [plain(style)], activeCustomStyleId: style.id });
  assert.equal(storage.writes, 0);
  const updatedStyle = customStyle({ name: 'Updated' });
  configStore.updateConfig({ customStyles: [updatedStyle] });
  assert.equal(storage.writes, 1);
  assert.equal(configStore.get('customStyles')[0].name, 'Updated');
});
