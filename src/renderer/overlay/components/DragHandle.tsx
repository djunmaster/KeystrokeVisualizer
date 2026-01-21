import { useState, useEffect } from 'react';

function DragHandle() {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = async () => {
    setIsHovered(true);
    // Disable mouse pass-through to allow dragging
    try {
      await window.electronAPI.setMousePassThrough(false);
    } catch (error) {
      console.error('Failed to disable mouse pass-through:', error);
    }
  };

  const handleMouseLeave = () => {
    if (!isDragging) {
      setIsHovered(false);
      // Re-enable mouse pass-through
      window.electronAPI.setMousePassThrough(true).catch((error) => {
        console.error('Failed to enable mouse pass-through:', error);
      });
    }
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseUp = async () => {
      setIsDragging(false);
      setIsHovered(false);

      // Save current window position to config
      try {
        await window.electronAPI.savePosition();
      } catch (error) {
        console.error('Failed to save position:', error);
      }

      // Re-enable mouse pass-through
      try {
        await window.electronAPI.setMousePassThrough(true);
      } catch (error) {
        console.error('Failed to enable mouse pass-through:', error);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      className={`absolute bottom-2 right-2 w-8 h-8 flex items-center justify-center rounded cursor-move transition-opacity ${
        isHovered || isDragging ? 'opacity-100' : 'opacity-0'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <svg
        className="w-5 h-5 text-white/60"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
      </svg>
    </div>
  );
}

export default DragHandle;
