import { useState, useEffect } from 'react'
import { Card, Typography, Spin, Empty, Tag, Descriptions, List } from 'antd'
import { useUserStore } from '../../stores/userStore'
import { getUserProfile, type UserProfile as UserProfileType } from '../../api'

const { Title, Text } = Typography

const LEVEL_MAP: Record<string, { label: string; color: string }> = {
  beginner: { label: '入门', color: 'blue' },
  intermediate: { label: '熟练', color: 'green' },
  advanced: { label: '精通', color: 'gold' },
}

export default function Profile() {
  const { currentUser } = useUserStore()
  const [profile, setProfile] = useState<UserProfileType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) {
      setLoading(false)
      return
    }
    getUserProfile(currentUser.id)
      .then(res => setProfile(res.data))
      .finally(() => setLoading(false))
  }, [currentUser])

  if (loading) return <Spin size="large" style={{ display: 'block', marginTop: 100 }} />
  if (!currentUser) return <Empty description="请先选择用户" />

  const levelInfo = LEVEL_MAP[profile?.overall_level || 'beginner']

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}>{currentUser.nickname || currentUser.username} 的知识画像</Title>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={2}>
          <Descriptions.Item label="总答题数">{currentUser.total_answers}</Descriptions.Item>
          <Descriptions.Item label="平均分">{currentUser.avg_score}</Descriptions.Item>
          <Descriptions.Item label="综合水平">
            <Tag color={levelInfo.color}>{levelInfo.label}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 分类评分 */}
      {profile?.category_scores && Object.keys(profile.category_scores).length > 0 && (
        <Card title="分类评分" style={{ marginBottom: 16 }}>
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
        <Card title="优势领域" size="small">
          {profile?.strengths && profile.strengths.length > 0 ? (
            profile.strengths.map((s, i) => <Tag key={i} color="green" style={{ marginBottom: 4 }}>{s}</Tag>)
          ) : (
            <Text type="secondary">答题积累后自动生成</Text>
          )}
        </Card>
        <Card title="薄弱领域" size="small">
          {profile?.weaknesses && profile.weaknesses.length > 0 ? (
            profile.weaknesses.map((w, i) => <Tag key={i} color="red" style={{ marginBottom: 4 }}>{w}</Tag>)
          ) : (
            <Text type="secondary">答题积累后自动生成</Text>
          )}
        </Card>
      </div>

      {/* 学习建议 */}
      {profile?.suggestions && profile.suggestions.length > 0 && (
        <Card title="学习建议">
          <List
            dataSource={profile.suggestions}
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
        </Card>
      )}
    </div>
  )
}
