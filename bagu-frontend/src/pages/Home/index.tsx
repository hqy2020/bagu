import { useState, useEffect, useCallback } from 'react'
import { Card, Row, Col, Statistic, Typography, Spin, Select, Space, Button, Modal, List, Tag, Empty, message } from 'antd'
import {
  DatabaseOutlined, ThunderboltOutlined, MailOutlined, CheckCircleTwoTone,
  AppstoreOutlined, RocketOutlined, CloudServerOutlined, BookOutlined, TeamOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getCategories, getUsers, getQuestions, type Category, type BaguUser, type Question } from '../../api'
import { useUserStore } from '../../stores/userStore'
import useAutoRefresh from '../../hooks/useAutoRefresh'

const { Title, Text } = Typography

const ICON_MAP: Record<string, React.ReactNode> = {
  database: <DatabaseOutlined style={{ fontSize: 48 }} />,
  thunderbolt: <ThunderboltOutlined style={{ fontSize: 48 }} />,
  mail: <MailOutlined style={{ fontSize: 48 }} />,
  appstore: <AppstoreOutlined style={{ fontSize: 48 }} />,
  rocket: <RocketOutlined style={{ fontSize: 48 }} />,
  'cloud-server': <CloudServerOutlined style={{ fontSize: 48 }} />,
  book: <BookOutlined style={{ fontSize: 48 }} />,
}

const COLOR_MAP: Record<string, string> = {
  'Redis': '#cf1322',
  '并发编程': '#1677ff',
  '消息队列': '#722ed1',
  '框架八股': '#13c2c2',
  '缓存实战': '#fa8c16',
  '分布式': '#52c41a',
}

const QUICK_REVIEW_CATEGORIES = new Set(['Redis', '数据库', '消息队列', '并发编程', 'JVM', 'Spring', '微服务'])

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<BaguUser[]>([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailCategory, setDetailCategory] = useState<Category | null>(null)
  const [detailQuestions, setDetailQuestions] = useState<Question[]>([])
  const navigate = useNavigate()
  const { currentUser, setCurrentUser } = useUserStore()

  useEffect(() => {
    getUsers().then(res => {
      const data = Array.isArray(res.data) ? res.data : (res.data as any).results || []
      setUsers(data)
      if (!currentUser && data.length > 0) {
        setCurrentUser(data[0])
      }
    })
  }, [])

  const loadCategories = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const res = await getCategories(currentUser?.id ? { user_id: currentUser.id } : undefined)
      const data = Array.isArray(res.data) ? res.data : (res.data as any).results || []
      setCategories(data)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [currentUser?.id])

  useEffect(() => {
    void loadCategories(true)
  }, [loadCategories])

  const loadDetailQuestions = useCallback(async (category: Category) => {
    if (!currentUser) return
    const res = await getQuestions({ category: category.id, user_id: currentUser.id })
    const data = Array.isArray(res.data) ? res.data : (res.data as any).results || []
    setDetailQuestions(data)
  }, [currentUser])

  const handleOpenDetail = async (category: Category) => {
    if (!currentUser) {
      message.warning('请先选择用户')
      return
    }
    setDetailCategory(category)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      await loadDetailQuestions(category)
    } finally {
      setDetailLoading(false)
    }
  }

  const completedDetail = detailQuestions.filter(item => item.is_completed)
  const hiddenHomeCategories = new Set(['缓存', '面试那点事'])
  const displayCategories = categories.filter(cat => !hiddenHomeCategories.has(cat.name))

  useAutoRefresh(
    async () => {
      await loadCategories(false)
    },
    { enabled: Boolean(currentUser), intervalMs: 3000 },
  )

  useAutoRefresh(
    async () => {
      if (!detailOpen || !detailCategory) return
      await loadDetailQuestions(detailCategory)
    },
    { enabled: Boolean(currentUser && detailOpen && detailCategory), intervalMs: 3000 },
  )

  const handleCategoryClick = (cat: Category) => {
    if (cat.name === '面试那点事') {
      navigate('/interview-tips')
      return
    }
    navigate(`/category/${cat.id}`)
  }

  if (loading) return <Spin size="large" style={{ display: 'block', marginTop: 100 }} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 12 }}>
        <Title level={2} style={{ margin: 0 }}>
          八股备考系统
        </Title>
        <Space>
          <Text type="secondary"><TeamOutlined /> 练习用户</Text>
          <Select
            value={currentUser?.id}
            placeholder="选择用户"
            style={{ width: 180 }}
            options={users.map(u => ({ value: u.id, label: u.nickname || u.username }))}
            onChange={(userId) => {
              const selected = users.find(u => u.id === userId) || null
              setCurrentUser(selected)
            }}
          />
        </Space>
      </div>
      <Row gutter={[24, 24]}>
        {displayCategories.map(cat => (
          <Col xs={24} sm={12} md={8} key={cat.id}>
            <Card
              hoverable
              onClick={() => handleCategoryClick(cat)}
              style={{
                borderTop: `3px solid ${COLOR_MAP[cat.name] || '#1677ff'}`,
                padding: '8px 0',
                borderRadius: 14,
                boxShadow: '0 8px 24px rgba(16,24,40,0.06)',
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: 20, color: COLOR_MAP[cat.name] || '#1677ff' }}>
                {ICON_MAP[cat.icon] || ICON_MAP['book']}
              </div>
              <Statistic
                title={cat.name}
                value={cat.question_count}
                suffix="题"
                valueStyle={{ textAlign: 'center' }}
              />
              {currentUser && typeof cat.completed_count === 'number' && (
                <div style={{ marginTop: 8, color: '#52c41a', fontSize: 12, textAlign: 'center', lineHeight: 1.8 }}>
                  <div>已打卡 {cat.completed_count}/{cat.question_count}（{cat.completion_rate || 0}%）</div>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, height: 'auto' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenDetail(cat)
                    }}
                  >
                    查看打卡题目
                  </Button>
                </div>
              )}
              {cat.subcategories && cat.subcategories.length > 0 && (
                <div style={{ marginTop: 8, color: '#999', fontSize: 12, textAlign: 'center' }}>
                  {cat.subcategories.map(s => s.name).join(' · ')}
                </div>
              )}
              {QUICK_REVIEW_CATEGORIES.has(cat.name) && (
                <div style={{ marginTop: 10, textAlign: 'center' }}>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, height: 'auto' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/review/${cat.id}`)
                    }}
                  >
                    复盘小抄
                  </Button>
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      <Modal
        open={detailOpen}
        title={detailCategory ? `${detailCategory.name} · ${currentUser?.nickname || currentUser?.username} 打卡明细` : '打卡明细'}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={760}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <Spin />
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <Tag color="green">已打卡 {completedDetail.length}</Tag>
              <Tag>总题数 {detailQuestions.length}</Tag>
            </div>
            {detailQuestions.length === 0 ? (
              <Empty description="该分类暂无题目" />
            ) : (
              <List
                dataSource={detailQuestions}
                renderItem={(item) => (
                  <List.Item>
                    <Space>
                      {item.is_completed
                        ? <CheckCircleTwoTone twoToneColor="#52c41a" />
                        : <span style={{ width: 14, display: 'inline-block' }} />
                      }
                      <Text>{item.title}</Text>
                      {item.is_completed ? <Tag color="green">已打卡</Tag> : <Tag>未打卡</Tag>}
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
