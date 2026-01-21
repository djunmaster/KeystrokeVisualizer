import { useState, useEffect } from 'react';
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

  useEffect(() => {
    // Get initial config from Main Process
    electronAPI.getConfig().then((cfg) => {
      setConfig(cfg);
    });

    // Listen for config changes from Main Process
    const unsubscribe = electronAPI.onConfigChanged((newConfig) => {
      setConfig(newConfig);
    });

    return unsubscribe;
  }, []);

  const handleConfigChange = async (partial: Partial<ConfigState>) => {
    // Optimistically update UI
    if (config) {
      setConfig({ ...config, ...partial });
    }

    // Send update to Main Process
    try {
      const newConfig = await electronAPI.updateConfig(partial);
      // Update with actual config from Main Process (in case it was modified)
      setConfig(newConfig);
    } catch (error) {
      console.error('Failed to update config:', error);
      // Revert to previous config on error
      if (config) {
        setConfig(config);
      }
    }
  };

  const handleToggleEnabled = () => {
    if (config) {
      handleConfigChange({ isEnabled: !config.isEnabled });
    }
  };

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <span>Settings</span>
      </h1>

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
          <div className="flex gap-2">
            <button className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 transition-colors">
              Check for Updates
            </button>
            <button className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 transition-colors">
              GitHub
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
