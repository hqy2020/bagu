import { Card, Collapse } from 'antd'
import type { AnswerResult, AiModel, BaguUser } from '../../api'
import type { StreamStatus } from '../../hooks/useStreamAnswer'
import type { SlotData } from './AnswerSlot'
import ResultCell from './ResultCell'
import StreamingCell from './StreamingCell'
import MarkdownRender from '../../components/MarkdownRender'

interface CellState {
  status: StreamStatus
  thinkingText: string
  contentText: string
  result: AnswerResult | null
  error: string | null
}

interface Props {
  slots: SlotData[]
  models: AiModel[]
  cellStates: Record<string, CellState>
  users: BaguUser[]
  question: { brief_answer?: string; detailed_answer?: string }
}

function getCellKey(slotId: string, modelId: number) {
  return `${slotId}-${modelId}`
}

export default function ComparisonGrid({ slots, models, cellStates, users, question }: Props) {
  const isSingle = slots.length === 1 && models.length === 1
  const singleKey = isSingle ? getCellKey(slots[0].id, models[0].id) : ''
  const singleCell = isSingle ? cellStates[singleKey] : null

  // 1×1 退化 - 使用与原来一致的大卡片布局
  if (isSingle && singleCell) {
    const isStreaming = singleCell.status === 'thinking' || singleCell.status === 'streaming'
    const hasResult = singleCell.status === 'done' && singleCell.result !== null

    return (
      <>
        {isStreaming && (
          <Card style={{ marginBottom: 16 }}>
            <StreamingCell
              status={singleCell.status}
              thinkingText={singleCell.thinkingText}
              contentText={singleCell.contentText}
              error={singleCell.error}
            />
          </Card>
        )}

        {hasResult && singleCell.result && (
          <>
            <Card style={{ marginBottom: 16 }}>
              <ResultCell result={singleCell.result} />
            </Card>

            {singleCell.result.ai_improved_answer && (
              <Collapse
                items={[{
                  key: '1',
                  label: 'AI 改进版答案',
                  children: <MarkdownRender content={singleCell.result.ai_improved_answer} />,
                }]}
                style={{ marginBottom: 16 }}
              />
            )}

            <Collapse
              items={[{
                key: '1',
                label: '参考答案（回答话术）',
                children: <MarkdownRender content={question.brief_answer || '暂无'} />,
              }, {
                key: '2',
                label: '详细解析',
                children: <MarkdownRender content={question.detailed_answer || '暂无'} />,
              }]}
              style={{ marginBottom: 16 }}
            />
          </>
        )}

        {singleCell.status === 'error' && (
          <Card style={{ marginBottom: 16 }}>
            <StreamingCell
              status={singleCell.status}
              thinkingText={singleCell.thinkingText}
              contentText={singleCell.contentText}
              error={singleCell.error}
            />
          </Card>
        )}
      </>
    )
  }

  // 多模型/多用户 - 表格对比布局
  const getUserName = (userId: number | null) => {
    if (!userId) return '未选择'
    const user = users.find(u => u.id === userId)
    return user ? (user.nickname || user.username) : `用户${userId}`
  }

  return (
    <>
      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: 8, border: '1px solid #e8e8e8', background: '#fafafa', minWidth: 80 }}>
                用户 \ 模型
              </th>
              {models.map(model => (
                <th key={model.id} style={{ padding: 8, border: '1px solid #e8e8e8', background: '#fafafa', minWidth: 200 }}>
                  {model.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map(slot => (
              <tr key={slot.id}>
                <td style={{ padding: 8, border: '1px solid #e8e8e8', background: '#fafafa', fontWeight: 600 }}>
                  {getUserName(slot.userId)}
                </td>
                {models.map(model => {
                  const key = getCellKey(slot.id, model.id)
                  const cell = cellStates[key]
                  if (!cell) return <td key={model.id} style={{ padding: 8, border: '1px solid #e8e8e8' }}>-</td>

                  const isStreaming = cell.status === 'thinking' || cell.status === 'streaming'
                  const hasResult = cell.status === 'done' && cell.result !== null

                  return (
                    <td key={model.id} style={{ padding: 0, border: '1px solid #e8e8e8', verticalAlign: 'top' }}>
                      {isStreaming && (
                        <StreamingCell
                          status={cell.status}
                          thinkingText={cell.thinkingText}
                          contentText={cell.contentText}
                          error={cell.error}
                          compact
                        />
                      )}
                      {hasResult && cell.result && <ResultCell result={cell.result} compact />}
                      {cell.status === 'error' && (
                        <StreamingCell
                          status={cell.status}
                          thinkingText=""
                          contentText=""
                          error={cell.error}
                          compact
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 参考答案 */}
      <Collapse
        items={[{
          key: '1',
          label: '参考答案（回答话术）',
          children: <MarkdownRender content={question.brief_answer || '暂无'} />,
        }, {
          key: '2',
          label: '详细解析',
          children: <MarkdownRender content={question.detailed_answer || '暂无'} />,
        }]}
        style={{ marginBottom: 16 }}
      />
    </>
  )
}
