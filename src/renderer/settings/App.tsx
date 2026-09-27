import { useState, useEffect, useRef, useCallback } from 'react';
import { ConfigState, CustomKeyStyle, KEYBOARD_PANEL_HEIGHT, KEY_THEMES, KeyThemeId, MAX_CUSTOM_CSS_LENGTH, MAX_CUSTOM_STYLES, MAX_STYLE_NAME_LENGTH, MIN_KEYBOARD_SCALE, MAX_KEYBOARD_SCALE, PauseShortcutStatus, UpdateStatus } from '../shared/types';
import PositionSetting from './components/PositionSetting';
import AnimationSetting from './components/AnimationSetting';
import StartupSetting from './components/StartupSetting';
import DisplayCountSetting from './components/DisplayCountSetting';
import { KeyboardPanel } from '../overlay/components/KeyDisplay';
import KeyItem from '../overlay/components/KeyItem';
import { CUSTOM_CSS_TEMPLATE, getActiveKeyStyle, getThemeCss, validateCustomCss } from '../overlay/key-state';

// Settings window electron API type
interface SettingsElectronAPI {
  getConfig: () => Promise<ConfigState>;
  onConfigChanged: (callback: (config: ConfigState) => void) => () => void;
  updateConfig: (partial: Partial<ConfigState>) => Promise<ConfigState>;
  getPauseShortcutStatus: () => Promise<PauseShortcutStatus>;
  getUpdateStatus: () => Promise<UpdateStatus>;
  onUpdateStatusChanged: (callback: (status: UpdateStatus) => void) => () => void;
  checkForUpdates: () => Promise<UpdateStatus>;
  downloadUpdate: () => Promise<UpdateStatus>;
  installUpdate: () => Promise<UpdateStatus>;
}

// Type assertion for settings-specific API
const electronAPI = (window as unknown as { electronAPI: SettingsElectronAPI }).electronAPI;

