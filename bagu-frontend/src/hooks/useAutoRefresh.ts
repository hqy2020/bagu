import { useEffect, useRef } from 'react'

interface AutoRefreshOptions {
  enabled?: boolean
  intervalMs?: number
}

export default function useAutoRefresh(
  refreshFn: () => void | Promise<void>,
  options: AutoRefreshOptions = {},
) {
  const { enabled = true, intervalMs = 3000 } = options
  const refreshRef = useRef(refreshFn)
  const runningRef = useRef(false)

  useEffect(() => {
    refreshRef.current = refreshFn
  }, [refreshFn])

  useEffect(() => {
    if (!enabled) return

    const runOnce = async () => {
      if (runningRef.current) return
      runningRef.current = true
      try {
        await refreshRef.current()
      } finally {
        runningRef.current = false
      }
    }

    const handleVisibleRefresh = () => {
      if (document.hidden) return
      void runOnce()
    }

    const timer = window.setInterval(() => {
      if (document.hidden) return
      void runOnce()
    }, intervalMs)

    window.addEventListener('focus', handleVisibleRefresh)
    document.addEventListener('visibilitychange', handleVisibleRefresh)

    // 初次进入页面立即拉取一次，保证显示尽快同步
    void runOnce()

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', handleVisibleRefresh)
      document.removeEventListener('visibilitychange', handleVisibleRefresh)
    }
  }, [enabled, intervalMs])
}
