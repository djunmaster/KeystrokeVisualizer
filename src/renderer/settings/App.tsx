import { useState, useEffect, useRef, useCallback } from 'react';
import { ConfigState } from '../shared/types';
import PositionSetting from './components/PositionSetting';
import AnimationSetting from './components/AnimationSetting';
import StartupSetting from './components/StartupSetting';
import DisplayCountSetting from './components/DisplayCountSetting';

// Settings window electron API type
interface SettingsElectronAPI {
  getConfig: () => Promise<ConfigState>;
  onConfigChanged: (callback: (config: ConfigState) => void) => () => void;
  updateConfig: (partial: Partial<ConfigState>) => Promise<ConfigState>;
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
    display: '显示设置',
    enabled: '显示按键',
    position: {
      title: '显示位置',
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
  },
  'en-US': {
    windowTitle: 'Keystroke Visualizer - Settings',
    loading: 'Loading...',
    loadError: 'Could not load settings.',
    retry: 'Retry',
    saveError: 'Could not save settings. Please try again.',
    settings: 'Settings',
    display: 'Display Settings',
    enabled: 'Enable Keystroke Display',
    position: {
      title: 'Display Position',
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
  },
} as const;

function App() {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const confirmedConfig = useRef<ConfigState | null>(null);
  const pendingChanges = useRef<Partial<ConfigState>>({});
  const inFlightChanges = useRef<Partial<ConfigState>>({});
  const isSaving = useRef(false);
  const language = config?.language ?? 'zh-CN';
  const t = translations[language];

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

  const savePendingChanges = useCallback(async () => {
    if (isSaving.current) return;
    isSaving.current = true;

    try {
      while (Object.keys(pendingChanges.current).length > 0) {
        const partial = pendingChanges.current;
        pendingChanges.current = {};
        inFlightChanges.current = partial;

        try {
          const saved = await electronAPI.updateConfig(partial);
          inFlightChanges.current = {};
          publishConfig(saved);
          setSaveError(false);
        } catch (error) {
          inFlightChanges.current = {};
          console.error('Failed to update config:', error);
          setSaveError(true);
          try {
            publishConfig(await electronAPI.getConfig());
          } catch (loadError) {
            console.error('Failed to reload config:', loadError);
            if (confirmedConfig.current) publishConfig(confirmedConfig.current);
          }
        }
      }
    } finally {
      isSaving.current = false;
    }
  }, [publishConfig]);

  const handleConfigChange = (partial: Partial<ConfigState>) => {
    pendingChanges.current = { ...pendingChanges.current, ...partial };
    setConfig((current) => current && { ...current, ...partial });
    void savePendingChanges();
  };

  const handleToggleEnabled = () => {
    if (config) {
      handleConfigChange({ isEnabled: !config.isEnabled });
    }
  };

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
    <div className="min-h-screen bg-gray-100 p-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">{t.settings}</h1>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span>{t.language}</span>
          <select
            value={config.language}
            onChange={(event) => handleConfigChange({ language: event.target.value as ConfigState['language'] })}
            className="rounded border bg-white px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="zh-CN">简体中文</option>
            <option value="en-US">English</option>
          </select>
        </label>
      </header>
      {saveError && <p role="alert" className="mb-4 text-sm text-red-700">{t.saveError}</p>}

      {/* Display Settings */}
      <section className="bg-white rounded-lg shadow p-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">{t.display}</h2>

        {/* Enable Toggle */}
        <div className="flex items-center justify-between py-3 border-b">
          <span className="text-gray-600">{t.enabled}</span>
          <button
            onClick={handleToggleEnabled}
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

        {/* Position Setting */}
        <PositionSetting
          position={config.position}
          maxDisplayCount={config.maxDisplayCount}
          onChange={(position) => handleConfigChange({ position })}
          labels={t.position}
        />

        {/* Animation Setting */}
        <AnimationSetting
          fadeOutDuration={config.fadeOutDuration}
          onChange={(fadeOutDuration) => handleConfigChange({ fadeOutDuration })}
          label={t.animation}
        />

        {/* Display Count Setting */}
        <DisplayCountSetting
          maxDisplayCount={config.maxDisplayCount}
          onChange={(maxDisplayCount) => handleConfigChange({ maxDisplayCount })}
          label={t.displayCount}
          description={t.displayCountDescription}
        />
      </section>

      {/* System Settings */}
      <section className="bg-white rounded-lg shadow p-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">{t.system}</h2>

        <StartupSetting
          autoStart={config.autoStart}
          onChange={(autoStart) => handleConfigChange({ autoStart })}
          label={t.startup}
          enabledLabel={t.startupEnabled}
        />
      </section>

      {/* About */}
      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">{t.about}</h2>
        <div className="flex items-center justify-between text-gray-600">
          <span>{t.version}: v1.0.0</span>
        </div>
      </section>
    </div>
  );
}

export default App;
