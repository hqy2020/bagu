import { useState, useEffect, useCallback } from 'react'
import { Card, Typography, Spin, Empty, Tag, List, Button, message, Select, Space, Progress, Statistic } from 'antd'
import { ThunderboltOutlined } from '@ant-design/icons'
import { getUsers, getUserProfile, generateUserProfile, type UserProfile as UserProfileType, type BaguUser } from '../../api'
import useAutoRefresh from '../../hooks/useAutoRefresh'

const { Title, Text } = Typography

const LEVEL_MAP: Record<string, { label: string; color: string }> = {
  beginner: { label: '入门', color: 'blue' },
  intermediate: { label: '熟练', color: 'green' },
  advanced: { label: '精通', color: 'gold' },
}

export default function Profile() {
  const [users, setUsers] = useState<BaguUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [profile, setProfile] = useState<UserProfileType | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [estimatedSeconds, setEstimatedSeconds] = useState(12)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const loadUsers = useCallback(async () => {
    const res = await getUsers()
    const data: BaguUser[] = Array.isArray(res.data) ? res.data : (res.data as any).results || []
    setUsers(data)
    if (data.length === 0) {
      setSelectedUserId(null)
      return
    }
    setSelectedUserId(prev => prev && data.some(user => user.id === prev) ? prev : data[0].id)
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const loadProfile = useCallback(async (showLoading = false) => {
    if (!selectedUserId) return
    if (showLoading) setLoading(true)
    try {
      const res = await getUserProfile(selectedUserId)
      setProfile(res.data)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [selectedUserId])

  useEffect(() => {
    if (!selectedUserId) return
    void loadProfile(true)
  }, [selectedUserId, loadProfile])

  useEffect(() => {
    if (!generating) return
    const startAt = Date.now()
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startAt) / 1000))
    }, 300)
    return () => clearInterval(timer)
  }, [generating])

  const selectedUser = users.find(u => u.id === selectedUserId)

  useAutoRefresh(
    async () => {
      if (generating) return
      await Promise.all([loadUsers(), loadProfile(false)])
    },
    { enabled: Boolean(selectedUserId), intervalMs: 3000 },
  )

  const handleGenerate = async () => {
    if (!selectedUserId) return
    const estimate = Math.min(30, Math.max(10, Math.round((selectedUser?.total_answers || 0) * 0.9 + 10)))
    setEstimatedSeconds(estimate)
    setElapsedSeconds(0)
    setGenerating(true)
    try {
      const res = await generateUserProfile(selectedUserId)
      setProfile(res.data)
      message.success('知识画像生成成功')
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.message || '生成失败'
      message.error(detail)
    } finally {
      setGenerating(false)
    }
  }

  const levelInfo = LEVEL_MAP[profile?.overall_level || 'beginner']
  const remainingSeconds = Math.max(0, estimatedSeconds - elapsedSeconds)
  const generatingPercent = Math.min(95, Math.round((elapsedSeconds / Math.max(estimatedSeconds, 1)) * 100))

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>用户画像</Title>
        <Space>
          <Select
            value={selectedUserId}
            onChange={setSelectedUserId}
            options={users.map(u => ({ value: u.id, label: u.nickname || u.username }))}
            placeholder="选择用户"
            style={{ width: 160 }}
          />
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleGenerate}
            loading={generating}
            disabled={!selectedUserId}
          >
            {generating ? 'AI 分析中...' : '一键生成画像'}
          </Button>
        </Space>
      </div>

      {generating && (
        <Card
          style={{
            marginBottom: 16,
            borderRadius: 12,
            background: 'linear-gradient(120deg, #f0f7ff 0%, #f6ffed 100%)',
            border: '1px solid #d6e4ff',
          }}
        >
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Text strong>AI 正在生成画像，请稍候...</Text>
            <Progress percent={generatingPercent} status="active" />
            <Text type="secondary">
              预计剩余约 {remainingSeconds} 秒（已耗时 {elapsedSeconds} 秒）
            </Text>
          </Space>
        </Card>
      )}

      {!selectedUserId ? (
        <Empty description="请选择用户查看画像" />
      ) : loading ? (
        <Spin size="large" style={{ display: 'block', marginTop: 100 }} />
      ) : (
        <>
          <Card style={{ marginBottom: 16, borderRadius: 12, boxShadow: '0 8px 20px rgba(15, 23, 42, 0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <Statistic title="用户" value={selectedUser?.nickname || selectedUser?.username || '-'} />
              <Statistic title="总答题数" value={selectedUser?.total_answers || 0} />
              <Statistic title="平均分" value={selectedUser?.avg_score || 0} precision={1} />
              <div>
                <Text type="secondary">综合水平</Text>
                <div style={{ marginTop: 8 }}>
                  <Tag color={levelInfo.color} style={{ fontSize: 14, padding: '4px 10px' }}>{levelInfo.label}</Tag>
                </div>
              </div>
            </div>
          </Card>

          {/* 分类评分 */}
          {profile?.category_scores && Object.keys(profile.category_scores).length > 0 && (
            <Card title="分类评分" style={{ marginBottom: 16, borderRadius: 12 }}>
              {Object.entries(profile.category_scores).map(([cat, score]) => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ width: 100 }}>{cat}</Text>
                  <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 4, height: 20, marginRight: 12 }}>
                    <div
                      style={{
                        width: `${score}%`,
                        background: score >= 80 ? '#52c41a' : score >= 60 ? '#faad14' : '#ff4d4f',
                        height: '100%',
                        borderRadius: 4,
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                  <Text strong>{score}分</Text>
                </div>
              ))}
            </Card>
          )}

          {/* 优势 & 薄弱 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <Card title="优势领域" size="small" style={{ borderRadius: 12 }}>
              {profile?.strengths && profile.strengths.length > 0 ? (
                profile.strengths.map((s, i) => <Tag key={i} color="green" style={{ marginBottom: 4 }}>{s}</Tag>)
              ) : (
                <Text type="secondary">点击"一键生成画像"生成</Text>
              )}
            </Card>
            <Card title="薄弱领域" size="small" style={{ borderRadius: 12 }}>
              {profile?.weaknesses && profile.weaknesses.length > 0 ? (
                profile.weaknesses.map((w, i) => <Tag key={i} color="red" style={{ marginBottom: 4 }}>{w}</Tag>)
              ) : (
                <Text type="secondary">点击"一键生成画像"生成</Text>
              )}
            </Card>
          </div>

          {/* 学习建议 */}
          {profile?.suggestions && profile.suggestions.length > 0 && (
            <Card title="学习建议" style={{ borderRadius: 12 }}>
              <List
                dataSource={profile.suggestions}
                renderItem={(item) => <List.Item>{item}</List.Item>}
              />
            </Card>
          )}
        </>
      )}
    </div>
  )
}
