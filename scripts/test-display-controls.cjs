const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function load(relativePath, dependencies = {}, globals = {}) {
  const file = path.join(root, relativePath);
  const source = fs.readFileSync(file, 'utf8');
  const code = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, __dirname: path.dirname(file), process, Buffer,
    setTimeout, clearTimeout,
    require: (name) => dependencies[name] ?? require(name),
    ...globals,
  }, { filename: file });
  return module.exports;
}

const shared = load('src/renderer/shared/types/index.ts');
const themes = load('src/renderer/overlay/key-state.ts', { '../shared/types': shared });
const plain = (value) => JSON.parse(JSON.stringify(value));

class MockWindow {
  constructor(options) {
    this.bounds = { x: options.x, y: options.y, width: options.width, height: options.height };
    this.visible = options.show;
    this.events = {};
    this.webContents = { send() {} };
  }
  on(name, callback) { this.events[name] = callback; }
  isDestroyed() { return false; }
  getPosition() { return [this.bounds.x, this.bounds.y]; }
  getSize() { return [this.bounds.width, this.bounds.height]; }
  getBounds() { return this.bounds; }
  setBounds(bounds) { this.bounds = { ...this.bounds, ...bounds }; this.events.moved?.(); }
  show() { this.visible = true; }
  hide() { this.visible = false; }
  setIgnoreMouseEvents() {}
  setAlwaysOnTop() {}
  loadFile() {}
  loadURL() {}
}

function createStore(partial = {}) {
  const value = { ...plain(shared.DEFAULT_CONFIG), displayId: 1, ...partial };
  const listeners = [];
  return {
    get: (key) => value[key],
    getConfig: () => ({ ...value }),
    updateConfig(partialConfig) {
      const previous = { ...value };
      Object.assign(value, partialConfig);
      listeners.forEach((callback) => callback({ ...value }, previous));
      return this.getConfig();
    },
    set(key, next) { this.updateConfig({ [key]: next }); },
    toggleEnabled() { this.set('isEnabled', !value.isEnabled); return value.isEnabled; },
    onDidChange(callback) { listeners.push(callback); },
  };
}

function createWindows(partial = {}, workArea = { x: 0, y: 0, width: 1920, height: 1040 }) {
  const display = { id: 1, bounds: workArea, workArea, scaleFactor: 1, label: 'Primary' };
  const screen = {
    getAllDisplays: () => [display], getPrimaryDisplay: () => display,
    getDisplayNearestPoint: () => display, getDisplayMatching: () => display,
    getCursorScreenPoint: () => ({ x: 0, y: 0 }), on() {}, off() {},
  };
  const { WindowManager } = load('src/main/WindowManager.ts', {
    electron: { screen, BrowserWindow: MockWindow }, '../renderer/shared/types': shared,
  });
  const store = createStore(partial);
  return { manager: new WindowManager(store), store };
}

test('paused overlay stays hidden on creation and reuse', () => {
  const { manager, store } = createWindows({ isEnabled: true, isPaused: true });
  const overlay = manager.createOverlayWindow(store.getConfig());
  assert.equal(overlay.visible, false);
  manager.createOverlayWindow(store.getConfig());
  assert.equal(overlay.visible, false);
});

test('keyboard mode uses the fixed panel height independently of history count', () => {
  const { manager, store } = createWindows({ displayMode: 'keyboard', maxDisplayCount: 12 });
  const overlay = manager.createOverlayWindow(store.getConfig());
  assert.equal(overlay.bounds.height, shared.KEYBOARD_PANEL_HEIGHT);
  assert.equal(manager.getPositionPreview(store.get('position'), 1).overlaySize.height, shared.KEYBOARD_PANEL_HEIGHT);
});

