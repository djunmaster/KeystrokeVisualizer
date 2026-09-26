interface AnimationSettingProps {
  fadeOutDuration: number
  onChange: (duration: number) => void
  label: string
}

function AnimationSetting({ fadeOutDuration, onChange, label }: AnimationSettingProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value))
  }

  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-500 text-sm">{fadeOutDuration}ms</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400">200ms</span>
        <input
          type="range"
          min="200"
          max="3000"
          step="100"
          value={fadeOutDuration}
          onChange={handleChange}
          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <span className="text-xs text-gray-400">3000ms</span>
      </div>
    </div>
  )
}

export default AnimationSetting
