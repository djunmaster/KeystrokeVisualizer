const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const source = readFileSync(join(__dirname, '../src/main/KeyListener.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const IPC_CHANNELS = {
  KEY_PRESSED: 'key-pressed',
  KEY_STATE_CHANGED: 'key-state-changed',
};
const UiohookKey = new Proxy({
  A: 30, L: 38, W: 17, F9: 67, Ctrl: 29, CtrlRight: 3613, Shift: 42, ShiftRight: 54,
  Alt: 56, AltRight: 3640, Meta: 3675, MetaRight: 3676,
}, {
  get(target, key) {
    if (!(key in target)) target[key] = 0x10000 + Object.keys(target).length;
    return target[key];
  },
});

function createHarness({ failStart = false, failStop = false } = {}) {
  const hook = new EventEmitter();
  hook.start = () => {
    if (failStart) throw new Error('Hook unavailable');
  };
  hook.stop = () => {
    if (failStop) throw new Error('Hook stop failed');
  };
  const messages = [];
  let configChanged;
  const configStore = {
    get: () => 'en-US',
    onDidChange: (callback) => { configChanged = callback; },
  };
  const module = { exports: {} };
  const mockedRequire = (id) => {
    if (id === 'uiohook-napi') {
      return { uIOhook: hook, UiohookKey, WheelDirection: { VERTICAL: 3, HORIZONTAL: 4 } };
    }
    if (id === '../renderer/shared/types') return { IPC_CHANNELS };
    if (id === './WindowManager' || id === './ConfigStore') return {};
    throw new Error(`Unexpected dependency: ${id}`);
  };
  new Function('require', 'module', 'exports', compiled)(mockedRequire, module, module.exports);
  const listener = new module.exports.KeyListener({
    sendToOverlay: (channel, event) => messages.push({ channel, event }),
  }, configStore);
  const emitKey = (name, keycode, modifiers = {}) => hook.emit(name, { keycode, ...modifiers });
  const events = (channel) => messages.filter((message) => message.channel === channel).map(({ event }) => event);
  return { listener, hook, emitKey, events, messages, changeLanguage: (language) => configChanged({ language }) };
}

test('broadcasts physical keys including modifiers and identifies repeated keydown', () => {
  const { listener, emitKey, events, messages } = createHarness();
  listener.start();
  emitKey('keydown', UiohookKey.Ctrl);
  emitKey('keydown', UiohookKey.A);
  emitKey('keydown', UiohookKey.A);

  assert.deepEqual(events(IPC_CHANNELS.KEY_STATE_CHANGED).map(({ keyCodes }) => keyCodes), [
    [UiohookKey.Ctrl], [UiohookKey.Ctrl, UiohookKey.A],
  ]);
  const presses = events(IPC_CHANNELS.KEY_PRESSED);
  assert.equal(presses.length, 2);
  assert.deepEqual(presses[0].keys, ['Ctrl', 'A']);
  assert.equal(presses[0].keyCode, UiohookKey.A);
  assert.equal(presses[0].repeat, false);
  assert.equal(presses[1].repeat, true);
  assert.ok(Number.isFinite(listener.getKeyState().timestamp));
  assert.deepEqual(messages.map(({ channel }) => channel), [
    IPC_CHANNELS.KEY_STATE_CHANGED, IPC_CHANNELS.KEY_STATE_CHANGED,
    IPC_CHANNELS.KEY_PRESSED, IPC_CHANNELS.KEY_PRESSED,
  ]);
});

test('release updates state once and pressing again starts a new occurrence', () => {
  const { listener, emitKey, events } = createHarness();
  listener.start();
  emitKey('keydown', UiohookKey.W);
  emitKey('keyup', UiohookKey.W);
  emitKey('keyup', UiohookKey.W);
  emitKey('keydown', UiohookKey.W);
  assert.deepEqual(events(IPC_CHANNELS.KEY_STATE_CHANGED).map(({ keyCodes }) => keyCodes), [
    [UiohookKey.W], [], [UiohookKey.W],
  ]);
  assert.deepEqual(events(IPC_CHANNELS.KEY_PRESSED).map(({ repeat }) => repeat), [false, false]);
});

test('snapshots are detached and retain the other side of a released modifier', () => {
  const { listener, emitKey, events } = createHarness();
  listener.start();
  emitKey('keydown', UiohookKey.Ctrl);
  emitKey('keydown', UiohookKey.CtrlRight);
  emitKey('keyup', UiohookKey.Ctrl);
  const snapshot = listener.getKeyState();
  assert.deepEqual(snapshot.keyCodes, [UiohookKey.CtrlRight]);
  snapshot.keyCodes.length = 0;
  assert.deepEqual(listener.getKeyState().keyCodes, [UiohookKey.CtrlRight]);
  emitKey('keydown', UiohookKey.A);
  assert.deepEqual(events(IPC_CHANNELS.KEY_PRESSED).at(-1).keys, ['Ctrl', 'A']);
});

test('stopping sends empty state, removes callbacks, and clears repeat tracking', () => {
  const { listener, hook, emitKey, events } = createHarness();
  listener.start();
  emitKey('keydown', UiohookKey.Shift);
  emitKey('keydown', UiohookKey.A);
  listener.stop();
  assert.deepEqual(events(IPC_CHANNELS.KEY_STATE_CHANGED).at(-1).keyCodes, []);
  assert.deepEqual(listener.getKeyState().keyCodes, []);
  for (const name of ['keydown', 'keyup', 'wheel', 'mousedown']) {
    assert.equal(hook.listenerCount(name), 0);
  }
  listener.start();
  emitKey('keydown', UiohookKey.A);
  assert.deepEqual(events(IPC_CHANNELS.KEY_PRESSED).at(-1).keys, ['A']);
  assert.equal(events(IPC_CHANNELS.KEY_PRESSED).at(-1).repeat, false);
});

test('preserves mouse modifiers, wheel throttling, and localized volume labels', () => {
  const { listener, hook, events, emitKey, changeLanguage } = createHarness();
  listener.start();
  hook.emit('wheel', { direction: 3, rotation: -1, ctrlKey: true });
  hook.emit('wheel', { direction: 3, rotation: -1, ctrlKey: true });
  assert.equal(events(IPC_CHANNELS.KEY_PRESSED).length, 1);
  assert.deepEqual(events(IPC_CHANNELS.KEY_PRESSED)[0].keys, ['Ctrl', 'Wheel Up']);
  hook.emit('mousedown', { button: 3 });
  assert.deepEqual(events(IPC_CHANNELS.KEY_PRESSED).at(-1).keys, ['Middle Click']);
  emitKey('keydown', 0xE030);
  assert.deepEqual(events(IPC_CHANNELS.KEY_PRESSED).at(-1).keys, ['Volume Up']);
  assert.equal(events(IPC_CHANNELS.KEY_PRESSED).at(-1).keyCode, 0xE030);
  changeLanguage('zh-CN');
  emitKey('keyup', 0xE030);
  emitKey('keydown', 0xE030);
  assert.deepEqual(events(IPC_CHANNELS.KEY_PRESSED).at(-1).keys, ['音量增大']);
});

test('hook start failure leaves no input callbacks attached', () => {
  const { listener, hook } = createHarness({ failStart: true });
  assert.throws(() => listener.start(), /Hook unavailable/);
  for (const name of ['keydown', 'keyup', 'wheel', 'mousedown']) {
    assert.equal(hook.listenerCount(name), 0);
  }
});

test('hook stop failure still clears the visible key state', () => {
  const { listener, emitKey, events } = createHarness({ failStop: true });
  listener.start();
  emitKey('keydown', UiohookKey.A);
  assert.throws(() => listener.stop(), /Hook stop failed/);
  assert.deepEqual(listener.getKeyState().keyCodes, []);
  assert.deepEqual(events(IPC_CHANNELS.KEY_STATE_CHANGED).at(-1).keyCodes, []);
});

test('restored listener uses native modifier flags for keys already held at startup', () => {
  const { listener, emitKey, events } = createHarness();
  listener.start();
  listener.stop();
  listener.start();
  emitKey('keydown', UiohookKey.A, { ctrlKey: true, shiftKey: true });
  assert.deepEqual(events(IPC_CHANNELS.KEY_PRESSED).at(-1).keys, ['Ctrl', 'Shift', 'A']);
});

test('locking clears Win+L even without keyup and ignores all input until the session is active', () => {
  const { listener, emitKey, hook, events, messages } = createHarness();
  listener.start();
  emitKey('keydown', UiohookKey.Meta);
  emitKey('keydown', UiohookKey.L, { metaKey: true });
  emitKey('keydown', UiohookKey.L, { metaKey: true });
  assert.deepEqual(events(IPC_CHANNELS.KEY_PRESSED).at(-1).keys, ['Win', 'L']);
  listener.setSessionActive(false);
  assert.deepEqual(listener.getKeyState().keyCodes, []);
  assert.deepEqual(events(IPC_CHANNELS.KEY_STATE_CHANGED).at(-1).keyCodes, []);
  const clearedCount = messages.length;
  emitKey('keydown', UiohookKey.L, { metaKey: true });
  emitKey('keyup', UiohookKey.Meta);
  hook.emit('wheel', { direction: 3, rotation: -1 });
  hook.emit('mousedown', { button: 3 });
  assert.equal(messages.length, clearedCount, 'session transitions must not reintroduce queued input');
  listener.setSessionActive(true);
  assert.deepEqual(listener.getKeyState().keyCodes, []);
  emitKey('keydown', UiohookKey.L);
  assert.deepEqual(events(IPC_CHANNELS.KEY_PRESSED).at(-1).keys, ['L']);
  assert.equal(events(IPC_CHANNELS.KEY_PRESSED).at(-1).repeat, false);
  assert.equal(hook.listenerCount('keydown'), 1, 'session changes do not restart the native hook');
});

test('session resets clear wheel throttling and remain blocked across pause and resume', () => {
  const { listener, hook, emitKey, events } = createHarness();
  listener.start();
  hook.emit('wheel', { direction: 3, rotation: -1 });
  listener.setSessionActive(false);
  listener.stop();
  listener.start();
  emitKey('keydown', UiohookKey.A);
  assert.deepEqual(listener.getKeyState().keyCodes, []);
  assert.equal(events(IPC_CHANNELS.KEY_PRESSED).length, 1);
  listener.setSessionActive(true);
  hook.emit('wheel', { direction: 3, rotation: -1 });
  assert.equal(events(IPC_CHANNELS.KEY_PRESSED).length, 2, 'the first wheel event after unlocking is not throttled');
  emitKey('keydown', UiohookKey.Shift, { shiftKey: true });
  listener.setSessionActive(true);
  emitKey('keydown', UiohookKey.A);
  assert.deepEqual(events(IPC_CHANNELS.KEY_PRESSED).at(-1).keys, ['A']);
});

test('filters only the default pause shortcut from display history', () => {
  const { listener, emitKey, events } = createHarness();
  listener.setPauseShortcutRegistered(true);
  listener.start();
  const commandFlags = process.platform === 'darwin' ? { metaKey: true } : { ctrlKey: true };
  emitKey('keydown', UiohookKey.F9, { ...commandFlags, shiftKey: true });
  assert.equal(events(IPC_CHANNELS.KEY_PRESSED).length, 0);
  assert.deepEqual(listener.getKeyState().keyCodes, [UiohookKey.F9]);
  emitKey('keyup', UiohookKey.F9);
  emitKey('keydown', UiohookKey.F9);
  assert.deepEqual(events(IPC_CHANNELS.KEY_PRESSED).at(-1).keys, ['F9']);
});

test('unregistered or failed pause shortcuts remain in display history', () => {
  const { listener, emitKey, events } = createHarness();
  listener.start();
  const isMac = process.platform === 'darwin';
  const flags = { ...(isMac ? { metaKey: true } : { ctrlKey: true }), shiftKey: true };
  emitKey('keydown', UiohookKey.F9, flags);
  assert.deepEqual(events(IPC_CHANNELS.KEY_PRESSED).at(-1).keys,
    isMac ? ['Shift', 'Cmd', 'F9'] : ['Ctrl', 'Shift', 'F9']);
  emitKey('keyup', UiohookKey.F9);
  listener.setPauseShortcutRegistered(true);
  listener.setPauseShortcutRegistered(false);
  emitKey('keydown', UiohookKey.F9, flags);
  assert.equal(events(IPC_CHANNELS.KEY_PRESSED).length, 2);
});
