import { useEffect, useState } from 'react'

/** Keep a panel mounted briefly so CSS can play open/close slide. */
export function useFlyout(open: boolean, durationMs = 180) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(open)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const frame = window.requestAnimationFrame(() => {
        setVisible(true)
      })
      return () => window.cancelAnimationFrame(frame)
    }

    setVisible(false)
    const timer = window.setTimeout(() => setMounted(false), durationMs)
    return () => window.clearTimeout(timer)
  }, [open, durationMs])

  return { mounted, visible }
}
