import { useState, useEffect } from 'react'
import KeyItem from './KeyItem'

interface KeyPressEvent {
  id: string
  keys: string[]
  timestamp: number
}

interface KeyDisplayProps {
  fadeOutDuration: number
}

function KeyDisplay({ fadeOutDuration }: KeyDisplayProps) {
  const [keyPresses, setKeyPresses] = useState<KeyPressEvent[]>([])

  useEffect(() => {
    // TODO: 监听来自 Main Process 的按键事件
    // window.electronAPI.onKeyPressed((event) => { ... })
  }, [])

  // 移除已淡出的按键
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setKeyPresses((prev) =>
        prev.filter((kp) => now - kp.timestamp < fadeOutDuration + 500)
      )
    }, 100)

    return () => clearInterval(interval)
  }, [fadeOutDuration])

  return (
    <div className="flex flex-col items-end gap-2 p-4">
      {keyPresses.map((kp) => (
        <KeyItem
          key={kp.id}
          keys={kp.keys}
          fadeOutDuration={fadeOutDuration}
          timestamp={kp.timestamp}
        />
      ))}
    </div>
  )
}

export default KeyDisplay
