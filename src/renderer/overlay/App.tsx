import { useState, useEffect, useMemo } from 'react';
import KeyDisplay from './components/KeyDisplay';
import DragHandle from './components/DragHandle';
import { ConfigState, KeyPressEvent, KeyStateEvent } from '../shared/types';
import { getActiveKeyStyle, getThemeCss } from './key-state';

declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<ConfigState>;
      onConfigChanged: (callback: (config: ConfigState) => void) => () => void;
      onKeyPressed: (callback: (event: KeyPressEvent) => void) => () => void;
      getKeyState: () => Promise<KeyStateEvent>;
      onKeyStateChanged: (callback: (event: KeyStateEvent) => void) => () => void;
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
  const displayId = config?.displayId;
  const { theme: activeTheme, css: activeCss } = getActiveKeyStyle({
    theme: config?.theme ?? 'classic', customStyles: config?.customStyles ?? [],
    activeCustomStyleId: config?.activeCustomStyleId ?? null,
  });
  const themeCss = useMemo(() => getThemeCss(activeTheme, 'kv-overlay', activeCss), [activeTheme, activeCss]);

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
  }, [positionX, positionY, displayId]);

  if (!config || !config.isEnabled || config.isPaused) {
    return null;
  }

  const stackFrom = preset.startsWith('top') ? 'top' : 'bottom';
  const alignX = preset.includes('left') ? 'left' : preset.includes('center') ? 'center' : 'right';

  return (
    <div data-style-scope="kv-overlay" className="relative w-full h-full" style={{ contain: 'layout paint', isolation: 'isolate' }}>
      <style>{themeCss}</style>
      <KeyDisplay
        key={`${config.displayMode}:${config.keyboardLayout}`}
        displayMode={config.displayMode}
        keyboardLayout={config.keyboardLayout}
        keyboardScale={config.keyboardScale}
        customKeyboardLayouts={config.customKeyboardLayouts}
        activeCustomKeyboardLayoutId={config.activeCustomKeyboardLayoutId}
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
