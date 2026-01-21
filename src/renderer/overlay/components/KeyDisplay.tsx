import { useState, useEffect } from 'react';
import KeyItem from './KeyItem';

interface KeyPressEvent {
  id: string;
  keys: string[];
  timestamp: number;
}

interface KeyDisplayProps {
  fadeOutDuration: number;
  maxDisplayCount: number;
  stackFrom: 'top' | 'bottom';
  alignX: 'left' | 'center' | 'right';
}

function KeyDisplay({ fadeOutDuration, maxDisplayCount, stackFrom, alignX }: KeyDisplayProps) {
  const [keyPresses, setKeyPresses] = useState<KeyPressEvent[]>([]);

  // Trim existing keyPresses when maxDisplayCount decreases
  useEffect(() => {
    setKeyPresses((prev) => {
      if (prev.length > maxDisplayCount) {
        return prev.slice(-maxDisplayCount);
      }
      return prev;
    });
  }, [maxDisplayCount]);

  useEffect(() => {
    // Listen for key press events from Main Process
    const unsubscribe = window.electronAPI.onKeyPressed((event: { keys: string[]; timestamp: number }) => {
      const newKeyPress: KeyPressEvent = {
        id: `${event.timestamp}-${Math.random()}`,
        keys: event.keys,
        timestamp: event.timestamp,
      };

      setKeyPresses((prev) => {
        const updated = [...prev, newKeyPress];
        // Limit to maxDisplayCount items
        if (updated.length > maxDisplayCount) {
          return updated.slice(-maxDisplayCount);
        }
        return updated;
      });
    });

    return unsubscribe;
  }, [maxDisplayCount]);

  // Remove faded out keys
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setKeyPresses((prev) =>
        prev.filter((kp) => now - kp.timestamp < fadeOutDuration + 500)
      );
    }, 100);

    return () => clearInterval(interval);
  }, [fadeOutDuration]);

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
