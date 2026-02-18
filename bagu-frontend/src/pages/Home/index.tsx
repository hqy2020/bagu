import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Typography, Spin } from 'antd'
import {
  DatabaseOutlined, ThunderboltOutlined, MailOutlined,
  AppstoreOutlined, RocketOutlined, CloudServerOutlined, BookOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getCategories, type Category } from '../../api'

const { Title } = Typography

const ICON_MAP: Record<string, React.ReactNode> = {
  database: <DatabaseOutlined style={{ fontSize: 36 }} />,
  thunderbolt: <ThunderboltOutlined style={{ fontSize: 36 }} />,
  mail: <MailOutlined style={{ fontSize: 36 }} />,
  appstore: <AppstoreOutlined style={{ fontSize: 36 }} />,
  rocket: <RocketOutlined style={{ fontSize: 36 }} />,
  'cloud-server': <CloudServerOutlined style={{ fontSize: 36 }} />,
  book: <BookOutlined style={{ fontSize: 36 }} />,
}

const COLOR_MAP: Record<string, string> = {
  'Redis': '#cf1322',
  '并发编程': '#1677ff',
  '消息队列': '#722ed1',
  '框架八股': '#13c2c2',
  '缓存实战': '#fa8c16',
  '分布式': '#52c41a',
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getCategories().then(res => {
      const data = Array.isArray(res.data) ? res.data : (res.data as any).results || []
      setCategories(data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spin size="large" style={{ display: 'block', marginTop: 100 }} />

  return (
    <div>
      <Title level={2} style={{ textAlign: 'center', marginBottom: 32 }}>
        八股备考系统
      </Title>
      <Row gutter={[24, 24]}>
        {categories.map(cat => (
          <Col xs={24} sm={12} md={8} key={cat.id}>
            <Card
              hoverable
              onClick={() => navigate(`/category/${cat.id}`)}
              style={{ borderTop: `3px solid ${COLOR_MAP[cat.name] || '#1677ff'}` }}
            >
              <div style={{ textAlign: 'center', marginBottom: 16, color: COLOR_MAP[cat.name] || '#1677ff' }}>
                {ICON_MAP[cat.icon] || ICON_MAP['book']}
              </div>
              <Statistic
                title={cat.name}
                value={cat.question_count}
                suffix="题"
                valueStyle={{ textAlign: 'center' }}
              />
              {cat.subcategories && cat.subcategories.length > 0 && (
                <div style={{ marginTop: 8, color: '#999', fontSize: 12, textAlign: 'center' }}>
                  {cat.subcategories.map(s => s.name).join(' · ')}
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