const translations = {
  'zh-CN': {
    windowTitle: '按键可视化工具 - 设置',
    loading: '加载中...',
    loadError: '无法加载设置。',
    retry: '重试',
    saveError: '保存设置失败，请重试。',
    settings: '设置',
    appName: '按键可视化工具',
    pages: { display: '显示', position: '位置', appearance: '样式', app: '应用' },
    displayTitle: '显示设置', keyboardTitle: '键盘面板', historyTitle: '按键记录', positionTitle: '显示位置', appTitle: '应用设置',
    activeMode: '当前显示模式', keyboardScale: '面板大小', keyboardScaleReset: '恢复 100%',
    keyboardPreview: '键盘面板预览',
    display: '显示设置',
    enabled: '显示按键',
    pause: '暂停显示',
    resume: '恢复显示',
    paused: '已暂停',
    running: '正在显示',
    disabled: '未启用',
    pauseShortcut: '暂停快捷键',
    shortcutAvailable: '可用',
    shortcutUnavailable: '不可用',
    shortcutError: '无法读取快捷键状态',
    mode: '显示模式',
    historyMode: '按键记录',
    keyboardMode: '键盘面板',
    keyboardLayout: '按键布局',
    gamingLayout: 'WASD',
    arrowsLayout: '方向键',
    position: {
      title: '显示位置',
      display: '目标屏幕',
      screen: '屏幕',
      primary: '主屏',
      scale: '缩放',
      resolution: '逻辑分辨率',
      displaysError: '无法读取屏幕列表。',
      reset: '重置',
      custom: '自定义',
      preview: '屏幕预览',
      previewControl: '拖动或使用方向键调整按键显示位置',
      presets: {
        'bottom-right': '右下角',
        'top-right': '右上角',
        'bottom-left': '左下角',
        'top-left': '左上角',
        'bottom-center': '底部居中',
        'top-center': '顶部居中',
      },
    },
    animation: '淡出时间',
    displayCount: '最多显示条数',
    displayCountDescription: '同时显示的按键记录数',
    system: '系统设置',
    startup: '开机启动',
    startupEnabled: '启用',
    language: '界面语言',
    about: '关于',
    version: '版本',
    update: {
      title: '版本更新', loading: '正在读取更新状态…', idle: '尚未检查更新',
      checking: '正在检查更新…', current: '已是最新版本', available: '发现新版本',
      downloading: '正在下载', ready: '下载完成，可以安装', installing: '正在安装并重启…',
      error: '检查或下载失败，请重试。', development: '开发版无法安装更新。',
      portable: '便携版暂不支持应用内更新，请下载新版便携包。',
      platform: '当前平台暂不支持应用内更新。',
      check: '检查更新', download: '下载更新', install: '安装并重启', badge: '有新版本可用',
    },
  },
  'en-US': {
    windowTitle: 'Keystroke Visualizer - Settings',
    loading: 'Loading...',
    loadError: 'Could not load settings.',
    retry: 'Retry',
    saveError: 'Could not save settings. Please try again.',
    settings: 'Settings',
    appName: 'Keystroke Visualizer',
    pages: { display: 'Display', position: 'Position', appearance: 'Style', app: 'App' },
    displayTitle: 'Display Settings', keyboardTitle: 'Keyboard Panel', historyTitle: 'Keystroke History', positionTitle: 'Display Position', appTitle: 'Application',
    activeMode: 'Active display mode', keyboardScale: 'Panel size', keyboardScaleReset: 'Reset to 100%',
    keyboardPreview: 'Keyboard panel preview',
    display: 'Display Settings',
    enabled: 'Enable Keystroke Display',
    pause: 'Pause Display',
    resume: 'Resume Display',
    paused: 'Paused',
    running: 'Displaying',
    disabled: 'Disabled',
    pauseShortcut: 'Pause Shortcut',
    shortcutAvailable: 'Available',
    shortcutUnavailable: 'Unavailable',
    shortcutError: 'Could not read shortcut status',
    mode: 'Display Mode',
    historyMode: 'Keystroke History',
    keyboardMode: 'Keyboard Panel',
    keyboardLayout: 'Key Layout',
    gamingLayout: 'WASD',
    arrowsLayout: 'Arrow Keys',
    position: {
      title: 'Display Position',
      display: 'Target Display',
      screen: 'Display',
      primary: 'Primary',
      scale: 'Scale',
      resolution: 'Logical Resolution',
      displaysError: 'Could not load displays.',
      reset: 'Reset',
      custom: 'Custom',
      preview: 'Screen Preview',
      previewControl: 'Drag or use arrow keys to move the keystroke display',
      presets: {
        'bottom-right': 'Bottom Right',
        'top-right': 'Top Right',
        'bottom-left': 'Bottom Left',
        'top-left': 'Top Left',
        'bottom-center': 'Bottom Center',
        'top-center': 'Top Center',
      },
    },
    animation: 'Fade Out Duration',
    displayCount: 'Max Display Blocks',
    displayCountDescription: 'Number of keystrokes shown at once',
    system: 'System Settings',
    startup: 'Start at Login',
    startupEnabled: 'Enabled',
    language: 'Language',
    about: 'About',
    version: 'Version',
    update: {
      title: 'Updates', loading: 'Loading update status…', idle: 'Updates have not been checked',
      checking: 'Checking for updates…', current: 'You are up to date', available: 'New version available',
      downloading: 'Downloading', ready: 'Download complete, ready to install', installing: 'Installing and restarting…',
      error: 'Could not check or download the update. Please retry.', development: 'Updates cannot be installed in a development build.',
      portable: 'In-app updates are unavailable for the portable version. Download the latest portable package.',
      platform: 'In-app updates are unavailable on this platform.',
      check: 'Check for updates', download: 'Download update', install: 'Install and restart', badge: 'Update available',
    },
  },
} as const;

const themeTranslations = {
  'zh-CN': {
    title: '按键样式', theme: '当前样式', presets: '预设主题', custom: '已保存样式',
    preview: '预览', baseTheme: '基础主题', name: '样式名称', css: '自定义 CSS',
    template: '使用模板', save: '保存并应用', saveAs: '另存为', reset: '重置草稿',
    remove: '删除样式', saving: '保存中...', unsaved: '未保存', saved: '已保存',
    saveError: '保存样式失败，草稿已保留。', nameRequired: '请填写样式名称。',
    nameExists: '已存在同名样式，请使用其他名称。',
    invalidCss: 'CSS 无效', limit: '最多保存 20 个自定义样式。',
    discard: '当前草稿尚未保存，是否丢弃更改？',
    confirmDelete: '确定删除此自定义样式吗？',
  },
  'en-US': {
    title: 'Key Appearance', theme: 'Current Style', presets: 'Preset Themes', custom: 'Saved Styles',
    preview: 'Preview', baseTheme: 'Base Theme', name: 'Style Name', css: 'Custom CSS',
    template: 'Use Template', save: 'Save and Apply', saveAs: 'Save As', reset: 'Reset Draft',
    remove: 'Delete Style', saving: 'Saving...', unsaved: 'Unsaved', saved: 'Saved',
    saveError: 'Could not save the style. Your draft is preserved.', nameRequired: 'Enter a style name.',
    nameExists: 'A style with this name already exists. Choose a different name.',
    invalidCss: 'Invalid CSS', limit: 'You can save up to 20 custom styles.',
    discard: 'Discard the unsaved changes to this draft?', confirmDelete: 'Delete this custom style?',
  },
} as const;

