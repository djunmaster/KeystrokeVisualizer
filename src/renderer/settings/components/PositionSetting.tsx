import { useEffect, useRef, useState } from 'react'
import { ConfigState, DisplayInfo, KEYBOARD_PANEL_HEIGHT, KEYBOARD_PANEL_WIDTH, KeyboardPanelSize, Position, PositionPreview } from '../../shared/types'

interface PositionSettingProps {
  position: Position
  displayId: number | null
  maxDisplayCount: number
  displayMode: ConfigState['displayMode']
  keyboardScale: number
  keyboardSize?: KeyboardPanelSize
  onChange: (position: Position) => void
  onDisplayChange: (displayId: number) => void
  labels: {
    title: string
    display: string
    screen: string
    primary: string
    scale: string
    resolution: string
    displaysError: string
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
  getPresetPosition: (preset: string, displayId?: number) => Promise<Position>
  getPresetName: (position: Position, displayId?: number) => Promise<string>
  getPositionPreview?: (position: Position, maxDisplayCount: number, displayId?: number,
    displayMode?: ConfigState['displayMode'], keyboardScale?: number, keyboardSize?: KeyboardPanelSize) => Promise<PositionPreview>
  getDisplays?: () => Promise<DisplayInfo[]>
  onDisplaysChanged?: (callback: (displays: DisplayInfo[]) => void) => () => void
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
async function getPresetPositionFromMain(preset: string, displayId?: number): Promise<Position> {
  const api = (window as unknown as { electronAPI?: PositionElectronAPI }).electronAPI
  if (api?.getPresetPosition) {
    return api.getPresetPosition(preset, displayId)
  }
  // Fallback for development without electron
  return calculatePresetPositionFallback(preset)
}

async function getPresetNameFromMain(position: Position, displayId?: number): Promise<PresetValue> {
  const api = (window as unknown as { electronAPI?: PositionElectronAPI }).electronAPI
  if (api?.getPresetName) {
    const preset = await api.getPresetName(position, displayId)
    if (preset === 'custom') return preset
    const knownPreset = PRESET_POSITIONS.find((p) => p.value === preset)
    if (knownPreset) {
      if (position.x === -1 && position.y === -1) return knownPreset.value
      const coordinates = await api.getPresetPosition(knownPreset.value, displayId)
      return Math.abs(position.x - coordinates.x) < TOLERANCE &&
        Math.abs(position.y - coordinates.y) < TOLERANCE
        ? knownPreset.value
        : 'custom'
    }
  }
  return detectCurrentPresetFallback(position)
}

async function getPositionPreviewFromMain(position: Position, maxDisplayCount: number, displayId: number | undefined,
  displayMode: ConfigState['displayMode'], keyboardScale: number, keyboardSize: KeyboardPanelSize): Promise<PositionPreview> {
  const api = (window as unknown as { electronAPI?: PositionElectronAPI }).electronAPI
  if (api?.getPositionPreview) return api.getPositionPreview(position, maxDisplayCount, displayId, displayMode, keyboardScale, keyboardSize)

  const workArea = { x: 0, y: 0, width: window.screen.availWidth, height: window.screen.availHeight }
  const scale = Math.min(keyboardScale / 100, workArea.width / keyboardSize.width, workArea.height / keyboardSize.height)
  const overlaySize = displayMode === 'keyboard' ? { width: Math.round(keyboardSize.width * scale), height: Math.round(keyboardSize.height * scale) } : {
    width: Math.min(WINDOW_WIDTH, workArea.width), height: Math.min(32 + maxDisplayCount * 54 + (maxDisplayCount - 1) * 8, workArea.height),
  }
  return {
    displayId: 0,
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

function PositionSetting({ position, displayId, maxDisplayCount, displayMode, keyboardScale,
  keyboardSize = { width: KEYBOARD_PANEL_WIDTH, height: KEYBOARD_PANEL_HEIGHT }, onChange, onDisplayChange, labels }: PositionSettingProps) {
  const [currentPreset, setCurrentPreset] = useState<PresetValue>('bottom-right')
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [displaysError, setDisplaysError] = useState(false)
  const [preview, setPreview] = useState<PositionPreview | null>(null)
  const [previewDisplayMode, setPreviewDisplayMode] = useState<ConfigState['displayMode'] | null>(null)
  const [previewKeyboardScale, setPreviewKeyboardScale] = useState<number | null>(null)
  const [previewKeyboardSize, setPreviewKeyboardSize] = useState<KeyboardPanelSize | null>(null)
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
  const panelWidth = keyboardSize.width
  const panelHeight = keyboardSize.height
  const previewMatchesDisplay = preview && (displayId === null || preview.displayId === displayId) &&
    previewDisplayMode === displayMode && previewKeyboardScale === keyboardScale &&
    previewKeyboardSize?.width === keyboardSize.width && previewKeyboardSize?.height === keyboardSize.height
  const selectedDisplay = displays.find((display) => display.id === (displayId ?? preview?.displayId))
  const resolvedPosition = position.x === -1 && position.y === -1 ? preview?.position : position
  const visiblePosition = draftPosition ?? resolvedPosition
  const visibleX = visiblePosition?.x
  const visibleY = visiblePosition?.y

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: PositionElectronAPI }).electronAPI
    if (!api?.getDisplays) return
    let active = true
    let receivedChange = false
    const unsubscribe = api.onDisplaysChanged?.((nextDisplays) => {
      receivedChange = true
      setDisplays(nextDisplays)
      setDisplaysError(false)
    })
    api.getDisplays().then((nextDisplays) => {
      if (active && !receivedChange) setDisplays(nextDisplays)
    }).catch((error) => {
      console.error('Failed to load displays:', error)
      if (active && !receivedChange) setDisplaysError(true)
    })
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    const currentRequest = ++requestId.current
    let isActive = true
    getPresetNameFromMain({ x, y }, displayId ?? undefined).then((preset) => {
      if (isActive && requestId.current === currentRequest) {
        setCurrentPreset(preset)
      }
    }).catch((error) => {
      console.error('Failed to detect preset position:', error)
    })
    return () => {
      isActive = false
    }
  }, [x, y, displayId, maxDisplayCount, displayMode, keyboardScale, keyboardSize.width, keyboardSize.height, displays])