test('keyboard scale changes the actual window and preview dimensions while keeping the right edge anchored', () => {
  const { manager, store } = createWindows({ displayMode: 'keyboard', keyboardScale: 100, position: { x: 1500, y: 802 } });
  const overlay = manager.createOverlayWindow(store.getConfig());
  assert.deepEqual(plain(manager.getPositionPreview(store.get('position'), 6, 1, 'keyboard', 150).overlaySize),
    { width: 600, height: 327 });
  const right = overlay.bounds.x + overlay.bounds.width;
  const bottom = overlay.bounds.y + overlay.bounds.height;
  manager.updateOverlaySize(6, 'keyboard', 150);
  assert.equal(overlay.bounds.width, 600);
  assert.equal(overlay.bounds.height, 327);
  assert.equal(overlay.bounds.x + overlay.bounds.width, right);
  assert.equal(overlay.bounds.y + overlay.bounds.height, bottom);
});

test('keyboard preview clamps size and coordinates to a small negative-coordinate display', () => {
  const area = { x: -320, y: -200, width: 320, height: 180 };
  const { manager } = createWindows({ displayMode: 'keyboard' }, area);
  const preview = manager.getPositionPreview({ x: -1, y: -1 }, 12);
  assert.deepEqual(plain(preview.overlaySize), { width: 320, height: 180 });
  assert.deepEqual(plain(preview.position), { x: -320, y: -200 });
});

test('invalid keyboard position preview uses the requested scale for its fallback position', () => {
  const { manager } = createWindows({ displayMode: 'keyboard', keyboardScale: 100 });
  const preview = manager.getPositionPreview({ x: NaN, y: 20 }, 6, 1, 'keyboard', 150);
  assert.deepEqual(plain(preview.overlaySize), { width: 600, height: 327 });
  assert.deepEqual(plain(preview.position), { x: 1300, y: 693 });
});

test('switching from history to keyboard keeps a bottom-anchored overlay bottom edge', () => {
  const { manager, store } = createWindows({ position: { x: 1520, y: 624 }, isEnabled: true });
  const overlay = manager.createOverlayWindow(store.getConfig());
  const bottom = overlay.bounds.y + overlay.bounds.height;
  manager.updateOverlaySize(store.get('maxDisplayCount'), 'keyboard');
  assert.equal(overlay.bounds.height, shared.KEYBOARD_PANEL_HEIGHT);
  assert.equal(overlay.bounds.y + overlay.bounds.height, bottom);
});

test('moving displays and switching modes together preserves the position ratio using each mode size', () => {
  const source = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1040 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
  const target = { id: 2, bounds: { x: -1280, y: 0, width: 1280, height: 720 }, workArea: { x: -1280, y: 0, width: 1280, height: 720 } };
  const screen = {
    getAllDisplays: () => [source, target], getPrimaryDisplay: () => source,
    getDisplayNearestPoint: () => source, on() {}, off() {},
  };
  const { WindowManager } = load('src/main/WindowManager.ts', { electron: { screen }, '../renderer/shared/types': shared });
  const store = createStore({ position: { x: 760, y: 322 }, displayMode: 'history' });
  const manager = new WindowManager(store);
  assert.deepEqual(plain(manager.getPositionOnDisplay(2, store.get('position'), 12, 'keyboard')), { x: -840, y: 251 });
});

test('default position on a new display uses the requested keyboard scale', () => {
  const { manager } = createWindows({ displayMode: 'keyboard', keyboardScale: 100 });
  assert.deepEqual(plain(manager.getPositionOnDisplay(1, { x: -1, y: -1 }, 6, 'keyboard', 150)),
    { x: 1300, y: 693 });
});

test('explicit keyboard preview works before optimistic mode changes have persisted', () => {
  const { manager } = createWindows({ displayMode: 'history' });
  const preview = manager.getPositionPreview({ x: 1520, y: 624 }, 12, 1, 'keyboard');
  assert.equal(preview.overlaySize.height, shared.KEYBOARD_PANEL_HEIGHT);
});

