import { useEffect, useState } from 'react'

interface KeyItemProps {
  keys: string[]
  fadeOutDuration: number
  timestamp: number
}

function KeyItem({ keys, fadeOutDuration, timestamp }: KeyItemProps) {
  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    const startTime = timestamp
    const animate = () => {
      const elapsed = Date.now() - startTime
      const newOpacity = Math.max(0, 1 - elapsed / fadeOutDuration)
      setOpacity(newOpacity)

      if (newOpacity > 0) {
        requestAnimationFrame(animate)
      }
    }

    const animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [fadeOutDuration, timestamp])

  return (
    <div
      className="flex items-center gap-1 px-3 py-2 bg-black/80 rounded-lg text-white text-lg font-medium shadow-lg backdrop-blur-sm"
      style={{ opacity }}
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
