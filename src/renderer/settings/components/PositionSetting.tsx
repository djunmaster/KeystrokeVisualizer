import { Position } from '../../shared/types'

interface PositionSettingProps {
  position: Position
  onChange: (position: Position) => void
}

const PRESET_POSITIONS = [
  { label: '右下角', value: 'bottom-right' },
  { label: '右上角', value: 'top-right' },
  { label: '左下角', value: 'bottom-left' },
  { label: '左上角', value: 'top-left' },
  { label: '底部居中', value: 'bottom-center' },
  { label: '顶部居中', value: 'top-center' },
  { label: '自定义', value: 'custom' },
]

function PositionSetting({ position, onChange }: PositionSettingProps) {
  const isCustomPosition = position.x !== -1 && position.y !== -1

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    if (value === 'custom') {
      // 保持当前位置
      return
    }
    // 使用 -1 表示预设位置，由 Main Process 计算实际坐标
    onChange({ x: -1, y: -1 })
  }

  const handleResetPosition = () => {
    onChange({ x: -1, y: -1 })
  }

  return (
    <div className="flex items-center justify-between py-3 border-b">
      <span className="text-gray-600">显示位置</span>
      <div className="flex items-center gap-2">
        <select
          className="px-3 py-1.5 border rounded bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={isCustomPosition ? 'custom' : 'bottom-right'}
          onChange={handlePresetChange}
        >
          {PRESET_POSITIONS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleResetPosition}
          className="px-3 py-1.5 text-sm bg-gray-100 rounded hover:bg-gray-200 transition-colors"
        >
          重置位置
        </button>
      </div>
    </div>
  )
}

export default PositionSetting
