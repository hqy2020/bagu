import { Spin, Typography, Collapse, Space } from 'antd'
import { LoadingOutlined } from '@ant-design/icons'
import type { StreamStatus } from '../../hooks/useStreamAnswer'
import MarkdownRender from '../../components/MarkdownRender'

const { Text } = Typography

interface Props {
  status: StreamStatus
  thinkingText: string
  contentText: string
  error: string | null
  compact?: boolean
}

export default function StreamingCell({ status, thinkingText, contentText, error, compact }: Props) {
  if (status === 'error') {
    return (
      <div style={{ padding: compact ? 8 : 16, color: '#ff4d4f' }}>
        <Text type="danger">{error || '分析失败'}</Text>
      </div>
    )
  }

  if (status === 'idle') return null

  const fontSize = compact ? 12 : 14

  return (
    <div style={{ padding: compact ? 8 : 16 }}>
      {thinkingText && (
        <Collapse
          defaultActiveKey={compact ? [] : ['thinking']}
          size={compact ? 'small' : 'middle'}
          items={[{
            key: 'thinking',
            label: (
              <Space>
                <LoadingOutlined spin />
                <Text type="secondary" style={{ fontSize }}>思考中...</Text>
              </Space>
            ),
            children: (
              <div
                className={`thinking-box ${status === 'thinking' ? 'streaming-cursor' : ''}`}
                style={{ fontSize: fontSize - 1, maxHeight: compact ? 120 : 200 }}
              >
                {thinkingText}
              </div>
            ),
          }]}
          style={{ marginBottom: 8 }}
        />
      )}

      {contentText && (
        <div>
          <Text strong style={{ fontSize, marginBottom: 4, display: 'block' }}>
            <LoadingOutlined spin style={{ marginRight: 4 }} />
            生成中...
          </Text>
          <div
            className="streaming-cursor"
            style={{ padding: compact ? 8 : 12, background: '#fafafa', borderRadius: 6, fontSize }}
          >
            <MarkdownRender content={contentText} />
          </div>
        </div>
      )}

      {!thinkingText && !contentText && (
        <div style={{ textAlign: 'center', padding: compact ? 12 : 24 }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: compact ? 16 : 24 }} spin />} />
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize }}>连接中...</Text>
          </div>
        </div>
      )}
    </div>
  )
}
