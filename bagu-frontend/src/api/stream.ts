/**
 * SSE 流式消费 - 用 fetch + ReadableStream 实现 POST SSE
 */

export interface SSECallbacks {
  onThinking?: (content: string) => void
  onContent?: (content: string) => void
  onResult?: (data: any) => void
  onError?: (detail: string) => void
  onDone?: () => void
}

export async function fetchSSE(
  url: string,
  body: Record<string, any>,
  callbacks: SSECallbacks,
  signal?: AbortSignal,
) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: '请求失败' }))
    throw new Error(err.detail || `HTTP ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('浏览器不支持流式读取')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // 按 \n\n 分割 SSE 事件
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''

    for (const part of parts) {
      if (!part.trim()) continue

      let eventType = 'message'
      let data = ''

      for (const line of part.split('\n')) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7)
        } else if (line.startsWith('data: ')) {
          data = line.slice(6)
        }
      }

      if (!data) continue

      try {
        const parsed = JSON.parse(data)
        switch (eventType) {
          case 'thinking':
            callbacks.onThinking?.(parsed.content)
            break
          case 'content':
            callbacks.onContent?.(parsed.content)
            break
          case 'result':
            callbacks.onResult?.(parsed)
            break
          case 'error':
            callbacks.onError?.(parsed.detail)
            break
          case 'done':
            callbacks.onDone?.()
            break
        }
      } catch {
        // 忽略解析失败的事件
      }
    }
  }
}
