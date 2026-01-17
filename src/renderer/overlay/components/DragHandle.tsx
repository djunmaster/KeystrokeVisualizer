import { useState } from 'react'

function DragHandle() {
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseEnter = () => {
    setIsHovered(true)
    // TODO: 通知 Main Process 取消鼠标穿透
    // window.electronAPI.setIgnoreMouseEvents(false)
  }

  const handleMouseLeave = () => {
    if (!isDragging) {
      setIsHovered(false)
      // TODO: 通知 Main Process 恢复鼠标穿透
      // window.electronAPI.setIgnoreMouseEvents(true)
    }
  }

  const handleMouseDown = () => {
    setIsDragging(true)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    // TODO: 保存新位置到配置
    // window.electronAPI.updatePosition({ x, y })
  }

  return (
    <div
      className={`absolute bottom-2 right-2 w-8 h-8 flex items-center justify-center rounded cursor-move transition-opacity ${
        isHovered || isDragging ? 'opacity-100' : 'opacity-0'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
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
  )
}

export default DragHandle
