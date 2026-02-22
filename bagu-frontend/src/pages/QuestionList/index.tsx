import { useState, useEffect, useCallback } from 'react'
import { List, Tag, Button, Typography, Spin, Breadcrumb, Space, Select, message } from 'antd'
import { PlayCircleOutlined, HomeOutlined, CheckCircleTwoTone } from '@ant-design/icons'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getQuestions, getCategory, setQuestionCompletion, type Question, type Category } from '../../api'
import { useUserStore } from '../../stores/userStore'
import useAutoRefresh from '../../hooks/useAutoRefresh'

const { Title, Text } = Typography

const DIFFICULTY_COLORS = ['', 'green', 'blue', 'orange', 'red', 'purple']
const DIFFICULTY_LABELS = ['', '入门', '基础', '中等', '进阶', '困难']

export default function QuestionList() {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const [questions, setQuestions] = useState<Question[]>([])
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)
  const [subFilter, setSubFilter] = useState<number | undefined>(undefined)
  const { currentUser } = useUserStore()

  const loadCategoryQuestions = useCallback(async (showLoading = false) => {
    if (!categoryId) return
    if (showLoading) setLoading(true)
    try {
      const [catRes, qRes] = await Promise.all([
        getCategory(Number(categoryId)),
        getQuestions({ category: Number(categoryId), user_id: currentUser?.id }),
      ])
      setCategory(catRes.data)
      const qData = Array.isArray(qRes.data) ? qRes.data : (qRes.data as any).results || []
      setQuestions(qData)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [categoryId, currentUser?.id])

  useEffect(() => {
    if (!categoryId) return
    void loadCategoryQuestions(true)
  }, [categoryId, loadCategoryQuestions])

  useAutoRefresh(
    async () => {
      await loadCategoryQuestions(false)
    },
    { enabled: Boolean(categoryId && currentUser), intervalMs: 3000 },
  )

  const filtered = subFilter ? questions.filter(q => q.sub_category === subFilter) : questions
  const completedCount = filtered.filter(q => q.is_completed).length

  const handleToggleCompletion = async (q: Question) => {
    if (!currentUser) {
      message.warning('请先选择用户')
      return
    }

    try {
      await setQuestionCompletion(q.id, {
        user_id: currentUser.id,
        completed: !q.is_completed,
      })
      setQuestions(prev =>
        prev.map(item => item.id === q.id ? { ...item, is_completed: !item.is_completed } : item)
      )
    } catch {
      message.error('更新完成状态失败')
    }
  }

  if (loading) return <Spin size="large" style={{ display: 'block', marginTop: 100 }} />

  return (
    <div>
      <Breadcrumb items={[
        { title: <Link to="/"><HomeOutlined /> 首页</Link> },
        { title: category?.name || '加载中' },
      ]} style={{ marginBottom: 16 }} />

      <Space style={{ marginBottom: 16 }} wrap>
        <Title level={3} style={{ margin: 0 }}>{category?.name}</Title>
        <Tag>{filtered.length} 题</Tag>
        <Tag color="green">已完成 {completedCount}/{filtered.length}</Tag>
        {category?.subcategories && category.subcategories.length > 0 && (
          <Select
            allowClear
            placeholder="筛选子分类"
            style={{ width: 160 }}
            value={subFilter}
            onChange={setSubFilter}
            options={category.subcategories.map(s => ({ value: s.id, label: s.name }))}
          />
        )}
      </Space>

      <List
        dataSource={filtered}
        renderItem={(q) => (
          <List.Item
            actions={[
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => navigate(`/practice/${q.id}`)}
              >
                开始答题
              </Button>,
              <Button
                type={q.is_completed ? 'default' : 'dashed'}
                onClick={() => handleToggleCompletion(q)}
              >
                {q.is_completed ? '取消完成' : '标记完成'}
              </Button>,
            ]}
          >
            <List.Item.Meta
              title={
                <Space>
                  {q.is_completed && <CheckCircleTwoTone twoToneColor="#52c41a" />}
                  <Text>{q.title}</Text>
                  <Tag color={DIFFICULTY_COLORS[q.difficulty]}>
                    {DIFFICULTY_LABELS[q.difficulty]}
                  </Tag>
                  {q.is_completed && <Tag color="green">已完成</Tag>}
                </Space>
              }
              description={q.sub_category_name || ''}
            />
          </List.Item>
        )}
      />
    </div>
  )
}
