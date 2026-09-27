import { useState, useEffect, useRef, CSSProperties } from 'react';
import KeyItem from './KeyItem';
import { ConfigState, KEYBOARD_PANEL_HEIGHT, KEYBOARD_PANEL_KEYS, KEYBOARD_PANEL_LAYOUTS, KEYBOARD_PANEL_WIDTH } from '../../shared/types';
import { applyKeyPress, applyKeyState, createKeyDisplayState, getNextExpiry, isPanelKeyHeld, pruneHistory } from '../key-state';

interface KeyDisplayProps {
  displayMode: ConfigState['displayMode'];
  keyboardLayout: ConfigState['keyboardLayout'];
  keyboardScale?: number;
  fadeOutDuration: number;
  maxDisplayCount: number;
  stackFrom: 'top' | 'bottom';
  alignX: 'left' | 'center' | 'right';
}

interface KeyboardPanelProps {
  keyboardLayout: ConfigState['keyboardLayout'];
  heldKeyCodes: readonly number[];
  viewportHeight: number;
  viewportWidth?: number;
  keyboardScale?: number;
}

export function KeyboardPanel({ keyboardLayout, heldKeyCodes, viewportHeight, viewportWidth = KEYBOARD_PANEL_WIDTH,
  keyboardScale = 100 }: KeyboardPanelProps) {
  const arrowLabels: Record<string, string> = { Up: '\u2191', Left: '\u2190', Down: '\u2193', Right: '\u2192' };
  const scale = Math.max(0, Math.min(keyboardScale / 100, viewportWidth / KEYBOARD_PANEL_WIDTH,
    viewportHeight / KEYBOARD_PANEL_HEIGHT));
  const panelHeight = KEYBOARD_PANEL_HEIGHT * scale;
  const panelPadding = 16 * scale;
  const rowGap = 12 * scale;
  const rowHeight = Math.max(0, (panelHeight - panelPadding * 2 - rowGap * 2) / 3);
  const panelStyle = {
    width: KEYBOARD_PANEL_WIDTH * scale, height: panelHeight, padding: panelPadding, gap: rowGap,
    '--kv-panel-font-size': `${18 * scale}px`,
  } as CSSProperties;
  return (
    <div data-keyboard-panel className="kv-panel mx-auto flex flex-col justify-center" style={panelStyle}>
      {KEYBOARD_PANEL_LAYOUTS[keyboardLayout].map((row, rowIndex) => (
        <div key={rowIndex} data-keyboard-row className="kv-panel-row flex min-h-0 shrink-0 justify-center" style={{ height: rowHeight, gap: 8 * scale }}>
          {row.map((key) => {
            const held = isPanelKeyHeld(KEYBOARD_PANEL_KEYS[key], heldKeyCodes);
            const modifier = key === 'Shift' || key === 'Ctrl';
            return (
              <div
                key={key}
                data-key={key}
                data-role={modifier ? 'modifier' : 'main'}
                data-held={held}
                aria-label={`${key}${held ? ' pressed' : ''}`}
                className="kv-key kv-panel-key flex h-full min-h-0 items-center justify-center font-semibold"
                style={{ width: (key === 'Space' ? 112 : modifier ? 80 : 64) * scale }}
              >
                {arrowLabels[key] ?? key}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function KeyDisplay({ displayMode, keyboardLayout, keyboardScale = 100, fadeOutDuration, maxDisplayCount, stackFrom, alignX }: KeyDisplayProps) {
  const [state, setState] = useState(createKeyDisplayState);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const itemHeight = 54;
  const gap = 8;
  const verticalPadding = 32;
  const viewportLimit = Math.max(1, Math.floor((viewport.height - verticalPadding + gap) / (itemHeight + gap)));
  const displayLimit = Number.isFinite(maxDisplayCount)
    ? Math.min(viewportLimit, Math.max(1, Math.floor(maxDisplayCount))) : 1;
  const limitRef = useRef(displayLimit);
  limitRef.current = displayLimit;

  useEffect(() => {
    const handleResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setState((previous) => previous.history.length > displayLimit
      ? { ...previous, history: previous.history.slice(-displayLimit) } : previous);
  }, [displayLimit]);

  useEffect(() => {
    let active = true;
    let receivedState = false;
    const unsubscribeState = window.electronAPI.onKeyStateChanged((event) => {
      receivedState = true;
      setState((previous) => applyKeyState(previous, event));
    });
    const unsubscribePress = displayMode === 'history'
      ? window.electronAPI.onKeyPressed((event) => {
        receivedState = true;
        setState((previous) => applyKeyPress(previous, event, limitRef.current));
      }) : undefined;

    window.electronAPI.getKeyState().then((snapshot) => {
      if (active && !receivedState) setState((previous) => applyKeyState(previous, snapshot));
    }).catch((error) => console.error('Failed to load held keys:', error));

    return () => {
      active = false;
      unsubscribeState();
      unsubscribePress?.();
    };
  }, [displayMode]);

  useEffect(() => {
    const nextExpiry = getNextExpiry(state.history, fadeOutDuration);
    if (nextExpiry === null) return;
    const timeout = setTimeout(() => {
      setState((previous) => pruneHistory(previous, Date.now(), fadeOutDuration));
    }, Math.max(0, nextExpiry - Date.now()));

    return () => clearTimeout(timeout);
  }, [fadeOutDuration, state.history]);

  if (displayMode === 'keyboard') {
    return (
      <KeyboardPanel keyboardLayout={keyboardLayout} keyboardScale={keyboardScale} heldKeyCodes={state.heldKeyCodes}
        viewportHeight={viewport.height} viewportWidth={viewport.width} />
    );
  }

  const stackClass = stackFrom === 'bottom' ? 'justify-end' : 'justify-start';
  const alignClass =
    alignX === 'left' ? 'items-start' : alignX === 'center' ? 'items-center' : 'items-end';
  const orderedKeyPresses =
    stackFrom === 'top' ? [...state.history].reverse() : state.history;

  return (
    <div className={`kv-history flex h-full flex-col gap-2 p-4 ${stackClass} ${alignClass}`}>
      {orderedKeyPresses.map((kp) => (
        <KeyItem
          key={kp.id}
          keys={kp.keys}
          fadeOutDuration={fadeOutDuration}
          releasedAt={kp.releasedAt}
          count={kp.count}
        />
      ))}
    </div>
  );
}

export default KeyDisplay;
