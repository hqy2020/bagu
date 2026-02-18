import { Tag, Typography, Progress } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, BulbOutlined, DollarOutlined } from '@ant-design/icons'
import type { AnswerResult } from '../../api'
import MarkdownRender from '../../components/MarkdownRender'

const { Text } = Typography

interface Props {
  result: AnswerResult
  compact?: boolean
}

function UsageBadge({ result, compact }: { result: AnswerResult; compact?: boolean }) {
  if (!result.usage) return null

  const { prompt_tokens, completion_tokens, total_tokens, cost } = result.usage
  const fontSize = compact ? 11 : 12

  return (
    <div style={{
      marginTop: compact ? 8 : 12,
      padding: compact ? '4px 8px' : '8px 12px',
      background: '#f0f5ff',
      borderRadius: 6,
      fontSize,
      color: '#666',
    }}>
      <DollarOutlined style={{ marginRight: 4, color: '#1890ff' }} />
      <Text type="secondary" style={{ fontSize }}>
        Token: {prompt_tokens.toLocaleString()} 入 + {completion_tokens.toLocaleString()} 出 = {total_tokens.toLocaleString()}
      </Text>
      <Text style={{ marginLeft: 8, fontSize, color: '#fa8c16', fontWeight: 600 }}>
        ¥{cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)}
      </Text>
    </div>
  )
}

export default function ResultCell({ result, compact }: Props) {
  const scoreColor = result.ai_score >= 80 ? '#52c41a' : result.ai_score >= 60 ? '#faad14' : '#ff4d4f'

  if (compact) {
    return (
      <div style={{ padding: 12 }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <Progress
            type="circle"
            percent={result.ai_score}
            strokeColor={scoreColor}
            size={60}
            format={p => <span style={{ fontSize: 16 }}>{p}</span>}
          />
          <div style={{ marginTop: 4 }}>
            <Tag color={scoreColor} style={{ fontSize: 12 }}>
              {result.ai_score >= 90 ? '优秀' : result.ai_score >= 70 ? '良好' : result.ai_score >= 50 ? '及格' : '需加强'}
            </Tag>
          </div>
        </div>

        {result.ai_highlights.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <Text strong style={{ fontSize: 12 }}><CheckCircleOutlined style={{ color: '#52c41a' }} /> 亮点</Text>
            <ul style={{ marginTop: 4, paddingLeft: 16, fontSize: 12 }}>
              {result.ai_highlights.map((h, i) => (
                <li key={i} style={{ color: '#52c41a' }}><MarkdownRender content={h} inline /></li>
              ))}
            </ul>
          </div>
        )}

        {result.ai_missing_points.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <Text strong style={{ fontSize: 12 }}><CloseCircleOutlined style={{ color: '#ff4d4f' }} /> 遗漏</Text>
            <ul style={{ marginTop: 4, paddingLeft: 16, fontSize: 12 }}>
              {result.ai_missing_points.map((m, i) => (
                <li key={i} style={{ color: '#ff4d4f' }}><MarkdownRender content={m} inline /></li>
              ))}
            </ul>
          </div>
        )}

        {result.ai_suggestion && (
          <div>
            <Text strong style={{ fontSize: 12 }}><BulbOutlined style={{ color: '#faad14' }} /> 建议</Text>
            <div style={{ marginTop: 4, padding: 8, background: '#fffbe6', borderRadius: 6, fontSize: 12 }}>
              <MarkdownRender content={result.ai_suggestion} />
            </div>
          </div>
        )}

        <UsageBadge result={result} compact />
      </div>
    )
  }

  // 完整模式（1×1 退化时使用）
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Progress
          type="circle"
          percent={result.ai_score}
          strokeColor={scoreColor}
          format={p => <span style={{ fontSize: 28 }}>{p}</span>}
        />
        <div style={{ marginTop: 8 }}>
          <Tag color={scoreColor} style={{ fontSize: 14, padding: '4px 12px' }}>
            {result.ai_score >= 90 ? '优秀' : result.ai_score >= 70 ? '良好' : result.ai_score >= 50 ? '及格' : '需加强'}
          </Tag>
          <Text type="secondary" style={{ marginLeft: 8 }}>by {result.ai_model_name}</Text>
        </div>
      </div>

      {result.ai_highlights.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong><CheckCircleOutlined style={{ color: '#52c41a' }} /> 答对的要点</Text>
          <ul style={{ marginTop: 8 }}>
            {result.ai_highlights.map((h, i) => (
              <li key={i} style={{ color: '#52c41a' }}><MarkdownRender content={h} inline /></li>
            ))}
          </ul>
        </div>
      )}

      {result.ai_missing_points.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong><CloseCircleOutlined style={{ color: '#ff4d4f' }} /> 遗漏的要点</Text>
          <ul style={{ marginTop: 8 }}>
            {result.ai_missing_points.map((m, i) => (
              <li key={i} style={{ color: '#ff4d4f' }}><MarkdownRender content={m} inline /></li>
            ))}
          </ul>
        </div>
      )}

      {result.ai_suggestion && (
        <div style={{ marginBottom: 16 }}>
          <Text strong><BulbOutlined style={{ color: '#faad14' }} /> 改进建议</Text>
          <div style={{ marginTop: 8, padding: '12px', background: '#fffbe6', borderRadius: 8 }}>
            <MarkdownRender content={result.ai_suggestion} />
          </div>
        </div>
      )}

      <UsageBadge result={result} />
    </div>
  )
}
