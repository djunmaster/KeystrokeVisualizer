import { useState, useEffect } from 'react';
import KeyDisplay from './components/KeyDisplay';
import DragHandle from './components/DragHandle';
import { ConfigState } from '../shared/types';

declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<ConfigState>;
      onConfigChanged: (callback: (config: ConfigState) => void) => () => void;
      onKeyPressed: (callback: (event: any) => void) => () => void;
      savePosition: () => Promise<void>;
      setMousePassThrough: (enabled: boolean) => Promise<void>;
      getPresetName: (position: { x: number; y: number }) => Promise<string>;
    };
  }
}

function App() {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [preset, setPreset] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'bottom-center' | 'top-center'>('bottom-right');

  const getPresetFromPosition = async (position: { x: number; y: number }) => {
    if (window.electronAPI.getPresetName) {
      const name = await window.electronAPI.getPresetName(position);
      if (
        name === 'bottom-right' ||
        name === 'bottom-left' ||
        name === 'top-right' ||
        name === 'top-left' ||
        name === 'bottom-center' ||
        name === 'top-center'
      ) {
        return name;
      }
    }
    return 'bottom-right';
  };

  useEffect(() => {
    // Get initial config
    window.electronAPI.getConfig().then((cfg) => {
      setConfig(cfg);
    });

    // Listen for config changes
    const unsubscribe = window.electronAPI.onConfigChanged((newConfig) => {
      setConfig(newConfig);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!config) return;
    let isActive = true;
    getPresetFromPosition(config.position).then((name) => {
      if (isActive) {
        setPreset(name);
      }
    });
    return () => {
      isActive = false;
    };
  }, [config?.position.x, config?.position.y]);

  if (!config || !config.isEnabled) {
    return null;
  }

  const stackFrom = preset.startsWith('top') ? 'top' : 'bottom';
  const alignX = preset.includes('left') ? 'left' : preset.includes('center') ? 'center' : 'right';

  return (
    <div className="relative w-full h-full">
      <KeyDisplay
        fadeOutDuration={config.fadeOutDuration}
        maxDisplayCount={config.maxDisplayCount}
        stackFrom={stackFrom}
        alignX={alignX}
      />
      <DragHandle />
    </div>
  );
}

export default App;
