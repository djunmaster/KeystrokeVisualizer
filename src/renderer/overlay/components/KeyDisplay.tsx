import { useState, useEffect, useRef, CSSProperties } from 'react';
import KeyItem from './KeyItem';
import { ConfigState, KEYBOARD_PANEL_KEYS, KEYBOARD_PANEL_WIDTH, KeyboardLayoutKey, getKeyboardRows,
  getConfiguredKeyboardPanelSize, getKeyboardKeyLabel, KEY_WIDTH_UNIT, KEYBOARD_KEY_HEIGHT, KEYBOARD_PADDING,
  KEYBOARD_ROW_GAP, KEYBOARD_KEY_GAP } from '../../shared/types';
import { applyKeyPress, applyKeyState, createKeyDisplayState, getNextExpiry, isPanelKeyHeld, pruneHistory } from '../key-state';

interface KeyDisplayProps {
  displayMode: ConfigState['displayMode'];
  keyboardLayout: ConfigState['keyboardLayout'];
  keyboardScale?: number;
  customKeyboardLayouts?: ConfigState['customKeyboardLayouts'];
  activeCustomKeyboardLayoutId?: string | null;
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
  rows?: KeyboardLayoutKey[][];
}

export function KeyboardPanel({ keyboardLayout, heldKeyCodes, viewportHeight, viewportWidth = KEYBOARD_PANEL_WIDTH,
  keyboardScale = 100, rows = getKeyboardRows(keyboardLayout) }: KeyboardPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  useEffect(() => {
    const parent = panelRef.current?.parentElement;
    if (!parent) return;
    const measure = () => setContainerWidth(parent.clientWidth || null);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);
  const size = getConfiguredKeyboardPanelSize(keyboardLayout, rows);
  const scale = Math.max(0, Math.min(keyboardScale / 100, Math.min(viewportWidth, containerWidth ?? viewportWidth) / size.width, viewportHeight / size.height));
  const panelHeight = size.height * scale;
  const panelPadding = KEYBOARD_PADDING * scale;
  const rowGap = KEYBOARD_ROW_GAP * scale;
  const rowHeight = KEYBOARD_KEY_HEIGHT * scale;
  const panelStyle = {
    width: size.width * scale, height: panelHeight, padding: panelPadding, gap: rowGap,
    '--kv-panel-font-size': `${18 * scale}px`,
  } as CSSProperties;
  return (
    <div ref={panelRef} data-keyboard-panel className="kv-panel mx-auto flex flex-col justify-center" style={panelStyle}>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} data-keyboard-row className="kv-panel-row flex min-h-0 shrink-0 justify-center" style={{ height: rowHeight, gap: KEYBOARD_KEY_GAP * scale }}>
          {row.map((cell, index) => {
            const { key, width } = cell;
            if (key === 'Spacer') return <div key={index} aria-hidden="true" className="shrink-0" style={{ width: width * KEY_WIDTH_UNIT * scale }} />;
            const held = isPanelKeyHeld(KEYBOARD_PANEL_KEYS[key], heldKeyCodes);
            const modifier = /^(Shift|Ctrl|Alt|Meta)/.test(key);
            const label = cell.label ?? getKeyboardKeyLabel(key);
            const labelWidth = Array.from(label).reduce((sum, character) => sum + (character.charCodeAt(0) <= 0x7F ? 0.65 : 1), 0);
            return (
              <div
                key={index}
                data-key={key}
                data-role={modifier ? 'modifier' : 'main'}
                data-held={held}
                aria-label={`${key}${held ? ' pressed' : ''}`}
                title={key}
                className="kv-key kv-panel-key flex h-full min-h-0 min-w-0 shrink-0 items-center justify-center break-all text-center font-semibold"
                style={{ width: width * KEY_WIDTH_UNIT * scale,
                  '--kv-panel-font-size': `${Math.min(18, (width * KEY_WIDTH_UNIT - 12) / Math.max(1, labelWidth)) * scale}px` } as CSSProperties}
              >
                {label}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function KeyDisplay({ displayMode, keyboardLayout, keyboardScale = 100, customKeyboardLayouts, activeCustomKeyboardLayoutId,
  fadeOutDuration, maxDisplayCount, stackFrom, alignX }: KeyDisplayProps) {
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
        rows={getKeyboardRows(keyboardLayout, customKeyboardLayouts, activeCustomKeyboardLayoutId)}
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
