import { useEffect, useMemo, useState } from 'react'
import { Alert, Card, Collapse, Empty, Input, List, Space, Spin, Tag, Typography } from 'antd'
import { HomeOutlined, SearchOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { getCategories, getQuestion, getQuestions, type Category, type Question } from '../../api'
import MarkdownRender from '../../components/MarkdownRender'

const { Title, Text, Paragraph } = Typography

export default function InterviewTips() {
  const [loading, setLoading] = useState(true)
  const [tips, setTips] = useState<Question[]>([])
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const categoriesRes = await getCategories()
        const categories = Array.isArray(categoriesRes.data) ? categoriesRes.data : (categoriesRes.data as any).results || []
        const target = categories.find((item: Category) => item.name === '面试那点事') || null
        if (!target) {
          if (!cancelled) {
            setCategory(null)
            setTips([])
            setError('未找到“面试那点事”分类，请先确认题库已导入。')
          }
          return
        }

        if (!cancelled) setCategory(target)

        const listRes = await getQuestions({ category: target.id })
        const list = Array.isArray(listRes.data) ? listRes.data : (listRes.data as any).results || []
        const detailResponses = await Promise.all(list.map((item: Question) => getQuestion(item.id)))
        const details = detailResponses.map(resp => resp.data as Question)
        details.sort((a, b) => a.id - b.id)

        if (!cancelled) setTips(details)
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.detail || err?.message || '加载失败')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const filteredTips = useMemo(() => {
    const trimmed = keyword.trim().toLowerCase()
    if (!trimmed) return tips
    return tips.filter(item => {
      const text = `${item.title} ${item.brief_answer || ''} ${item.detailed_answer || ''}`.toLowerCase()
      return text.includes(trimmed)
    })
  }, [tips, keyword])

  if (loading) {
    return <Spin size="large" style={{ display: 'block', marginTop: 100 }} />
  }

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Link to="/"><HomeOutlined /> 首页</Link>
        <Text type="secondary">/</Text>
        <Text>面试那点事</Text>
      </Space>

      <Title level={3} style={{ marginBottom: 8 }}>面试那点事</Title>
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        经验分享与非技术面试题整理，适合面试前快速复习表达思路与答题框架。
      </Paragraph>

      {category && (
        <Space style={{ marginBottom: 16 }} wrap>
          <Tag color="blue">分类：{category.name}</Tag>
          <Tag>{tips.length} 条</Tag>
        </Space>
      )}

      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="搜索标题或内容"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        style={{ marginBottom: 16, maxWidth: 420 }}
      />

      {error ? (
        <Alert type="warning" showIcon message={error} />
      ) : filteredTips.length === 0 ? (
        <Empty description="暂无匹配内容" />
      ) : (
        <List
          dataSource={filteredTips}
          renderItem={(item) => (
            <List.Item style={{ padding: 0, marginBottom: 12, border: 0 }}>
              <Card style={{ width: '100%' }} size="small">
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap>
                    <Text strong>{item.title}</Text>
                    {item.source_url ? (
                      <a href={item.source_url} target="_blank" rel="noreferrer">查看原文</a>
                    ) : (
                      <Text type="secondary">暂无链接</Text>
                    )}
                  </Space>
                  <Collapse
                    items={[
                      {
                        key: 'brief',
                        label: '核心话术',
                        children: <MarkdownRender content={item.brief_answer || '暂无'} />,
                      },
                      {
                        key: 'detail',
                        label: '经验详解',
                        children: <MarkdownRender content={item.detailed_answer || item.brief_answer || '暂无'} />,
                      },
                    ]}
                  />
                </Space>
              </Card>
            </List.Item>
          )}
        />
      )}
    </div>
  )
}
