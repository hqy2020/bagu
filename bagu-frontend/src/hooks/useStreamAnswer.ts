import { useState, useRef, useCallback } from 'react'
import { fetchSSE } from '../api/stream'
import type { AnswerResult } from '../api'

export type StreamStatus = 'idle' | 'thinking' | 'streaming' | 'done' | 'error'

interface StreamState {
  status: StreamStatus
  thinkingText: string
  contentText: string
  result: AnswerResult | null
  error: string | null
}

export function useStreamAnswer() {
  const [state, setState] = useState<StreamState>({
    status: 'idle',
    thinkingText: '',
    contentText: '',
    result: null,
    error: null,
  })
  const abortRef = useRef<AbortController | null>(null)

  const submit = useCallback(async (params: {
    user_id: number
    question_id: number
    answer: string
    model_id?: number
  }) => {
    // 取消上一次请求
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState({
      status: 'thinking',
      thinkingText: '',
      contentText: '',
      result: null,
      error: null,
    })

    try {
      await fetchSSE('/api/answers/submit-stream/', params, {
        onThinking(content) {
          setState(prev => ({
            ...prev,
            status: 'thinking',
            thinkingText: prev.thinkingText + content,
          }))
        },
        onContent(content) {
          setState(prev => ({
            ...prev,
            status: 'streaming',
            contentText: prev.contentText + content,
          }))
        },
        onResult(data) {
          setState(prev => ({
            ...prev,
            status: 'done',
            result: data,
          }))
        },
        onError(detail) {
          setState(prev => ({
            ...prev,
            status: 'error',
            error: detail,
          }))
        },
        onDone() {
          setState(prev => {
            if (prev.status !== 'done' && prev.status !== 'error') {
              return { ...prev, status: 'done' }
            }
            return prev
          })
        },
      }, controller.signal)
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setState(prev => ({
        ...prev,
        status: 'error',
        error: err.message || 'AI 分析失败',
      }))
    }
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState({
      status: 'idle',
      thinkingText: '',
      contentText: '',
      result: null,
      error: null,
    })
  }, [])

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { ...state, submit, reset, abort }
}