test('tray pause only changes pause state and all visibility remains centrally managed', () => {
  let tray;
  class MockTray {
    constructor() { tray = this; }
    on() {}
    setToolTip() {}
    setContextMenu(menu) { this.menu = menu; }
    setImage() {}
  }
  const { TrayManager } = load('src/main/TrayManager.ts', {
    electron: { app: { quit() {} }, Tray: MockTray, Menu: { buildFromTemplate: (items) => items }, nativeImage: { createFromBuffer: () => ({}), createFromPath: () => ({}) } },
    fs: { existsSync: () => false }, '../renderer/shared/types': shared,
  });
  const store = createStore({ isEnabled: true });
  let broadcasts = 0;
  const windows = {
    showOverlay() { assert.fail('tray must delegate visibility to the central config listener'); },
    hideOverlay() { assert.fail('tray must delegate visibility to the central config listener'); },
    showSettings() {}, setQuitting() {}, sendToAll() { broadcasts++; },
  };
  new TrayManager(windows, store).create();
  const pause = () => tray.menu.find((item) => item.label === '暂停显示' || item.label === '恢复显示');
  assert.ok(pause());
  pause().click();
  assert.equal(store.get('isEnabled'), true);
  assert.equal(store.get('isPaused'), true);
  pause().click();
  assert.equal(store.get('isPaused'), false);
  tray.menu[0].click();
  assert.equal(store.get('isEnabled'), false);
  assert.equal(pause().enabled, false);
  pause().click();
  assert.equal(store.get('isPaused'), false);
  assert.equal(broadcasts, 3);
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((complete, fail) => { resolve = complete; reject = fail; });
  return { promise, resolve, reject };
}

function createSettingsHarness(partial = {}, initialUpdate = { phase: 'unsupported', currentVersion: '1.0.0', unsupportedReason: 'development' }) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  let tree;
  let onConfigChanged;
  let onUpdateStatusChanged;
  const initial = { ...plain(shared.DEFAULT_CONFIG), isEnabled: true, ...partial };
  const requests = [];
  const updateActions = [];
  const api = {
    getConfig: () => Promise.resolve(initial),
    getPauseShortcutStatus: () => Promise.resolve({ accelerator: shared.PAUSE_ACCELERATOR, registered: true }),
    onConfigChanged(callback) { onConfigChanged = callback; return () => {}; },
    updateConfig(partial) { const request = { partial, ...deferred() }; requests.push(request); return request.promise; },
    getUpdateStatus: () => Promise.resolve(initialUpdate),
    onUpdateStatusChanged(callback) { onUpdateStatusChanged = callback; return () => {}; },
    checkForUpdates() { updateActions.push('check'); return Promise.resolve({ phase: 'up-to-date', currentVersion: '1.0.0' }); },
    downloadUpdate() { updateActions.push('download'); return Promise.resolve({ phase: 'ready', currentVersion: '1.0.0', availableVersion: '1.1.0' }); },
    installUpdate() { updateActions.push('install'); return Promise.resolve({ phase: 'installing', currentVersion: '1.0.0', availableVersion: '1.1.0' }); },
  };
  const hooks = {
    useState(value) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = value;
      return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef(value) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: value };
      return slots[index];
    },
    useCallback(callback) { cursor++; return callback; },
    useEffect(callback, dependencies) {
      const index = cursor++;
      if (!slots[index] || dependencies.some((value, offset) => !Object.is(value, slots[index][offset]))) {
        slots[index] = dependencies;
        effects.push(callback);
      }
    },
  };
  const AnimationSetting = () => {};
  const dependencies = {
    react: hooks, '../shared/types': shared, '../overlay/key-state': themes,
    '../overlay/components/KeyDisplay': { KeyboardPanel() {} }, '../overlay/components/KeyItem': { default() {} },
  };
  for (const component of ['PositionSetting', 'AnimationSetting', 'StartupSetting', 'DisplayCountSetting']) {
    dependencies[`./components/${component}`] = { default() {} };
  }
  dependencies['./components/AnimationSetting'] = { default: AnimationSetting };
  const { default: App, ThemeSetting } = load('src/renderer/settings/App.tsx', dependencies, {
    window: { electronAPI: api }, document: { documentElement: {} }, navigator: { platform: 'Win32' }, console,
  });
  function render() {
    cursor = 0;
    tree = App();
    const pending = effects;
    effects = [];
    pending.forEach((effect) => effect());
  }
  function find(element, predicate) {
    if (!element || typeof element !== 'object') return;
    if (predicate(element)) return element;
    const children = [element.props?.children].flat(Infinity);
    for (const child of children) { const match = find(child, predicate); if (match) return match; }
  }
  return {
    initial, requests, updateActions, render,
    receive(config) { onConfigChanged(config); },
    receiveUpdate(status) { onUpdateStatusChanged(status); },
    pauseButton() { return find(tree, (element) => element.type === 'button' && ['暂停显示', '恢复显示'].includes(element.props.children)); },
    enabledSwitch() { return find(tree, (element) => element.type === 'button' && element.props.role === 'switch'); },
    modeRadio(mode) { return find(tree, (element) => element.type === 'input' && element.props.name === 'display-mode' && element.props.value === mode); },
    themeSetting() { return find(tree, (element) => element.type === ThemeSetting); },
    pageTab(page) { return find(tree, (element) => element.props?.['data-settings-page'] === page); },
    scaleSlider() { return find(tree, (element) => element.type === 'input' && element.props.id === 'keyboard-scale'); },
    historySetting() { return find(tree, (element) => element.type === AnimationSetting); },
    updateButton(action) { return find(tree, (element) => element.type === 'button' && element.props['data-update-action'] === action); },
  };
}

