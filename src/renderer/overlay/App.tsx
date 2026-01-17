import { useState, useEffect } from 'react'
import KeyDisplay from './components/KeyDisplay'
import DragHandle from './components/DragHandle'

function App() {
  const [isEnabled, setIsEnabled] = useState(false)
  const [fadeOutDuration, setFadeOutDuration] = useState(1000)

  useEffect(() => {
    // TODO: 从 Main Process 获取配置
    // TODO: 监听配置变更
  }, [])

  if (!isEnabled) {
    return null
  }

  return (
    <div className="relative w-full h-full">
      <KeyDisplay fadeOutDuration={fadeOutDuration} />
      <DragHandle />
    </div>
  )
}

export default App
