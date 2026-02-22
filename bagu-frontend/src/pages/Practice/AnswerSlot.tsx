import { useState, useEffect } from 'react'
import { Select, Input, Button, Space, Collapse, Tag, Typography } from 'antd'
import { DeleteOutlined, HistoryOutlined } from '@ant-design/icons'
import type { BaguUser, AnswerRecordListItem } from '../../api'
import { getQuestionHistory } from '../../api'

const { TextArea } = Input
const { Text } = Typography

export interface SlotData {
  id: string
  userId: number | null
  answer: string
}

interface Props {
  slot: SlotData
  users: BaguUser[]
  disabled: boolean
  removable: boolean
  questionId?: number
  onChange: (slot: SlotData) => void
  onRemove: () => void
}

export default function AnswerSlot({ slot, users, disabled, removable, questionId, onChange, onRemove }: Props) {
  const [history, setHistory] = useState<AnswerRecordListItem[]>([])

  // 用户变化时加载历史
  useEffect(() => {
    if (!slot.userId || !questionId) {
      setHistory([])
      return
    }
    getQuestionHistory(slot.userId, questionId)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data as any)?.results || []
        setHistory(data.slice(0, 3))
      })
      .catch(() => setHistory([]))
  }, [slot.userId, questionId])

  return (
    <div style={{ marginBottom: 12 }}>
      <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
        <Select
          value={slot.userId}
          onChange={userId => onChange({ ...slot, userId })}
          placeholder="选择用户"
          style={{ width: 200 }}
          disabled={disabled}
          options={users.map(u => ({ label: u.nickname || u.username, value: u.id }))}
        />
        {removable && (
          <Button
            type="text"
            icon={<DeleteOutlined />}
            onClick={onRemove}
            disabled={disabled}
            danger
            size="small"
          />
        )}
      </Space>

      {/* 历史回答 */}
      {history.length > 0 && !disabled && (
        <Collapse
          size="small"
          style={{ marginBottom: 8 }}
          items={[{
            key: 'history',
            label: (
              <Space>
                <HistoryOutlined />
                <Text style={{ fontSize: 12 }}>历史回答 ({history.length})</Text>
              </Space>
            ),
            children: (
              <div>
                {history.map(record => (
                  <div
                    key={record.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 0',
                      borderBottom: '1px solid #f0f0f0',
                    }}
                  >
                    <Space size={4}>
                      <Tag color={record.ai_score >= 80 ? 'green' : record.ai_score >= 60 ? 'orange' : 'red'}>
                        {record.ai_score}分
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {record.ai_model_name}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {new Date(record.created_at).toLocaleDateString()}
                      </Text>
                    </Space>
                  </div>
                ))}
              </div>
            ),
          }]}
        />
      )}

      <TextArea
        rows={6}
        value={slot.answer}
        onChange={e => onChange({ ...slot, answer: e.target.value })}
        placeholder="请用你自己的话回答这个面试题..."
        disabled={disabled}
      />
    </div>
  )
}
