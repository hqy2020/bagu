import { useEffect, useMemo, useState } from 'react'
import { Alert, Breadcrumb, Button, Checkbox, Collapse, Empty, Input, Space, Spin, Tag, Typography, message } from 'antd'
import { HomeOutlined, SearchOutlined } from '@ant-design/icons'
import { Link, useParams } from 'react-router-dom'
import { getCategory, getCategoryQuickReview, type Category, type QuickReviewNode, type QuickReviewPreset } from '../../api'
import { useUserStore } from '../../stores/userStore'

const { Title, Text } = Typography

const STORAGE_KEY = 'bagu-quick-review-progress-v1'

function loadProgress(userId: number, categoryId: number): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, Record<string, Record<string, boolean>>>
    return parsed[String(userId)]?.[String(categoryId)] || {}
  } catch {
    return {}
  }
}

function saveProgress(userId: number, categoryId: number, progress: Record<string, boolean>) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, Record<string, Record<string, boolean>>>) : {}
    parsed[String(userId)] = parsed[String(userId)] || {}
    parsed[String(userId)][String(categoryId)] = progress
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    // ignore storage failures
  }
}

export default function QuickReview() {
  const { categoryId } = useParams()
  const { currentUser } = useUserStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<Category | null>(null)
  const [preset, setPreset] = useState<QuickReviewPreset | null>(null)
  const [keyword, setKeyword] = useState('')
  const [progress, setProgress] = useState<Record<string, boolean>>({})

  const categoryIdNum = categoryId ? Number(categoryId) : null
  const userId = currentUser?.id ?? 0

  useEffect(() => {
    if (!categoryIdNum) return
    setProgress(loadProgress(userId, categoryIdNum))
  }, [userId, categoryIdNum])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!categoryIdNum) return
      setLoading(true)
      setError(null)
      setPreset(null)
      try {
        const catRes = await getCategory(categoryIdNum)
        if (!cancelled) setCategory(catRes.data)
      } catch {
        if (!cancelled) setCategory(null)
      }

      try {
        const res = await getCategoryQuickReview(categoryIdNum)
        if (cancelled) return
        setPreset(res.data)
      } catch (err: unknown) {
        if (!cancelled) {
          const maybeAxiosError = err as { response?: { data?: { detail?: string } }; message?: string }
          setError(maybeAxiosError.response?.data?.detail || maybeAxiosError.message || '加载失败')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [categoryIdNum])

  const nodes: QuickReviewNode[] = useMemo(() => preset?.nodes || [], [preset])

  const filteredNodes = useMemo(() => {
    const trimmed = keyword.trim().toLowerCase()
    if (!trimmed) return nodes
    return nodes.filter(node => {
      const haystack = [node.title, ...(node.points || [])].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(trimmed)
    })
  }, [nodes, keyword])

  const masteredCount = useMemo(() => {
    if (!nodes.length) return 0
    return nodes.filter(n => progress[n.key]).length
  }, [nodes, progress])

  const handleToggleNode = (nodeKey: string, checked: boolean) => {
    if (!currentUser) {
      message.warning('请先回首页选择用户')
      return
    }
    if (!categoryIdNum) return
    setProgress(prev => {
      const next = { ...prev, [nodeKey]: checked }
      saveProgress(userId, categoryIdNum, next)
      return next
    })
  }

  const handleMarkAll = (checked: boolean) => {
    if (!currentUser) {
      message.warning('请先回首页选择用户')
      return
    }
    if (!categoryIdNum) return
    const next: Record<string, boolean> = {}
    for (const node of nodes) next[node.key] = checked
    setProgress(next)
    saveProgress(userId, categoryIdNum, next)
  }

  if (loading) return <Spin size="large" style={{ display: 'block', marginTop: 100 }} />

  const titleName = category?.name || preset?.category_name || '快速复盘小抄'

  return (
    <div>
      <Breadcrumb items={[
        { title: <Link to="/"><HomeOutlined /> 首页</Link> },
        { title: category ? <Link to={`/category/${category.id}`}>{category.name}</Link> : '分类' },
        { title: '快速复盘小抄' },
      ]} style={{ marginBottom: 16 }} />

      <Space style={{ marginBottom: 8 }} wrap>
        <Title level={3} style={{ margin: 0 }}>{titleName}</Title>
        <Tag>{nodes.length} 个主线节点</Tag>
        {currentUser && nodes.length > 0 && <Tag color="green">已掌握 {masteredCount}/{nodes.length}</Tag>}
      </Space>

      {preset?.summary && (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">主线：{preset.summary}</Text>
        </div>
      )}

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="搜索：主线节点 / 核心记忆点"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ maxWidth: 520 }}
        />
        <Button onClick={() => handleMarkAll(true)} disabled={!currentUser || nodes.length === 0}>全标记掌握</Button>
        <Button onClick={() => handleMarkAll(false)} disabled={!currentUser || nodes.length === 0}>清空标记</Button>
      </Space>

      {error ? (
        <Alert type="warning" showIcon message={error} />
      ) : !preset ? (
        <Empty description="该模块暂未配置预设的复盘小抄" />
      ) : filteredNodes.length === 0 ? (
        <Empty description="暂无匹配内容" />
      ) : (
        <Collapse
          defaultActiveKey={filteredNodes.map(n => n.key)}
          items={filteredNodes.map((node, idx) => ({
            key: node.key,
            label: (
              <Space wrap>
                <Text strong>{idx + 1}. {node.title}</Text>
                {progress[node.key] && <Tag color="green">已掌握</Tag>}
              </Space>
            ),
            children: (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <Checkbox
                    checked={Boolean(progress[node.key])}
                    onChange={(e) => handleToggleNode(node.key, e.target.checked)}
                  >
                    我已掌握这个节点
                  </Checkbox>
                </div>
                {(node.points || []).length === 0 ? (
                  <Text type="secondary">暂无核心记忆点</Text>
                ) : (
                  (node.points || []).map((p, pIdx) => (
                    <div key={`${node.key}-p-${pIdx}`} style={{ color: '#666', lineHeight: 1.7 }}>
                      • {p}
                    </div>
                  ))
                )}
              </div>
            ),
          }))}
        />
      )}
    </div>
  )
}
