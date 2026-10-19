import { useEffect, useState } from 'react'

export function useCountUp(target: number, durationMs: number = 800): number {
  const [count, setCount] = useState<number>(target)

  useEffect(() => {
    let startTimestamp: number | null = null
    const startVal = count
    const diff = target - startVal

    if (diff === 0) return

    let animationFrameId: number

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / durationMs, 1)
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(startVal + diff * easeProgress))

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step)
      }
    }

    animationFrameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animationFrameId)
  }, [target, durationMs])

  return count
}
