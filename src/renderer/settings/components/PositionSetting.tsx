import { useEffect, useRef, useState } from 'react'
import { Position, PositionPreview } from '../../shared/types'

interface PositionSettingProps {
  position: Position
  maxDisplayCount: number
  onChange: (position: Position) => void
  labels: {
    title: string
    reset: string
    custom: string
    preview: string
    previewControl: string
    presets: Record<Exclude<PresetValue, 'custom'>, string>
  }
}

const PRESET_POSITIONS = [
  { value: 'bottom-right' },
  { value: 'top-right' },
  { value: 'bottom-left' },
  { value: 'top-left' },
  { value: 'bottom-center' },
  { value: 'top-center' },
] as const
type PresetValue = (typeof PRESET_POSITIONS)[number]['value'] | 'custom'
interface PositionElectronAPI {
  getPresetPosition: (preset: string) => Promise<Position>
  getPresetName: (position: Position) => Promise<string>
  getPositionPreview?: (position: Position, maxDisplayCount: number) => Promise<PositionPreview>
}

// Window size constants (must match WindowManager)
const WINDOW_WIDTH = 400
const WINDOW_HEIGHT = 400
const MARGIN = 20
const TOLERANCE = 50
const PREVIEW_MAX_WIDTH = 400
const PREVIEW_MAX_HEIGHT = 180
const LIVE_POSITION_INTERVAL_MS = 100

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

async function getPositionPreviewFromMain(position: Position, maxDisplayCount: number): Promise<PositionPreview> {
  const api = (window as unknown as { electronAPI?: PositionElectronAPI }).electronAPI
  if (api?.getPositionPreview) return api.getPositionPreview(position, maxDisplayCount)

  const workArea = { x: 0, y: 0, width: window.screen.availWidth, height: window.screen.availHeight }
  const overlaySize = {
    width: WINDOW_WIDTH,
    height: 32 + maxDisplayCount * 54 + (maxDisplayCount - 1) * 8,
  }
  return {
    workArea,
    overlaySize,
    position: position.x === -1 && position.y === -1
      ? { x: workArea.width - overlaySize.width - MARGIN, y: workArea.height - overlaySize.height - MARGIN }
      : position,
  }
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
  ] as const

  for (const preset of presets) {
    if (Math.abs(position.x - preset.x) < TOLERANCE && Math.abs(position.y - preset.y) < TOLERANCE) {
      return preset.value
    }
  }

  return 'custom'
}

