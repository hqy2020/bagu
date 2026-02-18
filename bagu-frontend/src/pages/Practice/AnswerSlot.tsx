import { Select, Input, Button, Space } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import type { BaguUser } from '../../api'

const { TextArea } = Input

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
  onChange: (slot: SlotData) => void
  onRemove: () => void
}

export default function AnswerSlot({ slot, users, disabled, removable, onChange, onRemove }: Props) {
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
