import { useState, useEffect } from 'react';

function DragHandle() {
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    window.electronAPI.setMousePassThrough(false).catch((error) => {
      console.error('Failed to disable mouse pass-through:', error);
    });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    window.electronAPI.setMousePassThrough(true).catch((error) => {
      console.error('Failed to enable mouse pass-through:', error);
    });
  };

  useEffect(() => {
    return () => {
      window.electronAPI.setMousePassThrough(true).catch((error) => {
        console.error('Failed to enable mouse pass-through:', error);
      });
    };
  }, []);

  return (
    <div
      className="absolute bottom-0 right-0 flex h-12 w-12 items-center justify-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <div
        className={`flex h-8 w-8 cursor-move items-center justify-center rounded transition-opacity ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
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
    </div>
  );
}

export default DragHandle;
