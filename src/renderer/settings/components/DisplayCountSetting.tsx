interface DisplayCountSettingProps {
  maxDisplayCount: number
  onChange: (count: number) => void
}

function DisplayCountSetting({ maxDisplayCount, onChange }: DisplayCountSettingProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value) && value >= 1 && value <= 12) {
      onChange(value)
    }
  }

  return (
    <div className="flex items-center justify-between py-3 border-b">
      <div className="flex flex-col">
        <span className="text-gray-600">Max Display Blocks</span>
        <span className="text-xs text-gray-400">Number of keystrokes shown at once</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min="1"
          max="12"
          value={maxDisplayCount}
          onChange={handleChange}
          className="w-24 accent-blue-500"
        />
        <span className="w-6 text-center text-gray-700 font-medium">{maxDisplayCount}</span>
      </div>
    </div>
  )
}

export default DisplayCountSetting