const flushPromises = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

test('settings keeps rapid pause and resume changes while saves are pending', async () => {
  const settings = createSettingsHarness();
  settings.render();
  await flushPromises();
  settings.render();
  settings.pauseButton().props.onClick();
  settings.render();
  assert.equal(settings.pauseButton().props.children, '恢复显示');
  settings.pauseButton().props.onClick();
  settings.render();
  assert.equal(settings.pauseButton().props.children, '暂停显示');
  settings.requests[0].resolve({ ...settings.initial, isPaused: true });
  await flushPromises();
  settings.render();
  assert.equal(settings.pauseButton().props.children, '暂停显示');
  assert.equal(settings.requests[1].partial.isPaused, false);
  settings.requests[1].resolve(settings.initial);
  await flushPromises();
});

test('a slow settings response does not overwrite newer external pause state', async () => {
  const settings = createSettingsHarness();
  settings.render();
  await flushPromises();
  settings.render();
  settings.modeRadio('keyboard').props.onChange();
  settings.receive({ ...settings.initial, displayMode: 'keyboard', isPaused: true });
  settings.requests[0].resolve({ ...settings.initial, displayMode: 'keyboard', isPaused: false });
  await flushPromises();
  settings.render();
  assert.equal(settings.pauseButton().props.children, '恢复显示');
});

test('settings preserves pause state when disabling and enabling the display', async () => {
  const settings = createSettingsHarness({ isPaused: true });
  settings.render();
  await flushPromises();
  settings.render();
  settings.enabledSwitch().props.onClick();
  assert.deepEqual(plain(settings.requests[0].partial), { isEnabled: false });
  settings.requests[0].resolve({ ...settings.initial, isEnabled: false });
  await flushPromises();
  settings.render();
  assert.equal(settings.pauseButton().props.disabled, true);
  assert.equal(settings.pauseButton().props.children, '恢复显示');
  settings.enabledSwitch().props.onClick();
  assert.deepEqual(plain(settings.requests[1].partial), { isEnabled: true });
  settings.requests[1].resolve(settings.initial);
  await flushPromises();
  settings.render();
  assert.equal(settings.pauseButton().props.disabled, false);
  assert.equal(settings.pauseButton().props.children, '恢复显示');
});

test('four settings pages show only the active display mode controls', async () => {
  const settings = createSettingsHarness({ displayMode: 'history' });
  settings.render();
  await flushPromises();
  settings.render();
  for (const page of ['display', 'position', 'appearance', 'app']) assert.ok(settings.pageTab(page));
  for (const page of ['overview', 'keyboard', 'history']) assert.equal(settings.pageTab(page), undefined);
  assert.ok(settings.historySetting());
  assert.equal(settings.scaleSlider(), undefined);
  settings.modeRadio('keyboard').props.onChange();
  assert.deepEqual(plain(settings.requests[0].partial), { displayMode: 'keyboard' });
  settings.requests[0].resolve({ ...settings.initial, displayMode: 'keyboard' });
  await flushPromises();
  settings.render();
  assert.equal(settings.historySetting(), undefined);
  assert.equal(settings.scaleSlider().props.value, 100);
  settings.scaleSlider().props.onChange({ target: { value: '140' } });
  assert.deepEqual(plain(settings.requests[1].partial), { keyboardScale: 140 });
  settings.requests[1].resolve({ ...settings.initial, displayMode: 'keyboard', keyboardScale: 140 });
  await flushPromises();
  settings.render();
  assert.equal(settings.scaleSlider().props.value, 140);
  settings.pageTab('appearance').props.onClick();
  settings.render();
  assert.ok(settings.themeSetting());
});

