const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/renderer/overlay/key-state.ts');
const source = fs.readFileSync(filename, 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleRef = { exports: {} };
const typesPath = path.resolve(__dirname, '../src/renderer/shared/types/index.ts');
const typesModule = { exports: {} };
const typesOutput = ts.transpileModule(fs.readFileSync(typesPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
vm.runInNewContext(typesOutput, { module: typesModule, exports: typesModule.exports });
const sharedTypes = typesModule.exports;
vm.runInNewContext(output, {
  module: moduleRef, exports: moduleRef.exports,
  require: (name) => name === '../shared/types' ? sharedTypes : require(name),
});
const { createKeyDisplayState, applyKeyPress, applyKeyState, pruneHistory, getNextExpiry, isPanelKeyHeld } = moduleRef.exports;
const { getThemeCss, getActiveKeyStyle, validateCustomCss, parseCustomStyles, KEY_THEMES } = moduleRef.exports;
const { parse: parseCss } = require('postcss');

assert.equal(KEY_THEMES.length, 6);
assert.equal(new Set(KEY_THEMES.map(({ id }) => id)).size, 6);
const prefix = ':where([data-style-scope="test-overlay"])';
const builtInCss = KEY_THEMES.map(({ id }) => getThemeCss(id, 'test-overlay'));
assert.equal(new Set(builtInCss).size, 6, 'Each built-in theme has a distinct palette');
for (const css of builtInCss) {
  parseCss(css).walkRules((rule) => assert.ok(rule.selector.startsWith(`${prefix} `), 'Every theme rule is scoped'));
  assert.match(css, /\.kv-key\[data-held="true"\]/);
  assert.match(css, /\.kv-key\[data-role="modifier"\]/);
}
const safeCss = '@media (min-width: 200px) { @supports (display: grid) { .kv-key:is([data-key="A"], [data-key="B"]), .kv-count { color: #123456; } } }';
assert.equal(validateCustomCss(safeCss).valid, true);
const cssWithSourceMap = '.kv-key { color: #123456; }\n/*# sourceMappingURL=data:application/json;unsupported,invalid */';
assert.equal(validateCustomCss(cssWithSourceMap).valid, true, 'Source map comments do not affect custom CSS validation');
assert.match(getThemeCss('classic', 'test-overlay', cssWithSourceMap), /:is\(\.kv-key\) \{ color: #123456;/);
const scopedCustom = parseCss(getThemeCss('classic', 'test-overlay', safeCss));
const customRules = [];
scopedCustom.walkRules((rule) => {
  assert.ok(rule.selector.startsWith(`${prefix} `));
  if (rule.nodes.some((node) => node.type === 'decl' && node.value === '#123456')) customRules.push(rule.selector);
});
assert.deepEqual(customRules, [`${prefix} :is(.kv-key:is([data-key="A"], [data-key="B"]), .kv-count)`],
  'Selector commas inside pseudo classes remain intact');
for (const invalidCss of [
  '@import "https://example.invalid/theme.css";',
  '@font-face { font-family: remote; src: url(https://example.invalid/font.woff); }',
  '.kv-key { background: url(https://example.invalid/image.png); }',
  String.raw`.kv-key { background: u\72l(https://example.invalid/image.png); }`,
  String.raw`.kv-key { background: u\000072 l(https://example.invalid/image.png); }`,
  String.raw`@\69mport "https://example.invalid/theme.css";`,
  '.kv-key { behavior: custom.htc; }',
  '.kv-key { color: ',
]) {
  assert.equal(validateCustomCss(invalidCss).valid, false, `Rejects invalid CSS: ${invalidCss}`);
  assert.equal(getThemeCss('classic', 'test-overlay', invalidCss), builtInCss[0],
    'Invalid persisted CSS falls back to the intact built-in theme');
}
assert.throws(() => getThemeCss('classic', 'broken"] body'), /Invalid style scope/);
assert.equal(validateCustomCss(' '.repeat(sharedTypes.MAX_CUSTOM_CSS_LENGTH + 1)).valid, false);
const validStyle = { id: 'mine', name: ' Custom ', baseTheme: 'mint', css: '.kv-key { color: red; }' };
assert.equal(parseCustomStyles([validStyle])[0].name, 'Custom');
assert.throws(() => parseCustomStyles([validStyle, validStyle]), /unique id/);
assert.throws(() => parseCustomStyles(Array.from({ length: sharedTypes.MAX_CUSTOM_STYLES + 1 }, (_, index) => ({ ...validStyle, id: `style-${index}` }))), /at most/);
assert.throws(() => parseCustomStyles([{ ...validStyle, name: 'x'.repeat(sharedTypes.MAX_STYLE_NAME_LENGTH + 1) }]), /unique id/);
assert.throws(() => parseCustomStyles([{ ...validStyle, css: ' '.repeat(sharedTypes.MAX_CUSTOM_CSS_LENGTH + 1) }]), /at most/);
assert.equal(getActiveKeyStyle({ theme: 'paper', customStyles: [validStyle], activeCustomStyleId: 'mine' }).theme, 'mint');
assert.equal(getActiveKeyStyle({ theme: 'paper', customStyles: [validStyle], activeCustomStyleId: 'missing' }).theme, 'paper');
const press = (timestamp, extras = {}) => ({ keys: ['A'], keyCode: 30, timestamp, ...extras });

let state = applyKeyPress(createKeyDisplayState(), press(1000), 6);
assert.equal(state.history[0].held, true);
assert.equal(getNextExpiry(state.history, 1000), null);
assert.equal(pruneHistory(state, 100000, 1000).history.length, 1, 'Held keys never expire');
state = applyKeyState(state, { keyCodes: [], timestamp: 5000 });
assert.equal(state.history[0].releasedAt, 5000);
assert.equal(getNextExpiry(state.history, 1000), 6000);
assert.equal(pruneHistory(state, 5999, 1000).history.length, 1);
assert.equal(pruneHistory(state, 6000, 1000).history.length, 0);

state = applyKeyPress(createKeyDisplayState(), press(1000), 6);
state = applyKeyState(state, { keyCodes: [], timestamp: 1050 });
state = applyKeyPress(state, press(1700), 6);
assert.equal(state.history.length, 1, 'Consecutive keys within 800 ms merge');
assert.equal(state.history[0].count, 2);
assert.equal(state.history[0].releasedAt, null);
state = applyKeyPress(state, press(4000, { repeat: true }), 6);
assert.equal(state.history.length, 1, 'Native repeat merges beyond the time window');
assert.equal(state.history[0].count, 3);
state = applyKeyState(state, { keyCodes: [], timestamp: 4050 });
state = applyKeyPress(state, press(5000), 6);
assert.equal(state.history.length, 2, 'Separate taps outside the time window stay separate');
state = applyKeyPress(state, press(5100, { keys: ['B'], keyCode: 48 }), 6);
state = applyKeyPress(state, press(5200), 6);
assert.equal(state.history.length, 4, 'An intervening key breaks consecutive merging');
state = applyKeyPress(state, press(6000, { keys: ['B'], keyCode: 48, repeat: true }), 6);
assert.equal(state.history.length, 4, 'Native repeats merge their existing row even when another held key intervenes');
assert.equal(state.history.at(-1).count, 2);

state = applyKeyPress(createKeyDisplayState(), press(1000), 6);
state = applyKeyPress(state, press(1100, { keys: ['Ctrl', 'A'] }), 6);
assert.equal(state.history.length, 2, 'Different combinations do not merge');
state = applyKeyState(state, { keyCodes: [29], timestamp: 1500 });
assert.ok(state.history.every((item) => !item.held), 'Releasing the primary key releases all its history rows');
state = applyKeyPress(state, press(1600, { keys: ['B'], keyCode: 48 }), 2);
assert.equal(state.history.length, 2, 'History respects the display limit');

state = applyKeyPress(createKeyDisplayState(), press(1000, { keyCode: undefined }), 6);
assert.equal(state.history[0].held, false, 'Legacy events without scan codes fade normally');
assert.equal(state.history[0].releasedAt, 1000);
state = applyKeyState(state, { keyCodes: [30], timestamp: 1200 });
assert.equal(state.history[0].held, false, 'A held snapshot does not resurrect already released history');
state = applyKeyState(createKeyDisplayState(), { keyCodes: [17, 42], timestamp: 1000 });
assert.equal(state.history.length, 0, 'Initial snapshots initialize held keys without inventing history');
assert.deepEqual([...state.heldKeyCodes], [17, 42]);
assert.equal(isPanelKeyHeld([42, 54], [54]), true, 'Either side modifier highlights the shared key');
assert.equal(isPanelKeyHeld([42, 54], [29]), false);

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const testWindow = { innerWidth: 400, innerHeight: 218 };
const componentCache = new Map();
function loadComponent(componentPath) {
  if (componentCache.has(componentPath)) return componentCache.get(componentPath);
  const compiled = ts.transpileModule(fs.readFileSync(componentPath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const componentModule = { exports: {} };
  componentCache.set(componentPath, componentModule.exports);
  vm.runInNewContext(compiled, {
    module: componentModule, exports: componentModule.exports, window: testWindow,
    require: (name) => {
      if (!name.startsWith('.')) return require(name);
      const target = path.resolve(path.dirname(componentPath), name);
      const resolved = [`${target}.ts`, `${target}.tsx`, path.join(target, 'index.ts')].find((file) => fs.existsSync(file));
      return loadComponent(resolved);
    },
  });
  componentCache.set(componentPath, componentModule.exports);
  return componentModule.exports;
}
const KeyItem = loadComponent(path.resolve(__dirname, '../src/renderer/overlay/components/KeyItem.tsx')).default;
const heldMarkup = renderToStaticMarkup(React.createElement(KeyItem, {
  keys: ['Ctrl', 'A'], count: 2, releasedAt: null, fadeOutDuration: 1000,
}));
assert.match(heldMarkup, /data-held="true"/);
assert.match(heldMarkup, /class="kv-row /);
assert.match(heldMarkup, /data-key="Ctrl" data-role="modifier" data-held="true"/);
assert.match(heldMarkup, /data-key="A" data-role="main" data-held="true"/);
assert.match(heldMarkup, /class="kv-plus /);
assert.match(heldMarkup, /class="kv-count /);
assert.doesNotMatch(heldMarkup, /bg-|text-cyan-|text-white|text-gray-|rounded|border|shadow/);
const releasedMarkup = renderToStaticMarkup(React.createElement(KeyItem, {
  keys: ['A'], count: 2, releasedAt: 1000, fadeOutDuration: 1000,
}));
assert.match(releasedMarkup, /data-held="false"/);
assert.match(releasedMarkup, /data-key="A" data-role="main" data-held="false"/);
const { default: KeyDisplay, KeyboardPanel } = loadComponent(path.resolve(__dirname, '../src/renderer/overlay/components/KeyDisplay.tsx'));
const panelProps = { displayMode: 'keyboard', keyboardLayout: 'gaming', fadeOutDuration: 1000, maxDisplayCount: 6, stackFrom: 'top', alignX: 'right' };
const fullPanel = renderToStaticMarkup(React.createElement(KeyDisplay, panelProps));
assert.match(fullPanel, /height:218px/);
assert.match(fullPanel, /height:54px/);
assert.match(fullPanel, /--kv-panel-font-size:18px/);
assert.doesNotMatch(fullPanel, /style="font-size:|line-height:/);
assert.match(fullPanel, /class="kv-panel /);
assert.match(fullPanel, /class="kv-panel-row /);
assert.match(fullPanel, /kv-key kv-panel-key/);
assert.doesNotMatch(fullPanel, /bg-|text-cyan-|text-white|text-gray-|rounded|border|shadow/);
testWindow.innerHeight = 80;
const smallPanel = renderToStaticMarkup(React.createElement(KeyDisplay, panelProps));
assert.match(smallPanel, /height:80px/);
assert.equal((smallPanel.match(/data-keyboard-row/g) ?? []).length, 3);
assert.doesNotMatch(smallPanel, /h-\[54px\]|height:54px/);
const smallPanelFontSize = Number(smallPanel.match(/--kv-panel-font-size:([\d.]+)px/)?.[1]);
assert.ok(smallPanelFontSize > 0 && smallPanelFontSize < 18, 'Small panels retain adaptive font sizing');

const previewPanel = renderToStaticMarkup(React.createElement(KeyboardPanel, {
  keyboardLayout: 'arrows', heldKeyCodes: [0xE048, 54], viewportHeight: 218,
}));
assert.match(previewPanel, /data-key="Up" data-role="main" data-held="true"/);
assert.match(previewPanel, /data-key="Shift" data-role="modifier" data-held="true"/);
assert.match(previewPanel, /data-key="Ctrl" data-role="modifier" data-held="false"/);
assert.match(previewPanel, /height:218px/);
const largePanel = renderToStaticMarkup(React.createElement(KeyboardPanel, {
  keyboardLayout: 'gaming', heldKeyCodes: [], keyboardScale: 150, viewportWidth: 600, viewportHeight: 327,
}));
assert.match(largePanel, /width:600px;height:327px/);
assert.match(largePanel, /--kv-panel-font-size:27px/);
const customPanel = renderToStaticMarkup(React.createElement(KeyboardPanel, {
  keyboardLayout: 'custom', rows: [[{ key: 'Q', width: 1, label: 'Interact' }, { key: 'Spacer', width: 0.5 },
    { key: 'CtrlRight', width: 1.25 }]], heldKeyCodes: [0x0010, 0x0E1D], viewportWidth: 400, viewportHeight: 218,
}));
assert.match(customPanel, /width:224px;height:86px/);
assert.match(customPanel, /data-key="Q" data-role="main" data-held="true"/);
assert.match(customPanel, />Interact</);
assert.match(customPanel, /data-key="CtrlRight" data-role="modifier" data-held="true"/);
assert.doesNotMatch(customPanel, /data-key="Spacer"/);
const historyMarkup = renderToStaticMarkup(React.createElement(KeyDisplay, { ...panelProps, displayMode: 'history' }));
assert.match(historyMarkup, /class="kv-history /);

const animationElement = {
  style: {},
  animate: () => { throw new Error('Static previews must not start animations'); },
};
const itemSource = fs.readFileSync(path.resolve(__dirname, '../src/renderer/overlay/components/KeyItem.tsx'), 'utf8');
const itemOutput = ts.transpileModule(itemSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const staticItemModule = { exports: {} };
vm.runInNewContext(itemOutput, {
  module: staticItemModule, exports: staticItemModule.exports,
  require: (name) => name === 'react' ? {
    useRef: () => ({ current: animationElement }), useEffect: (effect) => effect(),
  } : require(name),
});
staticItemModule.exports.default({ keys: ['A'], count: 1, releasedAt: Date.now() - 100, fadeOutDuration: 1000, animate: false });
assert.equal(animationElement.style.opacity, '1', 'Static previews remain fully visible');

let appConfig = { ...sharedTypes.DEFAULT_CONFIG, isEnabled: true };
let stateIndex = 0;
let cssBuilds = 0;
let memoValue;
let memoDependencies;
const appModule = { exports: {} };
const appPath = path.resolve(__dirname, '../src/renderer/overlay/App.tsx');
const appOutput = ts.transpileModule(fs.readFileSync(appPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
vm.runInNewContext(appOutput, {
  module: appModule, exports: appModule.exports,
  require: (name) => {
    if (name === 'react') return {
      useState: () => [stateIndex++ === 0 ? appConfig : 'bottom-right', () => {}],
      useEffect: () => {},
      useMemo: (callback, dependencies) => {
        if (!memoDependencies || dependencies.some((value, index) => value !== memoDependencies[index])) {
          memoValue = callback();
          memoDependencies = dependencies;
        }
        return memoValue;
      },
    };
    if (name === './key-state') return {
      getActiveKeyStyle,
      getThemeCss: (theme, scope, css) => { cssBuilds++; return `${scope}:${theme}${css}`; },
    };
    if (name.startsWith('./components/')) return { default: () => null };
    if (name === '../shared/types') return sharedTypes;
    return require(name);
  },
});
function renderApp() {
  stateIndex = 0;
  return appModule.exports.default();
}
const originalApp = renderApp();
assert.equal(originalApp.props['data-style-scope'], 'kv-overlay');
assert.equal(originalApp.props.style.contain, 'layout paint');
assert.equal(originalApp.props.style.isolation, 'isolate');
assert.equal(originalApp.props.children[0].props.children, 'kv-overlay:classic');
appConfig = { ...appConfig, fadeOutDuration: 2000 };
renderApp();
assert.equal(cssBuilds, 1, 'Unrelated config changes do not rebuild theme CSS');
appConfig = { ...appConfig, theme: 'paper' };
const themedApp = renderApp();
assert.equal(cssBuilds, 2);
assert.equal(themedApp.props.children[1].key, originalApp.props.children[1].key,
  'Theme changes preserve the input component mount key');
appConfig = { ...appConfig, customStyles: [validStyle] };
renderApp();
assert.equal(cssBuilds, 2, 'Saving an inactive style does not rebuild CSS');
appConfig = { ...appConfig, activeCustomStyleId: 'mine' };
renderApp();
assert.equal(cssBuilds, 3, 'Selecting a custom style rebuilds active CSS');
appConfig = { ...appConfig, customStyles: [{ ...validStyle }] };
renderApp();
assert.equal(cssBuilds, 3, 'Equivalent IPC snapshots do not rebuild CSS');
appConfig = { ...appConfig, customStyles: [{ ...validStyle, css: '.kv-key { color: blue; }' }] };
renderApp();
assert.equal(cssBuilds, 4, 'Editing active CSS rebuilds the theme');
console.log('Key display state tests passed');
