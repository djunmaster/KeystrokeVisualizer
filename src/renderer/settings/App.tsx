import { useState, useEffect } from 'react'
import { ConfigState, DEFAULT_CONFIG } from '../shared/types'
import PositionSetting from './components/PositionSetting'
import AnimationSetting from './components/AnimationSetting'
import StartupSetting from './components/StartupSetting'

function App() {
  const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG)

  useEffect(() => {
    // TODO: 从 Main Process 获取配置
    // window.electronAPI.getConfig().then(setConfig)

    // TODO: 监听配置变更
    // window.electronAPI.onConfigChanged(setConfig)
  }, [])

  const handleConfigChange = (partial: Partial<ConfigState>) => {
    const newConfig = { ...config, ...partial }
    setConfig(newConfig)
    // TODO: 发送更新到 Main Process
    // window.electronAPI.updateConfig(partial)
  }

  const handleToggleEnabled = () => {
    handleConfigChange({ isEnabled: !config.isEnabled })
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <span>⚙️</span>
        <span>按键可视化工具 - 设置</span>
      </h1>

      {/* 显示设置 */}
      <section className="bg-white rounded-lg shadow p-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">显示设置</h2>

        {/* 启用开关 */}
        <div className="flex items-center justify-between py-3 border-b">
          <span className="text-gray-600">启用按键显示</span>
          <button
            onClick={handleToggleEnabled}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              config.isEnabled ? 'bg-blue-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                config.isEnabled ? 'translate-x-8' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* 位置设置 */}
        <PositionSetting
          position={config.position}
          onChange={(position) => handleConfigChange({ position })}
        />

        {/* 动画设置 */}
        <AnimationSetting
          fadeOutDuration={config.fadeOutDuration}
          onChange={(fadeOutDuration) => handleConfigChange({ fadeOutDuration })}
        />
      </section>

      {/* 系统设置 */}
      <section className="bg-white rounded-lg shadow p-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">系统设置</h2>

        <StartupSetting
          autoStart={config.autoStart}
          onChange={(autoStart) => handleConfigChange({ autoStart })}
        />
      </section>

      {/* 关于 */}
      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">关于</h2>
        <div className="flex items-center justify-between text-gray-600">
          <span>版本: v1.0.0</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 transition-colors">
              检查更新
            </button>
            <button className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 transition-colors">
              GitHub
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default App
