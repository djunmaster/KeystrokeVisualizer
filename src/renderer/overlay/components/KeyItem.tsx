import { useEffect, useRef } from 'react'

interface KeyItemProps {
  keys: string[]
  fadeOutDuration: number
  timestamp: number
}

function KeyItem({ keys, fadeOutDuration, timestamp }: KeyItemProps) {
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const duration = Math.max(1, fadeOutDuration)
    const elapsed = Math.max(0, Date.now() - timestamp)
    const remaining = Math.max(0, duration - elapsed)
    if (remaining === 0) {
      element.style.opacity = '0'
      return
    }

    element.style.opacity = ''
    const animation = element.animate(
      [{ opacity: Math.max(0, 1 - elapsed / duration) }, { opacity: 0 }],
      { duration: remaining, fill: 'forwards' }
    )
    return () => animation.cancel()
  }, [fadeOutDuration, timestamp])

  return (
    <div
      ref={elementRef}
      className="flex items-center gap-1 px-3 py-2 bg-black/80 rounded-lg text-white text-lg font-medium shadow-lg backdrop-blur-sm h-[54px] min-h-[54px]"
    >
      {keys.map((key, index) => (
        <span key={index} className="flex items-center">
          <span className="px-2 py-1 bg-white/20 rounded">{key}</span>
          {index < keys.length - 1 && (
            <span className="mx-1 text-white/60">+</span>
          )}
        </span>
      ))}
    </div>
  )
}

export default KeyItem
