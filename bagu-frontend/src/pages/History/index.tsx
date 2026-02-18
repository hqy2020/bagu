import { useState, useEffect } from 'react'
import { Table, Tag, Typography, Spin, Empty } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../../stores/userStore'
import { getAnswerHistory, type AnswerResult } from '../../api'

const { Title } = Typography

export default function History() {
  const { currentUser } = useUserStore()
  const [records, setRecords] = useState<AnswerResult[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!currentUser) {
      setLoading(false)
      return
    }
    getAnswerHistory(currentUser.id)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data as any).results || []
        setRecords(data)
      })
      .finally(() => setLoading(false))
  }, [currentUser])

  if (loading) return <Spin size="large" style={{ display: 'block', marginTop: 100 }} />
  if (!currentUser) return <Empty description="请先选择用户" />

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
      <Title level={3}>答题历史</Title>
      <Table
        dataSource={records}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 15 }}
      />
    </div>
  )
}
