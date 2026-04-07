import { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Typography, Spin, Empty, Select, Space } from 'antd'
import { useNavigate } from 'react-router-dom'
import { getAnswerHistory, getUsers, type AnswerResult, type BaguUser } from '../../api'
import useAutoRefresh from '../../hooks/useAutoRefresh'

const { Title, Text, Paragraph } = Typography

export default function History() {
  const [users, setUsers] = useState<BaguUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [records, setRecords] = useState<AnswerResult[]>([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const loadUsers = useCallback(async () => {
    const res = await getUsers()
    const data = Array.isArray(res.data) ? res.data : (res.data as any).results || []
    setUsers(data)
    if (!selectedUserId && data.length > 0) {
      setSelectedUserId(data[0].id)
    }
  }, [selectedUserId])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const loadHistory = useCallback(async (showLoading = false) => {
    if (!selectedUserId) return
    if (showLoading) setLoading(true)
    try {
      const res = await getAnswerHistory(selectedUserId)
      const data = Array.isArray(res.data) ? res.data : (res.data as any).results || []
      setRecords(data)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [selectedUserId])

  useEffect(() => {
    if (!selectedUserId) return
    void loadHistory(true)
  }, [selectedUserId, loadHistory])

  useAutoRefresh(
    async () => {
      await Promise.all([loadUsers(), loadHistory(false)])
    },
    { enabled: Boolean(selectedUserId), intervalMs: 3000 },
  )

  const columns = [
    {
      title: '题目',
      dataIndex: 'question_title',
      key: 'title',
      render: (text: string, record: AnswerResult) => (
        <a onClick={() => navigate(`/practice/${record.question}`)}>{text}</a>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category_name',
      key: 'category',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '评分',
      dataIndex: 'ai_score',
      key: 'score',
      render: (score: number) => {
        const color = score >= 80 ? 'green' : score >= 60 ? 'orange' : 'red'
        return <Tag color={color}>{score}分</Tag>
      },
      sorter: (a: AnswerResult, b: AnswerResult) => a.ai_score - b.ai_score,
    },
    {
      title: 'AI 模型',
      dataIndex: 'ai_model_name',
      key: 'model',
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'time',
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>答题历史</Title>
        <Space>
          <span>选择用户：</span>
          <Select
            value={selectedUserId}
            onChange={setSelectedUserId}
            options={users.map(u => ({ value: u.id, label: u.nickname || u.username }))}
            placeholder="选择用户"
            style={{ width: 160 }}
          />
        </Space>
      </div>
      {!selectedUserId ? (
        <Empty description="请选择用户查看历史记录" />
      ) : loading ? (
        <Spin size="large" style={{ display: 'block', marginTop: 100 }} />
      ) : (
        <Table
          dataSource={records}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 15 }}
          expandable={{
            rowExpandable: (record) =>
              !!record.ai_suggestion || (record.ai_highlights?.length ?? 0) > 0,
            expandedRowRender: (record) => (
              <div style={{ padding: '8px 16px' }}>
                {record.user_answer && (
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>我的答案</Text>
                    <Paragraph
                      ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
                      style={{ marginTop: 4, marginBottom: 0, color: '#555' }}
                    >
                      {record.user_answer}
                    </Paragraph>
                  </div>
                )}
                {(record.ai_highlights?.length ?? 0) > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <Text strong style={{ color: '#389e0d' }}>亮点</Text>
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {record.ai_highlights!.map((h, i) => (
                        <Tag key={i} color="green">{h}</Tag>
                      ))}
                    </div>
                  </div>
                )}
                {(record.ai_missing_points?.length ?? 0) > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <Text strong style={{ color: '#d46b08' }}>遗漏要点</Text>
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {record.ai_missing_points!.map((p, i) => (
                        <Tag key={i} color="orange">{p}</Tag>
                      ))}
                    </div>
                  </div>
                )}
                {record.ai_suggestion && (
                  <div style={{ marginBottom: record.ai_improved_answer ? 10 : 0 }}>
                    <Text strong>AI 建议</Text>
                    <Paragraph style={{ marginTop: 4, marginBottom: 0 }}>{record.ai_suggestion}</Paragraph>
                  </div>
                )}
                {record.ai_improved_answer && (
                  <div>
                    <Text strong>AI 改进版答案</Text>
                    <pre style={{
                      marginTop: 4,
                      padding: '8px 12px',
                      background: '#f6ffed',
                      border: '1px solid #b7eb8f',
                      borderRadius: 4,
                      whiteSpace: 'pre-wrap',
                      fontSize: 13,
                    }}>
                      {record.ai_improved_answer}
                    </pre>
                  </div>
                )}
              </div>
            ),
          }}
        />
      )}
    </div>
  )
}
