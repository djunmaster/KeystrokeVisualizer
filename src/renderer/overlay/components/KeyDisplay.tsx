import { useState, useEffect, useRef } from 'react';
import KeyItem from './KeyItem';
import { KeyPressEvent } from '../../shared/types';

interface DisplayKeyPress extends KeyPressEvent {
  id: string;
}

interface KeyDisplayProps {
  fadeOutDuration: number;
  maxDisplayCount: number;
  stackFrom: 'top' | 'bottom';
  alignX: 'left' | 'center' | 'right';
}

function KeyDisplay({ fadeOutDuration, maxDisplayCount, stackFrom, alignX }: KeyDisplayProps) {
  const [keyPresses, setKeyPresses] = useState<DisplayKeyPress[]>([]);
  const nextId = useRef(0);
  const displayLimit = Number.isFinite(maxDisplayCount) ? Math.max(1, Math.floor(maxDisplayCount)) : 1;

  // Trim existing keyPresses when maxDisplayCount decreases
  useEffect(() => {
    setKeyPresses((prev) => {
      if (prev.length > displayLimit) {
        return prev.slice(-displayLimit);
      }
      return prev;
    });
  }, [displayLimit]);

  useEffect(() => {
    // Listen for key press events from Main Process
    const unsubscribe = window.electronAPI.onKeyPressed((event: KeyPressEvent) => {
      const newKeyPress: DisplayKeyPress = {
        id: String(nextId.current++),
        keys: event.keys,
        timestamp: event.timestamp,
      };

      setKeyPresses((prev) => {
        const updated = [...prev, newKeyPress];
        // Limit to maxDisplayCount items
        if (updated.length > displayLimit) {
          return updated.slice(-displayLimit);
        }
        return updated;
      });
    });

    return unsubscribe;
  }, [displayLimit]);

  useEffect(() => {
    if (keyPresses.length === 0) return;

    const nextExpiry = Math.min(...keyPresses.map((press) => press.timestamp + fadeOutDuration + 500));
    const timeout = setTimeout(() => {
      const now = Date.now();
      setKeyPresses((prev) =>
        prev.filter((kp) => now - kp.timestamp < fadeOutDuration + 500)
      );
    }, Math.max(0, nextExpiry - Date.now()));

    return () => clearTimeout(timeout);
  }, [fadeOutDuration, keyPresses]);

  const stackClass = stackFrom === 'bottom' ? 'justify-end' : 'justify-start';
  const alignClass =
    alignX === 'left' ? 'items-start' : alignX === 'center' ? 'items-center' : 'items-end';
  const orderedKeyPresses =
    stackFrom === 'top' ? [...keyPresses].reverse() : keyPresses;

  return (
    <div className={`flex h-full flex-col gap-2 p-4 ${stackClass} ${alignClass}`}>
      {orderedKeyPresses.map((kp) => (
        <KeyItem
          key={kp.id}
          keys={kp.keys}
          fadeOutDuration={fadeOutDuration}
          timestamp={kp.timestamp}
        />
      ))}
    </div>
  );
}

export default KeyDisplay;
