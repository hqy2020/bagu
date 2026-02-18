import { useState, useEffect } from 'react'
import { Layout, Menu, Select, Button, Modal, Input, message, Space, Typography } from 'antd'
import { HomeOutlined, HistoryOutlined, UserOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useUserStore } from '../../stores/userStore'
import { getUsers, createUser, type BaguUser } from '../../api'

const { Header, Content } = Layout
const { Text } = Typography

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, setCurrentUser } = useUserStore()
  const [users, setUsers] = useState<BaguUser[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newNickname, setNewNickname] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const res = await getUsers()
      const data = Array.isArray(res.data) ? res.data : (res.data as any).results || []
      setUsers(data)
      if (!currentUser && data.length > 0) {
        setCurrentUser(data[0])
      }
    } catch {
      // 首次可能没有用户
    }
  }

  const handleCreateUser = async () => {
    if (!newUsername.trim()) {
      message.warning('请输入用户名')
      return
    }
    try {
      const res = await createUser({ username: newUsername, nickname: newNickname || newUsername })
      setCurrentUser(res.data)
      setShowCreate(false)
      setNewUsername('')
      setNewNickname('')
      loadUsers()
      message.success('创建成功')
    } catch {
      message.error('创建失败')
    }
  }

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: '首页' },
    { key: '/history', icon: <HistoryOutlined />, label: '答题历史' },
    { key: '/profile', icon: <UserOutlined />, label: '我的画像' },
    { key: 'admin', icon: <SettingOutlined />, label: '后台管理' },
  ]

  const currentKey = menuItems.find(item => item.key !== 'admin' && location.pathname === item.key)?.key || '/'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px' }}>
        <Text strong style={{ color: '#fff', fontSize: 18, whiteSpace: 'nowrap' }}>
          八股备考
        </Text>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[currentKey]}
          items={menuItems}
          onClick={({ key }) => {
            if (key === 'admin') {
              window.open('/admin/', '_blank')
            } else {
              navigate(key)
            }
          }}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Space>
          <Select
            value={currentUser?.id}
            onChange={(id) => {
              const user = users.find(u => u.id === id)
              if (user) setCurrentUser(user)
            }}
            options={users.map(u => ({ value: u.id, label: u.nickname || u.username }))}
            placeholder="选择用户"
            style={{ width: 140 }}
            dropdownRender={(menu) => (
              <>
                {menu}
                <div style={{ padding: 8 }}>
                  <Button type="link" icon={<PlusOutlined />} onClick={() => setShowCreate(true)}>
                    新建用户
                  </Button>
                </div>
              </>
            )}
          />
        </Space>
      </Header>
      <Content style={{ padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {children}
      </Content>

      <Modal
        title="新建用户"
        open={showCreate}
        onOk={handleCreateUser}
        onCancel={() => setShowCreate(false)}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input placeholder="用户名" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
          <Input placeholder="昵称（可选）" value={newNickname} onChange={e => setNewNickname(e.target.value)} />
        </Space>
      </Modal>
    </Layout>
  )
}
