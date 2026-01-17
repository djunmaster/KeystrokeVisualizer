interface StartupSettingProps {
  autoStart: boolean
  onChange: (autoStart: boolean) => void
}

function StartupSetting({ autoStart, onChange }: StartupSettingProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked)
  }

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-gray-600">开机自启动</span>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={autoStart}
          onChange={handleChange}
          className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500 cursor-pointer"
        />
        <span className="text-sm text-gray-500">启用</span>
      </label>
    </div>
  )
}

export default StartupSetting