  useEffect(() => {
    const currentRequest = ++previewRequestId.current
    let active = true
    const size = { width: panelWidth, height: panelHeight }
    getPositionPreviewFromMain({ x, y }, maxDisplayCount, displayId ?? undefined, displayMode, keyboardScale, size).then((nextPreview) => {
      if (active && previewRequestId.current === currentRequest) {
        setPreview(nextPreview)
        setPreviewDisplayMode(displayMode)
        setPreviewKeyboardScale(keyboardScale)
        setPreviewKeyboardSize(size)
      }
    }).catch((error) => {
      console.error('Failed to load position preview:', error)
    })
    return () => { active = false }
  }, [x, y, maxDisplayCount, displayMode, keyboardScale, panelWidth, panelHeight, displayId, displays])

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
      const newPosition = await getPresetPositionFromMain(value, displayId ?? undefined)
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
      const defaultPosition = await getPresetPositionFromMain('bottom-right', displayId ?? undefined)
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
      <label className="mb-3 flex flex-wrap items-center justify-between gap-2 text-gray-600">
        <span>{labels.display}</span>
        <select
          value={selectedDisplay?.id ?? ''}
          disabled={displays.length === 0}
          onChange={(event) => {
            requestId.current++
            previewRequestId.current++
            setDraftPosition(null)
            setPreview(null)
            onDisplayChange(Number(event.target.value))
          }}
          className="min-w-0 w-full rounded border bg-white px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {displays.length === 0 && <option value="">{labels.screen}</option>}
          {displays.map((display, index) => (
            <option key={display.id} value={display.id}>
              {index + 1}. {display.label || labels.screen} {display.isPrimary ? `(${labels.primary})` : ''}
            </option>
          ))}
        </select>
      </label>
      {selectedDisplay && (
        <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs text-gray-500">
          <span>{labels.resolution} {selectedDisplay.bounds.width} × {selectedDisplay.bounds.height}</span>
          <span>{labels.scale} {Math.round(selectedDisplay.scaleFactor * 100)}%</span>
        </div>
      )}
      {displaysError && <p role="alert" className="mb-3 text-sm text-red-700">{labels.displaysError}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-gray-600">{labels.title}</span>
        <div className="flex items-center gap-2">
          <select
            className="px-3 py-1.5 border rounded bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={currentPreset}
            disabled={!previewMatchesDisplay}
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
            disabled={!previewMatchesDisplay}
            className="px-3 py-1.5 text-sm bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            {labels.reset}
          </button>
        </div>
      </div>
      {previewMatchesDisplay && preview && visiblePosition && (
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
              {displayMode === 'keyboard' ? (
                <span className="grid h-full grid-cols-3 gap-0.5">
                  {Array.from({ length: 9 }, (_, index) => <span key={index} className="rounded-sm bg-white/60" />)}
                </span>
              ) : (
                <>
                  <span className="h-1 w-2/3 rounded-sm bg-white/75" />
                  <span className="h-1 w-1/2 rounded-sm bg-white/50" />
                </>
              )}
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
