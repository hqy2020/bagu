import { Layout, Menu, Typography } from 'antd'
import { HomeOutlined, HistoryOutlined, UserOutlined, SettingOutlined, ToolOutlined, ReadOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'

const { Header, Content } = Layout
const { Text } = Typography

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: '首页' },
    { key: '/interview-tips', icon: <ReadOutlined />, label: '面试那点事' },
    { key: '/history', icon: <HistoryOutlined />, label: '答题历史' },
    { key: '/profile', icon: <UserOutlined />, label: '用户画像' },
    { key: '/settings', icon: <SettingOutlined />, label: '设置' },
    { key: '/admin', icon: <ToolOutlined />, label: <a href="/admin/" target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>后台管理</a> },
  ]

  const currentKey = menuItems.find(item => item.key !== '/' && location.pathname.startsWith(item.key))?.key
    || menuItems.find(item => location.pathname === item.key)?.key
    || '/'

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
            if (key !== '/admin') navigate(key)
          }}
          style={{ flex: 1, minWidth: 0, fontSize: 16 }}
        />
      </Header>
      <Content style={{ padding: '24px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        {children}
      </Content>
    </Layout>
  )
}
