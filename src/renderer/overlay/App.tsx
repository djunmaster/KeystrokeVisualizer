import { useState, useEffect } from 'react';
import KeyDisplay from './components/KeyDisplay';
import DragHandle from './components/DragHandle';
import { ConfigState, KeyPressEvent } from '../shared/types';

declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<ConfigState>;
      onConfigChanged: (callback: (config: ConfigState) => void) => () => void;
      onKeyPressed: (callback: (event: KeyPressEvent) => void) => () => void;
      savePosition: () => Promise<void>;
      setMousePassThrough: (enabled: boolean) => Promise<void>;
      getPresetName: (position: { x: number; y: number }) => Promise<string>;
    };
  }
}

async function getPresetFromPosition(position: { x: number; y: number }) {
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
  return 'bottom-right';
}

function App() {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [preset, setPreset] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'bottom-center' | 'top-center'>('bottom-right');
  const positionX = config?.position.x;
  const positionY = config?.position.y;

  useEffect(() => {
    let isActive = true;
    let receivedChange = false;
    const unsubscribe = window.electronAPI.onConfigChanged((newConfig) => {
      receivedChange = true;
      setConfig(newConfig);
    });

    window.electronAPI.getConfig().then((cfg) => {
      if (isActive && !receivedChange) {
        setConfig(cfg);
      }
    }).catch((error) => {
      console.error('Failed to load overlay config:', error);
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (positionX === undefined || positionY === undefined) return;
    let isActive = true;
    getPresetFromPosition({ x: positionX, y: positionY }).then((name) => {
      if (isActive) {
        setPreset(name);
      }
    }).catch((error) => {
      console.error('Failed to detect overlay position:', error);
    });
    return () => {
      isActive = false;
    };
  }, [positionX, positionY]);

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
