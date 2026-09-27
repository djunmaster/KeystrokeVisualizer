import { useEffect, useRef } from 'react'

interface KeyItemProps {
  keys: string[]
  fadeOutDuration: number
  releasedAt: number | null
  count: number
  animate?: boolean
}

const modifierNames = new Set(['Ctrl', 'Alt', 'Opt', 'Shift', 'Win', 'Cmd'])

function KeyItem({ keys, fadeOutDuration, releasedAt, count, animate = true }: KeyItemProps) {
  const elementRef = useRef<HTMLDivElement>(null)
  const held = releasedAt === null

  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    element.style.opacity = '1'
    if (!animate || releasedAt === null) return

    const duration = Math.max(1, fadeOutDuration)
    const elapsed = Math.max(0, Date.now() - releasedAt)
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
  }, [animate, fadeOutDuration, releasedAt])

  return (
    <div
      ref={elementRef}
      data-held={held}
      className="kv-row flex max-w-full shrink-0 items-center gap-1 px-3 py-2 text-lg font-medium h-[54px] min-h-[54px]"
    >
      {keys.map((key, index) => (
        <span key={index} className="flex min-w-0 items-center">
          <span
            className="kv-key truncate px-2 py-1"
            data-key={key}
            data-role={modifierNames.has(key) ? 'modifier' : 'main'}
            data-held={held}
          >{key}</span>
          {index < keys.length - 1 && (
            <span className="kv-plus mx-1">+</span>
          )}
        </span>
      ))}
      {count > 1 && <span className="kv-count ml-1 shrink-0 text-sm">{'\u00D7'}{count}</span>}
    </div>
  )
}

export default KeyItem
