import { useState, useRef } from 'react'
import { Input, Button, Typography, Spin } from 'antd'
import { SendOutlined, LoadingOutlined } from '@ant-design/icons'
import { fetchSSE } from '../../api/stream'
import type { FollowUpItem } from '../../api'
import MarkdownRender from '../../components/MarkdownRender'

const { Text } = Typography
const { TextArea } = Input

interface Props {
  recordId: number
  modelId?: number
  compact?: boolean
}

export default function FollowUpBox({ recordId, modelId, compact }: Props) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [history, setHistory] = useState<FollowUpItem[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const handleAsk = async () => {
    if (!question.trim() || loading) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setStreamText('')
    const currentQuestion = question.trim()
    setQuestion('')

    try {
      await fetchSSE(
        '/api/answers/follow-up/',
        { record_id: recordId, question: currentQuestion, model_id: modelId },
        {
          onThinking(content) {
            setStreamText(prev => prev + content)
          },
          onContent(content) {
            setStreamText(prev => prev + content)
          },
          onFollowUpResult(data) {
            setHistory(prev => [...prev, data])
            setStreamText('')
          },
          onError(detail) {
            setStreamText(`错误: ${detail}`)
          },
          onDone() {
            setLoading(false)
          },
        },
        controller.signal,
      )
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setStreamText(`连接失败: ${err.message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const fontSize = compact ? 12 : 14

  return (
    <div style={{ marginTop: compact ? 8 : 12, borderTop: '1px dashed #e8e8e8', paddingTop: 8 }}>
      <Text strong style={{ fontSize, display: 'block', marginBottom: 4 }}>追问</Text>

      {/* 历史追问 */}
      {history.map((fu, idx) => (
        <div key={fu.id || idx} style={{ marginBottom: 8 }}>
          <div style={{ background: '#e6f7ff', padding: '4px 8px', borderRadius: 4, fontSize: fontSize - 1, marginBottom: 2 }}>
            <Text strong style={{ fontSize: fontSize - 1 }}>问：</Text>{fu.user_question}
          </div>
          <div style={{ background: '#f6f8fa', padding: '6px 8px', borderRadius: 4, fontSize: fontSize - 1 }}>
            <MarkdownRender content={fu.ai_response} />
          </div>
        </div>
      ))}

      {/* 流式回答 */}
      {streamText && (
        <div style={{ background: '#f6f8fa', padding: '6px 8px', borderRadius: 4, marginBottom: 8, fontSize: fontSize - 1 }}>
          {loading && <Spin indicator={<LoadingOutlined spin />} size="small" style={{ marginRight: 4 }} />}
          <MarkdownRender content={streamText} />
        </div>
      )}

      {/* 输入框 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <TextArea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="就这道题向 AI 追问..."
          autoSize={{ minRows: 1, maxRows: 3 }}
          style={{ fontSize: fontSize - 1 }}
          disabled={loading}
          onPressEnter={e => {
            if (!e.shiftKey) {
              e.preventDefault()
              handleAsk()
            }
          }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleAsk}
          loading={loading}
          size={compact ? 'small' : 'middle'}
        />
      </div>
    </div>
  )
}
