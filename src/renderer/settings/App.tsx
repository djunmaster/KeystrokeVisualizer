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

function App() {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const confirmedConfig = useRef<ConfigState | null>(null);
  const pendingChanges = useRef<Partial<ConfigState>>({});
  const inFlightChanges = useRef<Partial<ConfigState>>({});
  const isSaving = useRef(false);

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
              <p>Could not load settings.</p>
              <button onClick={retryLoad} className="mt-3 px-3 py-1.5 bg-white border rounded text-gray-700">Retry</button>
            </>
          ) : 'Loading...'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <span>Settings</span>
      </h1>
      {saveError && <p role="alert" className="mb-4 text-sm text-red-700">Could not save settings. Please try again.</p>}

      {/* Display Settings */}
      <section className="bg-white rounded-lg shadow p-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Display Settings</h2>

        {/* Enable Toggle */}
        <div className="flex items-center justify-between py-3 border-b">
          <span className="text-gray-600">Enable Keystroke Display</span>
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
          onChange={(position) => handleConfigChange({ position })}
        />

        {/* Animation Setting */}
        <AnimationSetting
          fadeOutDuration={config.fadeOutDuration}
          onChange={(fadeOutDuration) => handleConfigChange({ fadeOutDuration })}
        />

        {/* Display Count Setting */}
        <DisplayCountSetting
          maxDisplayCount={config.maxDisplayCount}
          onChange={(maxDisplayCount) => handleConfigChange({ maxDisplayCount })}
        />
      </section>

      {/* System Settings */}
      <section className="bg-white rounded-lg shadow p-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">System Settings</h2>

        <StartupSetting
          autoStart={config.autoStart}
          onChange={(autoStart) => handleConfigChange({ autoStart })}
        />
      </section>

      {/* About */}
      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">About</h2>
        <div className="flex items-center justify-between text-gray-600">
          <span>Version: v1.0.0</span>
        </div>
      </section>
    </div>
  );
}

export default App;