interface StyleDraft {
  id: string | null;
  name: string;
  baseTheme: KeyThemeId;
  css: string;
}

function draftFromConfig(config: ConfigState): StyleDraft {
  const custom = config.customStyles.find((style) => style.id === config.activeCustomStyleId);
  return custom ? { ...custom } : { id: null, name: '', baseTheme: config.theme, css: '' };
}

function uniqueCopyName(name: string, styles: readonly CustomKeyStyle[]): string {
  for (let index = 2; ; index++) {
    const suffix = ` (${index})`;
    let stem = '';
    for (const character of name) {
      if (stem.length + character.length > MAX_STYLE_NAME_LENGTH - suffix.length) break;
      stem += character;
    }
    const candidate = stem.trimEnd() + suffix;
    if (!styles.some((style) => style.name === candidate)) return candidate;
  }
}

interface ThemeSettingProps {
  config: ConfigState;
  onChange: (partial: Partial<ConfigState>) => Promise<boolean>;
}

export function ThemeSetting({ config, onChange }: ThemeSettingProps) {
  const [draft, setDraft] = useState<StyleDraft>(() => draftFromConfig(config));
  const [baseline, setBaseline] = useState<StyleDraft>(() => draftFromConfig(config));
  const [preview, setPreview] = useState(() => ({ theme: draft.baseTheme, css: draft.css }));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const dirty = draft.id !== baseline.id || draft.name !== baseline.name ||
    draft.baseTheme !== baseline.baseTheme || draft.css !== baseline.css;
  const t = themeTranslations[config.language];
  const validation = validateCustomCss(draft.css);
  const swatches = KEY_THEMES.find((theme) => theme.id === draft.baseTheme)?.swatches ?? [];

  useEffect(() => {
    if (dirty || saving) return;
    const next = draftFromConfig(config);
    setDraft(next);
    setBaseline(next);
    setPreview({ theme: next.baseTheme, css: next.css });
  }, [config, dirty, saving]);

  const updateDraft = (partial: Partial<StyleDraft>) => {
    const next = { ...draft, ...partial };
    setDraft(next);
    setSaveError('');
    if (validateCustomCss(next.css).valid) setPreview({ theme: next.baseTheme, css: next.css });
  };

  const resetDraft = () => {
    const next = draftFromConfig(config);
    setDraft(next);
    setBaseline(next);
    setPreview({ theme: next.baseTheme, css: next.css });
    setSaveError('');
  };

  const selectStyle = async (value: string) => {
    if (dirty && !window.confirm(t.discard)) return;
    const custom = value.startsWith('custom:')
      ? config.customStyles.find((style) => style.id === value.slice(7)) : undefined;
    const partial: Partial<ConfigState> = custom
      ? { theme: custom.baseTheme, activeCustomStyleId: custom.id }
      : { theme: value.slice(6) as KeyThemeId, activeCustomStyleId: null };
    setSaving(true);
    setSaveError('');
    try {
      if (await onChange(partial)) {
        const next = custom ? { ...custom } : { id: null, name: '', baseTheme: partial.theme as KeyThemeId, css: '' };
        setDraft(next);
        setBaseline(next);
        setPreview({ theme: next.baseTheme, css: next.css });
      } else setSaveError(t.saveError);
    } catch (error) {
      console.error('Failed to select key style:', error);
      setSaveError(t.saveError);
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async (asNew: boolean) => {
    if (!validation.valid) return;
    let name = draft.name.trim();
    if (!name) { setSaveError(t.nameRequired); return; }
    const existing = !asNew && draft.id ? config.customStyles.find((style) => style.id === draft.id) : undefined;
    if (asNew) name = uniqueCopyName(name, config.customStyles);
    if (config.customStyles.some((style) => style.id !== existing?.id && style.name === name)) {
      setSaveError(t.nameExists);
      return;
    }
    if (!existing && config.customStyles.length >= MAX_CUSTOM_STYLES) {
      setSaveError(t.limit);
      return;
    }
    const style: CustomKeyStyle = {
      id: existing?.id ?? window.crypto.randomUUID(), name,
      baseTheme: draft.baseTheme, css: draft.css,
    };
    const customStyles = existing
      ? config.customStyles.map((saved) => saved.id === existing.id ? style : saved)
      : [...config.customStyles, style];
    setSaving(true);
    setSaveError('');
    try {
      if (await onChange({ customStyles, activeCustomStyleId: style.id, theme: style.baseTheme })) {
        setDraft(style);
        setBaseline(style);
      } else setSaveError(t.saveError);
    } catch (error) {
      console.error('Failed to save custom key style:', error);
      setSaveError(t.saveError);
    } finally {
      setSaving(false);
    }
  };

  const removeStyle = async () => {
    if (!draft.id || !window.confirm(t.confirmDelete)) return;
    const remaining = config.customStyles.filter((style) => style.id !== draft.id);
    const activeCustomStyleId = config.activeCustomStyleId === draft.id ? null : config.activeCustomStyleId;
    setSaving(true);
    setSaveError('');
    try {
      if (await onChange({ customStyles: remaining, activeCustomStyleId })) {
        const next = draftFromConfig({ ...config, customStyles: remaining, activeCustomStyleId });
        setDraft(next);
        setBaseline(next);
        setPreview({ theme: next.baseTheme, css: next.css });
      } else setSaveError(t.saveError);
    } catch (error) {
      console.error('Failed to delete custom key style:', error);
      setSaveError(t.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-4 border-y border-gray-300 py-4" aria-label={t.title}>
      <h2 className="mb-4 text-lg font-semibold text-gray-700">{t.title}</h2>
      <label className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
        <span>{t.theme}</span>
        <select data-theme-select value={config.activeCustomStyleId ? `custom:${config.activeCustomStyleId}` : `theme:${config.theme}`}
          disabled={saving} onChange={(event) => { void selectStyle(event.target.value); }}
          className="max-w-full rounded border bg-white px-2 py-1.5 text-gray-700">
          <optgroup label={t.presets}>
            {KEY_THEMES.map((theme) => <option key={theme.id} value={`theme:${theme.id}`}>{theme.name[config.language]}</option>)}
          </optgroup>
          {config.customStyles.length > 0 && <optgroup label={t.custom}>
            {config.customStyles.map((style) => <option key={style.id} value={`custom:${style.id}`}>{style.name}</option>)}
          </optgroup>}
        </select>
      </label>
      <div className="mb-3 flex gap-1.5" aria-hidden="true">
        {swatches.map((color) => <span key={color} className="h-4 w-4 rounded-sm border border-black/10" style={{ backgroundColor: color }} />)}
      </div>
      <div className="mb-4 overflow-hidden rounded border border-gray-300 bg-gray-200" aria-label={t.preview}>
        <div data-style-scope="kv-style-preview" style={{ height: config.displayMode === 'keyboard' ? KEYBOARD_PANEL_HEIGHT : 144, contain: 'layout paint', isolation: 'isolate' }}>
          <style data-preview-css>{getThemeCss(preview.theme, 'kv-style-preview', preview.css)}</style>
          {config.displayMode === 'keyboard'
            ? <KeyboardPanel keyboardLayout={config.keyboardLayout} heldKeyCodes={[0x0011, 0xE048, 0x002A]} viewportHeight={KEYBOARD_PANEL_HEIGHT} />
            : <div className="flex min-h-[144px] flex-col items-end justify-center gap-2 p-4">
              <KeyItem keys={['Ctrl', 'A']} fadeOutDuration={1000} releasedAt={null} count={3} animate={false} />
              <KeyItem keys={['Space']} fadeOutDuration={1000} releasedAt={0} count={1} animate={false} />
            </div>}
        </div>
      </div>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1 text-sm text-gray-600">
          <span>{t.baseTheme}</span>
          <select data-base-theme value={draft.baseTheme} disabled={saving}
            onChange={(event) => updateDraft({ baseTheme: event.target.value as KeyThemeId })}
            className="w-full rounded border bg-white px-2 py-1.5 text-gray-700">
            {KEY_THEMES.map((theme) => <option key={theme.id} value={theme.id}>{theme.name[config.language]}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm text-gray-600">
          <span>{t.name}</span>
          <input data-style-name value={draft.name} maxLength={MAX_STYLE_NAME_LENGTH} disabled={saving}
            onChange={(event) => updateDraft({ name: event.target.value })}
            className="w-full rounded border bg-white px-2 py-1.5 text-gray-700" />
        </label>
      </div>
      <label className="block text-sm text-gray-600">
        <span className="mb-1 flex items-center justify-between gap-2">
          <span>{t.css}</span><span className="text-xs text-gray-500">{dirty ? t.unsaved : t.saved}</span>
        </span>
        <textarea data-css-editor spellCheck={false} value={draft.css} maxLength={MAX_CUSTOM_CSS_LENGTH} disabled={saving}
          onChange={(event) => updateDraft({ css: event.target.value })}
          className="h-52 w-full resize-y rounded border bg-white p-3 font-mono text-xs leading-5 text-gray-800" />
      </label>
      {!validation.valid && <p data-css-error role="alert" className="mt-2 break-words text-sm text-red-700">{t.invalidCss}: {validation.error}</p>}
      {saveError && <p data-name-error={saveError === t.nameExists} role="alert" className="mt-2 break-words text-sm text-red-700">{saveError}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" data-save-style disabled={saving || !validation.valid}
          onClick={() => { void saveDraft(false); }}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-40">{saving ? t.saving : t.save}</button>
        {draft.id && <button type="button" data-save-style-as disabled={saving || !validation.valid}
          onClick={() => { void saveDraft(true); }}
          className="rounded border bg-white px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40">{t.saveAs}</button>}
        <button type="button" data-reset-draft disabled={saving || !dirty} onClick={resetDraft}
          className="rounded border bg-white px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40">{t.reset}</button>
        <button type="button" data-css-template disabled={saving} onClick={() => {
          if (draft.css !== baseline.css && !window.confirm(t.discard)) return;
          updateDraft({ css: CUSTOM_CSS_TEMPLATE });
        }}
          className="rounded border bg-white px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40">{t.template}</button>
        {draft.id && <button type="button" data-delete-style disabled={saving} onClick={() => { void removeStyle(); }}
          className="rounded border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 disabled:opacity-40">{t.remove}</button>}
      </div>
    </section>
  );
}

type SettingsPage = 'display' | 'position' | 'appearance' | 'app';
const SETTINGS_PAGES: SettingsPage[] = ['display', 'position', 'appearance', 'app'];

function App() {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [page, setPage] = useState<SettingsPage>('display');
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [shortcutStatus, setShortcutStatus] = useState<PauseShortcutStatus | null>(null);
  const [shortcutError, setShortcutError] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [updateError, setUpdateError] = useState(false);
  const confirmedConfig = useRef<ConfigState | null>(null);
  const pendingChanges = useRef<Partial<ConfigState>>({});
  const pendingResults = useRef<Array<(success: boolean) => void>>([]);
  const inFlightChanges = useRef<Partial<ConfigState>>({});
  const isSaving = useRef(false);
  const configRevision = useRef(0);
  const language = config?.language ?? 'zh-CN';
  const t = translations[language];
  const activeStyle = config ? getActiveKeyStyle(config) : { theme: 'classic' as KeyThemeId, css: '' };

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t.windowTitle;
  }, [language, t.windowTitle]);

  const publishConfig = useCallback((saved: ConfigState) => {
    confirmedConfig.current = saved;
    setConfig({ ...saved, ...inFlightChanges.current, ...pendingChanges.current });
  }, []);

  useEffect(() => {
    let active = true;
    let receivedChange = false;
    const unsubscribe = electronAPI.onConfigChanged((newConfig) => {
      receivedChange = true;
      configRevision.current++;
      publishConfig(newConfig);
    });

    electronAPI.getConfig().then((initialConfig) => {
      if (active && !receivedChange) publishConfig(initialConfig);
    }).catch((error) => {
      if (active) {
        console.error('Failed to load config:', error);
        setLoadError(true);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [publishConfig]);

  useEffect(() => {
    let active = true;
    electronAPI.getPauseShortcutStatus().then((status) => {
      if (active) setShortcutStatus(status);
    }).catch((error) => {
      console.error('Failed to load pause shortcut status:', error);
      if (active) setShortcutError(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    let receivedChange = false;
    const unsubscribe = electronAPI.onUpdateStatusChanged((status) => {
      receivedChange = true;
      if (active) setUpdateStatus(status);
    });
    electronAPI.getUpdateStatus().then((status) => {
      if (active && !receivedChange) setUpdateStatus(status);
    }).catch((error) => {
      console.error('Failed to load update status:', error);
      if (active) setUpdateError(true);
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const savePendingChanges = useCallback(async () => {
    if (isSaving.current) return;
    isSaving.current = true;

    try {
      while (Object.keys(pendingChanges.current).length > 0) {
        const partial = pendingChanges.current;
        const results = pendingResults.current;
        pendingChanges.current = {};
        pendingResults.current = [];
        inFlightChanges.current = partial;
        const revision = configRevision.current;

        try {
          const saved = await electronAPI.updateConfig(partial);
          inFlightChanges.current = {};
          publishConfig(configRevision.current === revision ? saved : confirmedConfig.current ?? saved);
          setSaveError(false);
          results.forEach((complete) => complete(true));
        } catch (error) {
          inFlightChanges.current = {};
          console.error('Failed to update config:', error);
          setSaveError(true);
          try {
            const reloadRevision = configRevision.current;
            const reloaded = await electronAPI.getConfig();
            publishConfig(configRevision.current === reloadRevision ? reloaded : confirmedConfig.current ?? reloaded);
          } catch (loadError) {
            console.error('Failed to reload config:', loadError);
            if (confirmedConfig.current) publishConfig(confirmedConfig.current);
          }
          results.forEach((complete) => complete(false));
        }
      }
    } finally {
      isSaving.current = false;
    }
  }, [publishConfig]);

  const queueConfigChange = (partial: Partial<ConfigState>, optimistic = true): Promise<boolean> => new Promise((complete) => {
    pendingChanges.current = { ...pendingChanges.current, ...partial };
    pendingResults.current.push(complete);
    if (optimistic) setConfig((current) => current && { ...current, ...partial });
    void savePendingChanges();
  });

  const handleConfigChange = (partial: Partial<ConfigState>) => { void queueConfigChange(partial); };

  const handleToggleEnabled = () => {
    if (config) {
      handleConfigChange({ isEnabled: !config.isEnabled });
    }
  };

  const handleTogglePaused = () => {
    if (config?.isEnabled) handleConfigChange({ isPaused: !config.isPaused });
  };

  const runUpdateAction = (action: () => Promise<UpdateStatus>) => {
    setUpdateError(false);
    action().then(setUpdateStatus).catch((error) => {
      console.error('Update action failed:', error);
      setUpdateError(true);
    });
  };

  const updateMessage = !updateStatus ? t.update.loading : (() => {
    switch (updateStatus.phase) {
      case 'unsupported': return t.update[updateStatus.unsupportedReason ?? 'platform'];
      case 'idle': return t.update.idle;
      case 'checking': return t.update.checking;
      case 'up-to-date': return t.update.current;
      case 'available': return `${t.update.available}: v${updateStatus.availableVersion}`;
      case 'downloading': return `${t.update.downloading}: ${updateStatus.progress ?? 0}%`;
      case 'ready': return `${t.update.ready}: v${updateStatus.availableVersion}`;
      case 'installing': return t.update.installing;
      case 'error': return t.update.error;
    }
  })();

  const retryLoad = () => {
    setLoadError(false);
    electronAPI.getConfig().then((loaded) => {
      if (!confirmedConfig.current) publishConfig(loaded);
    }).catch((error) => {
      console.error('Failed to load config:', error);
      setLoadError(true);
    });
  };

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
        <div className="text-gray-600 text-center" role={loadError ? 'alert' : undefined}>
          {loadError ? (
            <>
              <p>{t.loadError}</p>
              <button onClick={retryLoad} className="mt-3 px-3 py-1.5 bg-white border rounded text-gray-700">{t.retry}</button>
            </>
          ) : t.loading}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <h1 className="min-w-0 text-base font-semibold text-gray-900">{t.appName}</h1>
          <span className={`shrink-0 text-xs font-medium ${config.isEnabled && !config.isPaused ? 'text-emerald-700' : 'text-amber-700'}`}>
            {config.isEnabled ? config.isPaused ? t.paused : t.running : t.disabled}
          </span>
        </div>
        <nav aria-label={t.settings} className="mx-auto grid max-w-3xl grid-cols-4 px-2 sm:px-4">
          {SETTINGS_PAGES.map((item) => (
            <button key={item} type="button" data-settings-page={item} aria-current={page === item ? 'page' : undefined}
              onClick={() => { setPage(item); window.scrollTo?.(0, 0); }}
              className={`relative min-w-0 border-b-2 px-1 py-2.5 text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                page === item ? 'border-teal-600 font-semibold text-teal-800' : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}>{t.pages[item]}
              {item === 'app' && (updateStatus?.phase === 'available' || updateStatus?.phase === 'ready') && (
                <><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-teal-600" /><span className="sr-only">{t.update.badge}</span></>
              )}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-10 pt-5 sm:px-6">
      {saveError && <p role="alert" className="mb-4 border-l-2 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">{t.saveError}</p>}

      {page === 'display' && <section aria-label={t.displayTitle}>
        <h2 className="mb-4 text-xl font-semibold text-gray-900">{t.displayTitle}</h2>
        <div className="divide-y divide-gray-200 border-y border-gray-200 bg-white px-4">

        {/* Enable Toggle */}
        <div className="flex items-center justify-between py-3 border-b">
          <span className="text-gray-600">{t.enabled}</span>
          <button
            onClick={handleToggleEnabled}
            type="button"
            role="switch"
            aria-label={t.enabled}
            aria-checked={config.isEnabled}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              config.isEnabled ? 'bg-blue-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                config.isEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b">
          <span className="text-sm text-gray-600" role="status">
            {config.isEnabled ? config.isPaused ? t.paused : t.running : t.disabled}
          </span>
          <button
            type="button"
            onClick={handleTogglePaused}
            disabled={!config.isEnabled}
            className="min-w-24 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-default disabled:opacity-40"
          >
            {config.isPaused ? t.resume : t.pause}
          </button>
        </div>

        {shortcutStatus && (
          <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs text-gray-500">
            <span>{t.pauseShortcut}: {shortcutStatus.accelerator.replace('CommandOrControl', navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl')}</span>
            <span className={shortcutStatus.registered ? 'text-green-700' : 'text-amber-700'}>
              {shortcutStatus.registered ? t.shortcutAvailable : t.shortcutUnavailable}
            </span>
          </div>
        )}
        {shortcutError && <p role="alert" className="py-2 text-xs text-amber-700">{t.shortcutError}</p>}

        <fieldset className="py-3 border-b">
          <legend className="float-left mb-2 w-full text-gray-600">{t.mode}</legend>
          <div className="clear-both grid grid-cols-2 rounded border border-gray-300 bg-gray-100 p-1">
            {(['history', 'keyboard'] as const).map((mode) => (
              <label key={mode} className={`cursor-pointer rounded px-2 py-2 text-center text-sm focus-within:ring-2 focus-within:ring-blue-500 ${config.displayMode === mode ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}`}>
                <input
                  type="radio"
                  name="display-mode"
                  value={mode}
                  checked={config.displayMode === mode}
                  onChange={() => handleConfigChange({ displayMode: mode })}
                  className="sr-only"
                />
                {mode === 'history' ? t.historyMode : t.keyboardMode}
              </label>
            ))}
          </div>
        </fieldset>

        </div>
        {config.displayMode === 'keyboard' && <div className="mt-6">
        <h3 className="mb-3 text-base font-semibold text-gray-900">{t.keyboardTitle}</h3>
        <div className="divide-y divide-gray-200 border-y border-gray-200 bg-white px-4">
          <label className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
            <span className="font-medium">{t.keyboardLayout}</span>
            <select value={config.keyboardLayout} onChange={(event) => handleConfigChange({ keyboardLayout: event.target.value as ConfigState['keyboardLayout'] })}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-gray-800 focus:ring-2 focus:ring-teal-500">
              <option value="gaming">{t.gamingLayout}</option><option value="arrows">{t.arrowsLayout}</option>
            </select>
          </label>
          <div className="py-4">
            <div className="mb-3 flex items-center justify-between gap-3 text-sm">
              <label htmlFor="keyboard-scale" className="font-medium">{t.keyboardScale}</label>
              <strong className="tabular-nums text-teal-800">{config.keyboardScale}%</strong>
            </div>
            <input id="keyboard-scale" type="range" min={MIN_KEYBOARD_SCALE} max={MAX_KEYBOARD_SCALE} step="10"
              value={config.keyboardScale} onChange={(event) => handleConfigChange({ keyboardScale: Number(event.target.value) })}
              className="w-full accent-teal-600" />
            <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
              <span>{MIN_KEYBOARD_SCALE}%</span>
              <button type="button" onClick={() => handleConfigChange({ keyboardScale: 100 })}
                disabled={config.keyboardScale === 100} className="text-teal-700 hover:underline disabled:text-gray-400 disabled:no-underline">{t.keyboardScaleReset}</button>
              <span>{MAX_KEYBOARD_SCALE}%</span>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-medium">{t.keyboardPreview}</h3>
          <div data-style-scope="kv-keyboard-preview" className="flex h-60 items-center justify-center overflow-hidden border border-gray-200 bg-gray-200">
            <style>{getThemeCss(activeStyle.theme, 'kv-keyboard-preview', activeStyle.css)}</style>
            <KeyboardPanel keyboardLayout={config.keyboardLayout} heldKeyCodes={[0x0011, 0x002A]}
              keyboardScale={config.keyboardScale * 0.65} viewportWidth={416} viewportHeight={236} />
          </div>
        </div>
        </div>}

        {config.displayMode === 'history' && <div className="mt-6">
        <h3 className="mb-3 text-base font-semibold text-gray-900">{t.historyTitle}</h3>
        <div className="divide-y divide-gray-200 border-y border-gray-200 bg-white px-4">
          <AnimationSetting fadeOutDuration={config.fadeOutDuration} onChange={(fadeOutDuration) => handleConfigChange({ fadeOutDuration })} label={t.animation} />
          <DisplayCountSetting maxDisplayCount={config.maxDisplayCount} onChange={(maxDisplayCount) => handleConfigChange({ maxDisplayCount })}
            label={t.displayCount} description={t.displayCountDescription} />
        </div>
        </div>}
      </section>}

      {page === 'position' && <section aria-label={t.positionTitle}>
        <h2 className="mb-4 text-xl font-semibold text-gray-900">{t.positionTitle}</h2>
        <PositionSetting position={config.position} displayId={config.displayId} maxDisplayCount={config.maxDisplayCount}
          displayMode={config.displayMode} keyboardScale={config.keyboardScale}
          onChange={(position) => handleConfigChange({ position })}
          onDisplayChange={(displayId) => handleConfigChange({ displayId })} labels={t.position} />
      </section>}

      <div hidden={page !== 'appearance'}>
        <ThemeSetting config={config} onChange={(partial) => queueConfigChange(partial, false)} />
      </div>

      {page === 'app' && <section aria-label={t.appTitle}>
        <h2 className="mb-4 text-xl font-semibold text-gray-900">{t.appTitle}</h2>
        <div className="divide-y divide-gray-200 border-y border-gray-200 bg-white px-4">
          <label className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
            <span className="font-medium">{t.language}</span>
            <select value={config.language} onChange={(event) => handleConfigChange({ language: event.target.value as ConfigState['language'] })}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-gray-800 focus:ring-2 focus:ring-teal-500">
              <option value="zh-CN">简体中文</option><option value="en-US">English</option>
            </select>
          </label>
          <StartupSetting autoStart={config.autoStart} onChange={(autoStart) => handleConfigChange({ autoStart })}
            label={t.startup} enabledLabel={t.startupEnabled} />
        </div>
        <div className="mt-6">
          <h3 className="mb-3 text-base font-semibold text-gray-900">{t.update.title}</h3>
          <div className="border-y border-gray-200 bg-white px-4">
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 py-3 text-sm">
              <span>{t.version}</span>
              <span className="font-medium tabular-nums">{updateStatus ? `v${updateStatus.currentVersion}` : '…'}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
              <span role="status" className="text-gray-600">{updateMessage}</span>
              {updateStatus && ['idle', 'up-to-date', 'error'].includes(updateStatus.phase) && (
                <button type="button" data-update-action="check" onClick={() => runUpdateAction(electronAPI.checkForUpdates)}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 font-medium hover:bg-gray-50">{t.update.check}</button>
              )}
              {updateStatus?.phase === 'available' && (
                <button type="button" data-update-action="download" onClick={() => runUpdateAction(electronAPI.downloadUpdate)}
                  className="rounded bg-teal-700 px-3 py-1.5 font-medium text-white hover:bg-teal-800">{t.update.download}</button>
              )}
              {updateStatus?.phase === 'ready' && (
                <button type="button" data-update-action="install" onClick={() => runUpdateAction(electronAPI.installUpdate)}
                  className="rounded bg-teal-700 px-3 py-1.5 font-medium text-white hover:bg-teal-800">{t.update.install}</button>
              )}
            </div>
            {updateStatus?.phase === 'downloading' && <progress aria-label={t.update.downloading} max={100}
              value={updateStatus.progress ?? 0} className="mb-4 h-2 w-full accent-teal-600" />}
            {updateError && <p role="alert" className="pb-4 text-sm text-red-700">{t.update.error}</p>}
          </div>
        </div>
      </section>}
      </main>
    </div>
  );
}

export default App;
