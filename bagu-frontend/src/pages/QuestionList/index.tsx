import { useState, useEffect } from 'react'
import { List, Tag, Button, Typography, Spin, Breadcrumb, Space, Select } from 'antd'
import { PlayCircleOutlined, HomeOutlined } from '@ant-design/icons'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getQuestions, getCategory, type Question, type Category } from '../../api'

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

  useEffect(() => {
    if (!categoryId) return
    setLoading(true)
    Promise.all([
      getCategory(Number(categoryId)),
      getQuestions({ category: Number(categoryId) }),
    ]).then(([catRes, qRes]) => {
      setCategory(catRes.data)
      const qData = Array.isArray(qRes.data) ? qRes.data : (qRes.data as any).results || []
      setQuestions(qData)
    }).finally(() => setLoading(false))
  }, [categoryId])

  const filtered = subFilter ? questions.filter(q => q.sub_category === subFilter) : questions

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
            ]}
          >
            <List.Item.Meta
              title={
                <Space>
                  <Text>{q.title}</Text>
                  <Tag color={DIFFICULTY_COLORS[q.difficulty]}>
                    {DIFFICULTY_LABELS[q.difficulty]}
                  </Tag>
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