test('application page moves from download to install only after the update is ready', async () => {
  const settings = createSettingsHarness({}, { phase: 'available', currentVersion: '1.0.0', availableVersion: '1.1.0' });
  settings.render();
  await flushPromises();
  settings.render();
  settings.pageTab('app').props.onClick();
  settings.render();
  assert.ok(settings.updateButton('download'));
  assert.equal(settings.updateButton('install'), undefined);
  settings.updateButton('download').props.onClick();
  await flushPromises();
  settings.render();
  assert.deepEqual(settings.updateActions, ['download']);
  assert.ok(settings.updateButton('install'));
  settings.updateButton('install').props.onClick();
  await flushPromises();
  assert.deepEqual(settings.updateActions, ['download', 'install']);
});

test('theme changes share the settings queue and report success after persistence', async () => {
  const settings = createSettingsHarness();
  settings.render();
  await flushPromises();
  settings.render();
  settings.modeRadio('keyboard').props.onChange();
  let complete = false;
  const save = settings.themeSetting().props.onChange({ theme: 'mint', activeCustomStyleId: null }).then((result) => {
    complete = true;
    return result;
  });
  assert.equal(settings.requests.length, 1, 'Theme writes wait for existing settings writes');
  assert.equal(complete, false);
  settings.requests[0].resolve({ ...settings.initial, displayMode: 'keyboard' });
  await flushPromises();
  assert.equal(complete, false);
  assert.equal(settings.requests[1].partial.theme, 'mint');
  settings.requests[1].resolve({ ...settings.initial, displayMode: 'keyboard', theme: 'mint' });
  assert.equal(await save, true);
});

test('failed custom style saves report failure and preserve the confirmed theme', async () => {
  const settings = createSettingsHarness();
  settings.render();
  await flushPromises();
  settings.render();
  const save = settings.themeSetting().props.onChange({ theme: 'neon', activeCustomStyleId: null });
  settings.requests[0].reject(new Error('disk full'));
  assert.equal(await save, false);
  settings.render();
  assert.equal(settings.themeSetting().props.config.theme, settings.initial.theme);
});

function createThemeHarness(partial = {}) {
  let config = { ...plain(shared.DEFAULT_CONFIG), ...partial };
  const slots = [];
  let cursor = 0;
  let effects = [];
  let tree;
  let confirm = true;
  let nextId = 0;
  const requests = [];
  const hooks = {
    useState(value) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof value === 'function' ? value() : value;
      return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useEffect(callback, dependencies) {
      const index = cursor++;
      if (!slots[index] || dependencies.some((value, offset) => !Object.is(value, slots[index][offset]))) {
        slots[index] = dependencies;
        effects.push(callback);
      }
    },
  };
  const { ThemeSetting } = load('src/renderer/settings/App.tsx', {
    react: hooks, '../shared/types': shared, '../overlay/key-state': themes,
    '../overlay/components/KeyDisplay': { KeyboardPanel() {} }, '../overlay/components/KeyItem': { default() {} },
    './components/PositionSetting': {}, './components/AnimationSetting': {},
    './components/StartupSetting': {}, './components/DisplayCountSetting': {},
  }, { window: { confirm: () => confirm, crypto: { randomUUID: () => `style-${++nextId}` } }, console });
  function render() {
    cursor = 0;
    tree = ThemeSetting({ config, onChange(partial) {
      const request = { partial, ...deferred() };
      requests.push(request);
      return request.promise;
    } });
    const pending = effects;
    effects = [];
    pending.forEach((effect) => effect());
  }
  function find(element, attribute) {
    if (!element || typeof element !== 'object') return;
    if (attribute in (element.props ?? {})) return element;
    for (const child of [element.props?.children].flat(Infinity)) {
      const match = find(child, attribute);
      if (match) return match;
    }
  }
  return {
    requests, render, control(attribute) { return find(tree, attribute); },
    receive(next) { config = { ...config, ...next }; render(); },
    confirm(value) { confirm = value; },
    edit(attribute, value) { find(tree, attribute).props.onChange({ target: { value } }); render(); },
    complete(success) {
      const request = requests.at(-1);
      if (success) config = { ...config, ...request.partial };
      request.resolve(success);
    },
  };
}