function PositionSetting({ position, maxDisplayCount, onChange, labels }: PositionSettingProps) {
  const [currentPreset, setCurrentPreset] = useState<PresetValue>('bottom-right')
  const [preview, setPreview] = useState<PositionPreview | null>(null)
  const [draftPosition, setDraftPosition] = useState<Position | null>(null)
  const [xInput, setXInput] = useState('')
  const [yInput, setYInput] = useState('')
  const requestId = useRef(0)
  const previewRequestId = useRef(0)
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const lastDraftPosition = useRef<Position | null>(null)
  const lastLiveUpdate = useRef(0)
  const editingAxis = useRef<'x' | 'y' | null>(null)
  const { x, y } = position
  const resolvedPosition = position.x === -1 && position.y === -1 ? preview?.position : position
  const visiblePosition = draftPosition ?? resolvedPosition
  const visibleX = visiblePosition?.x
  const visibleY = visiblePosition?.y

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

  useEffect(() => {
    const currentRequest = ++previewRequestId.current
    getPositionPreviewFromMain({ x, y }, maxDisplayCount).then((nextPreview) => {
      if (previewRequestId.current === currentRequest) setPreview(nextPreview)
    }).catch((error) => {
      console.error('Failed to load position preview:', error)
    })
  }, [x, y, maxDisplayCount])

  useEffect(() => {
    if (visibleX === undefined || visibleY === undefined) return
    if (editingAxis.current !== 'x') setXInput(String(visibleX))
    if (editingAxis.current !== 'y') setYInput(String(visibleY))
  }, [visibleX, visibleY])

  const updateFromPointer = (event: React.PointerEvent<HTMLButtonElement>, forceSave = false) => {
    if (!preview) return
    const rect = event.currentTarget.getBoundingClientRect()
    const { workArea, overlaySize } = preview
    const x = Math.round(workArea.x + (event.clientX - rect.left - dragOffset.current.x) / rect.width * workArea.width)
    const y = Math.round(workArea.y + (event.clientY - rect.top - dragOffset.current.y) / rect.height * workArea.height)
    const nextPosition = {
      x: Math.max(workArea.x, Math.min(x, workArea.x + Math.max(0, workArea.width - overlaySize.width))),
      y: Math.max(workArea.y, Math.min(y, workArea.y + Math.max(0, workArea.height - overlaySize.height))),
    }
    setDraftPosition(nextPosition)
    lastDraftPosition.current = nextPosition
    const now = Date.now()
    if (forceSave || now - lastLiveUpdate.current >= LIVE_POSITION_INTERVAL_MS) {
      lastLiveUpdate.current = now
      onChange(nextPosition)
    }
  }

  const finishDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging.current) return
    updateFromPointer(event, true)
    dragging.current = false
    setDraftPosition(null)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const changeCoordinate = (axis: 'x' | 'y', value: string) => {
    if (axis === 'x') setXInput(value)
    else setYInput(value)
    if (!visiblePosition || !/^-?\d+$/.test(value)) return
    const number = Number(value)
    if (Number.isSafeInteger(number)) setDraftPosition({ ...visiblePosition, [axis]: number })
  }

  const commitCoordinate = (axis: 'x' | 'y', value: string) => {
    editingAxis.current = null
    const number = Number(value)
    if (visiblePosition && /^-?\d+$/.test(value) && Number.isSafeInteger(number)) {
      onChange({ ...visiblePosition, [axis]: number })
    } else if (resolvedPosition) {
      setXInput(String(resolvedPosition.x))
      setYInput(String(resolvedPosition.y))
    }
    setDraftPosition(null)
  }

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
    <div className="border-b py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-gray-600">{labels.title}</span>
        <div className="flex items-center gap-2">
          <select
            className="px-3 py-1.5 border rounded bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={currentPreset}
            onChange={handlePresetChange}
          >
            {PRESET_POSITIONS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {labels.presets[preset.value]}
              </option>
            ))}
            <option value="custom" disabled>{labels.custom}</option>
          </select>
          <button
            onClick={handleResetPosition}
            className="px-3 py-1.5 text-sm bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            {labels.reset}
          </button>
        </div>
      </div>
      {preview && visiblePosition && (
        <>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>{labels.preview}</span>
            <span>{preview.workArea.width} × {preview.workArea.height}</span>
          </div>
          <button
            type="button"
            aria-label={labels.previewControl}
            className="relative mx-auto mt-2 block w-full overflow-hidden rounded border-2 border-gray-300 bg-gray-100 cursor-crosshair touch-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{
              maxWidth: Math.min(PREVIEW_MAX_WIDTH, PREVIEW_MAX_HEIGHT * preview.workArea.width / preview.workArea.height),
              aspectRatio: `${preview.workArea.width} / ${preview.workArea.height}`,
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return
              const rect = event.currentTarget.getBoundingClientRect()
              const markerLeft = rect.left + (visiblePosition.x - preview.workArea.x) / preview.workArea.width * rect.width
              const markerTop = rect.top + (visiblePosition.y - preview.workArea.y) / preview.workArea.height * rect.height
              const markerWidth = preview.overlaySize.width / preview.workArea.width * rect.width
              const markerHeight = preview.overlaySize.height / preview.workArea.height * rect.height
              const insideMarker = event.clientX >= markerLeft && event.clientX <= markerLeft + markerWidth &&
                event.clientY >= markerTop && event.clientY <= markerTop + markerHeight
              dragOffset.current = insideMarker
                ? { x: event.clientX - markerLeft, y: event.clientY - markerTop }
                : { x: markerWidth / 2, y: markerHeight / 2 }
              dragging.current = true
              event.currentTarget.setPointerCapture(event.pointerId)
              updateFromPointer(event, true)
            }}
            onPointerMove={(event) => {
              if (dragging.current) updateFromPointer(event)
            }}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            onLostPointerCapture={() => {
              if (!dragging.current) return
              dragging.current = false
              if (lastDraftPosition.current) onChange(lastDraftPosition.current)
              setDraftPosition(null)
            }}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 1 : 10
              const delta = {
                ArrowLeft: { x: -step, y: 0 },
                ArrowRight: { x: step, y: 0 },
                ArrowUp: { x: 0, y: -step },
                ArrowDown: { x: 0, y: step },
              }[event.key]
              if (!delta) return
              event.preventDefault()
              onChange({ x: visiblePosition.x + delta.x, y: visiblePosition.y + delta.y })
            }}
          >
            <span
              aria-hidden="true"
              className="absolute flex flex-col justify-end gap-1 overflow-hidden rounded border-2 border-blue-500 bg-gray-900/80 p-1 shadow-sm"
              style={{
                left: `${(visiblePosition.x - preview.workArea.x) / preview.workArea.width * 100}%`,
                top: `${(visiblePosition.y - preview.workArea.y) / preview.workArea.height * 100}%`,
                width: `${preview.overlaySize.width / preview.workArea.width * 100}%`,
                height: `${preview.overlaySize.height / preview.workArea.height * 100}%`,
              }}
            >
              <span className="h-1 w-2/3 rounded-sm bg-white/75" />
              <span className="h-1 w-1/2 rounded-sm bg-white/50" />
            </span>
          </button>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {(['x', 'y'] as const).map((axis) => (
              <label key={axis} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-4 uppercase">{axis}</span>
                <input
                  type="number"
                  step="1"
                  value={axis === 'x' ? xInput : yInput}
                  onFocus={() => { editingAxis.current = axis }}
                  onChange={(event) => changeCoordinate(axis, event.target.value)}
                  onBlur={(event) => commitCoordinate(axis, event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
                  className="w-full min-w-0 rounded border px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default PositionSetting
