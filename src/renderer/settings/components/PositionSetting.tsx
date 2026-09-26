import { useEffect, useRef, useState } from 'react'
import { Position } from '../../shared/types'

interface PositionSettingProps {
  position: Position
  onChange: (position: Position) => void
}

const PRESET_POSITIONS = [
  { label: 'Bottom Right', value: 'bottom-right' },
  { label: 'Top Right', value: 'top-right' },
  { label: 'Bottom Left', value: 'bottom-left' },
  { label: 'Top Left', value: 'top-left' },
  { label: 'Bottom Center', value: 'bottom-center' },
  { label: 'Top Center', value: 'top-center' },
]
type PresetValue = (typeof PRESET_POSITIONS)[number]['value'] | 'custom'
interface PositionElectronAPI {
  getPresetPosition: (preset: string) => Promise<Position>
  getPresetName: (position: Position) => Promise<string>
}

// Window size constants (must match WindowManager)
const WINDOW_WIDTH = 400
const WINDOW_HEIGHT = 400
const MARGIN = 20
const TOLERANCE = 50

// Get preset position from main process (uses Electron screen API)
async function getPresetPositionFromMain(preset: string): Promise<Position> {
  const api = (window as unknown as { electronAPI?: PositionElectronAPI }).electronAPI
  if (api?.getPresetPosition) {
    return api.getPresetPosition(preset)
  }
  // Fallback for development without electron
  return calculatePresetPositionFallback(preset)
}

async function getPresetNameFromMain(position: Position): Promise<PresetValue> {
  const api = (window as unknown as { electronAPI?: PositionElectronAPI }).electronAPI
  if (api?.getPresetName) {
    const preset = await api.getPresetName(position)
    if (preset === 'custom') return preset
    const knownPreset = PRESET_POSITIONS.find((p) => p.value === preset)
    if (knownPreset) {
      if (position.x === -1 && position.y === -1) return knownPreset.value
      const coordinates = await api.getPresetPosition(knownPreset.value)
      return Math.abs(position.x - coordinates.x) < TOLERANCE &&
        Math.abs(position.y - coordinates.y) < TOLERANCE
        ? knownPreset.value
        : 'custom'
    }
  }
  return detectCurrentPresetFallback(position)
}

// Fallback calculation (only used if main process unavailable)
function calculatePresetPositionFallback(preset: string): Position {
  const screenWidth = window.screen.availWidth
  const screenHeight = window.screen.availHeight

  switch (preset) {
    case 'bottom-right':
      return { x: screenWidth - WINDOW_WIDTH - MARGIN, y: screenHeight - WINDOW_HEIGHT - MARGIN }
    case 'top-right':
      return { x: screenWidth - WINDOW_WIDTH - MARGIN, y: MARGIN }
    case 'bottom-left':
      return { x: MARGIN, y: screenHeight - WINDOW_HEIGHT - MARGIN }
    case 'top-left':
      return { x: MARGIN, y: MARGIN }
    case 'bottom-center':
      return { x: (screenWidth - WINDOW_WIDTH) / 2, y: screenHeight - WINDOW_HEIGHT - MARGIN }
    case 'top-center':
      return { x: (screenWidth - WINDOW_WIDTH) / 2, y: MARGIN }
    default:
      return { x: screenWidth - WINDOW_WIDTH - MARGIN, y: screenHeight - WINDOW_HEIGHT - MARGIN }
  }
}

function detectCurrentPresetFallback(position: Position): PresetValue {
  // Default position indicator
  if (position.x === -1 && position.y === -1) {
    return 'bottom-right'
  }

  // Use fallback calculation for detection (sync operation)
  // This is acceptable because we're comparing against current position
  const screenWidth = window.screen.availWidth
  const screenHeight = window.screen.availHeight

  const presets = [
    { value: 'bottom-right', x: screenWidth - WINDOW_WIDTH - MARGIN, y: screenHeight - WINDOW_HEIGHT - MARGIN },
    { value: 'top-right', x: screenWidth - WINDOW_WIDTH - MARGIN, y: MARGIN },
    { value: 'bottom-left', x: MARGIN, y: screenHeight - WINDOW_HEIGHT - MARGIN },
    { value: 'top-left', x: MARGIN, y: MARGIN },
    { value: 'bottom-center', x: (screenWidth - WINDOW_WIDTH) / 2, y: screenHeight - WINDOW_HEIGHT - MARGIN },
    { value: 'top-center', x: (screenWidth - WINDOW_WIDTH) / 2, y: MARGIN },
  ]

  for (const preset of presets) {
    if (Math.abs(position.x - preset.x) < TOLERANCE && Math.abs(position.y - preset.y) < TOLERANCE) {
      return preset.value
    }
  }

  return 'custom'
}

function PositionSetting({ position, onChange }: PositionSettingProps) {
  const [currentPreset, setCurrentPreset] = useState<PresetValue>('bottom-right')
  const requestId = useRef(0)
  const { x, y } = position

  useEffect(() => {
    const currentRequest = ++requestId.current
    let isActive = true
    getPresetNameFromMain({ x, y }).then((preset) => {
      if (isActive && requestId.current === currentRequest) {
        setCurrentPreset(preset)
      }
    }).catch((error) => {
      console.error('Failed to detect preset position:', error)
    })
    return () => {
      isActive = false
    }
  }, [x, y])

  const handlePresetChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as PresetValue
    const currentRequest = ++requestId.current
    const previousPreset = currentPreset
    setCurrentPreset(value)
    try {
      const newPosition = await getPresetPositionFromMain(value)
      if (requestId.current === currentRequest) onChange(newPosition)
    } catch (error) {
      console.error('Failed to get preset position:', error)
      if (requestId.current === currentRequest) {
        setCurrentPreset(previousPreset)
      }
    }
  }

  const handleResetPosition = async () => {
    const currentRequest = ++requestId.current
    const previousPreset = currentPreset
    setCurrentPreset('bottom-right')
    try {
      const defaultPosition = await getPresetPositionFromMain('bottom-right')
      if (requestId.current === currentRequest) onChange(defaultPosition)
    } catch (error) {
      console.error('Failed to reset position:', error)
      if (requestId.current === currentRequest) {
        setCurrentPreset(previousPreset)
      }
    }
  }

  return (
    <div className="flex items-center justify-between py-3 border-b">
      <span className="text-gray-600">Display Position</span>
      <div className="flex items-center gap-2">
        <select
          className="px-3 py-1.5 border rounded bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={currentPreset}
          onChange={handlePresetChange}
        >
          {PRESET_POSITIONS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
          <option value="custom" disabled>Custom</option>
        </select>
        <button
          onClick={handleResetPosition}
          className="px-3 py-1.5 text-sm bg-gray-100 rounded hover:bg-gray-200 transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  )
}

export default PositionSetting