test('CSS drafts only change the scoped local preview and survive external config updates', () => {
  const editor = createThemeHarness();
  editor.render();
  editor.edit('data-css-editor', '.kv-key { color: #123456; }');
  assert.equal(editor.requests.length, 0);
  assert.match(editor.control('data-preview-css').props.children, /#123456/);
  editor.receive({ theme: 'paper', isPaused: true });
  assert.equal(editor.control('data-css-editor').props.value, '.kv-key { color: #123456; }');
  assert.match(editor.control('data-preview-css').props.children, /#123456/);
  const validPreview = editor.control('data-preview-css').props.children;
  editor.edit('data-css-editor', '.kv-key {');
  assert.ok(editor.control('data-css-error'));
  assert.equal(editor.control('data-save-style').props.disabled, true);
  assert.equal(editor.control('data-preview-css').props.children, validPreview);
  editor.control('data-save-style').props.onClick();
  assert.equal(editor.requests.length, 0, 'Invalid CSS cannot be submitted even through the handler');
});

test('failed CSS saves keep the name and dirty draft, successful saves persist one custom style', async () => {
  const editor = createThemeHarness();
  editor.render();
  editor.edit('data-css-editor', '.kv-key { color: #123456; }');
  editor.edit('data-style-name', 'My keys');
  editor.control('data-save-style').props.onClick();
  editor.complete(false);
  await flushPromises();
  editor.render();
  assert.equal(editor.control('data-style-name').props.value, 'My keys');
  assert.equal(editor.control('data-css-editor').props.value, '.kv-key { color: #123456; }');
  assert.equal(editor.control('data-reset-draft').props.disabled, false);
  editor.control('data-save-style').props.onClick();
  assert.equal(editor.requests[1].partial.customStyles.length, 1);
  assert.equal(editor.requests[1].partial.customStyles[0].name, 'My keys');
  editor.complete(true);
  await flushPromises();
  editor.render();
  assert.equal(editor.control('data-reset-draft').props.disabled, true);
  assert.ok(editor.control('data-save-style-as'));
});

test('editing a saved style replaces it, save as adds a new style, and delete requires confirmation', async () => {
  const original = { id: 'saved', name: 'Original', baseTheme: 'mint', css: '.kv-key { color: #123456; }' };
  const editor = createThemeHarness({ customStyles: [original], activeCustomStyleId: original.id, theme: 'mint' });
  editor.render();
  editor.edit('data-style-name', 'Edited');
  editor.control('data-save-style').props.onClick();
  assert.equal(editor.requests[0].partial.customStyles.length, 1);
  assert.equal(editor.requests[0].partial.customStyles[0].id, 'saved');
  editor.complete(true);
  await flushPromises();
  editor.render();
  editor.control('data-save-style-as').props.onClick();
  assert.equal(editor.requests[1].partial.customStyles.length, 2);
  assert.notEqual(editor.requests[1].partial.activeCustomStyleId, 'saved');
  assert.equal(editor.requests[1].partial.customStyles[1].name, 'Edited (2)');
  editor.complete(true);
  await flushPromises();
  editor.render();
  editor.confirm(false);
  editor.control('data-delete-style').props.onClick();
  assert.equal(editor.requests.length, 2);
  editor.confirm(true);
  editor.control('data-delete-style').props.onClick();
  assert.equal(editor.requests[2].partial.customStyles.length, 1);
  assert.equal(editor.requests[2].partial.activeCustomStyleId, null);
  editor.complete(true);
  await flushPromises();
});

test('dirty draft preset changes require confirmation and reset reloads current config', async () => {
  const editor = createThemeHarness();
  editor.render();
  editor.edit('data-css-editor', '.kv-key { color: #123456; }');
  editor.confirm(false);
  editor.edit('data-theme-select', 'theme:paper');
  assert.equal(editor.requests.length, 0);
  editor.receive({ theme: 'mint' });
  editor.control('data-reset-draft').props.onClick();
  editor.render();
  assert.equal(editor.control('data-css-editor').props.value, '');
  assert.equal(editor.control('data-base-theme').props.value, 'mint');
  editor.edit('data-theme-select', 'theme:paper');
  assert.equal(editor.requests[0].partial.theme, 'paper');
  editor.complete(true);
  await flushPromises();
});

test('custom style limits reject additions while allowing an existing style to be updated', async () => {
  const full = Array.from({ length: shared.MAX_CUSTOM_STYLES }, (_, index) => ({
    id: `saved-${index}`, name: `Style ${index}`, baseTheme: 'classic', css: '',
  }));
  const newStyle = createThemeHarness({ customStyles: full });
  newStyle.render();
  newStyle.control('data-save-style').props.onClick();
  assert.equal(newStyle.requests.length, 0, 'Empty style names are rejected');
  newStyle.edit('data-style-name', 'Extra');
  newStyle.control('data-save-style').props.onClick();
  assert.equal(newStyle.requests.length, 0, 'The custom style count limit is enforced before IPC');
  const existing = createThemeHarness({ customStyles: full, activeCustomStyleId: full[0].id });
  existing.render();
  existing.edit('data-style-name', 'Updated');
  existing.control('data-save-style').props.onClick();
  assert.equal(existing.requests[0].partial.customStyles.length, shared.MAX_CUSTOM_STYLES);
  existing.complete(true);
  await flushPromises();
});

test('duplicate custom style names keep the draft and save as generates a bounded unique name', async () => {
  const longName = 'A'.repeat(shared.MAX_STYLE_NAME_LENGTH);
  const original = { id: 'original', name: longName, baseTheme: 'classic', css: '' };
  const secondName = `${'A'.repeat(shared.MAX_STYLE_NAME_LENGTH - 4)} (2)`;
  const styles = [original, { ...original, id: 'copy', name: secondName }];
  const editor = createThemeHarness({ customStyles: styles });
  editor.render();
  editor.edit('data-style-name', longName);
  editor.control('data-save-style').props.onClick();
  editor.render();
  assert.equal(editor.requests.length, 0);
  assert.equal(editor.control('data-style-name').props.value, longName);
  assert.equal(editor.control('data-reset-draft').props.disabled, false);
  assert.ok(editor.control('data-name-error'));
  const existing = createThemeHarness({ customStyles: styles, activeCustomStyleId: original.id });
  existing.render();
  existing.control('data-save-style-as').props.onClick();
  const saved = existing.requests[0].partial.customStyles.at(-1);
  assert.equal(saved.name, `${'A'.repeat(shared.MAX_STYLE_NAME_LENGTH - 4)} (3)`);
  assert.equal(saved.name.length, shared.MAX_STYLE_NAME_LENGTH);
  existing.complete(true);
  await flushPromises();
  existing.render();
  assert.equal(existing.control('data-style-name').props.value, saved.name);
});

test('using the CSS template requires confirmation before replacing a dirty CSS draft', () => {
  const editor = createThemeHarness();
  editor.render();
  const css = '.kv-key { color: red; }';
  editor.edit('data-css-editor', css);
  editor.confirm(false);
  editor.control('data-css-template').props.onClick();
  editor.render();
  assert.equal(editor.control('data-css-editor').props.value, css);
  editor.confirm(true);
  editor.control('data-css-template').props.onClick();
  editor.render();
  assert.equal(editor.control('data-css-editor').props.value, themes.CUSTOM_CSS_TEMPLATE);
  assert.equal(editor.requests.length, 0);
});
