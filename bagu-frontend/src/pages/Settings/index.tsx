import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Switch, Space, Tag, message, Popconfirm, Typography, InputNumber, AutoComplete, Select } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { getAiModels, createAiModel, updateAiModel, deleteAiModel, getAiRoles, createAiRole, updateAiRole, deleteAiRole, previewAiRoleVoice, type AiModel, type AiRole } from '../../api'

const { Title, Paragraph } = Typography
const { TextArea } = Input
const MODEL_PRESETS = [
  'grok-4-1-fast-non-reasoning',
  'gemini-2.5-flash',
  'deepseek-ai/DeepSeek-R1',
]
const DIFFICULTY_LABEL_MAP: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

export default function Settings() {
  const [models, setModels] = useState<AiModel[]>([])
  const [roles, setRoles] = useState<AiRole[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [previewingRoleId, setPreviewingRoleId] = useState<number | null>(null)

  const [modelModalOpen, setModelModalOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<AiModel | null>(null)
  const [modelForm] = Form.useForm()

  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<AiRole | null>(null)
  const [roleForm] = Form.useForm()

  useEffect(() => {
    loadModels()
    loadRoles()
  }, [])

  const loadModels = async () => {
    setLoadingModels(true)
    try {
      const res = await getAiModels()
      const data = Array.isArray(res.data) ? res.data : (res.data as any).results || []
      setModels(data)
    } catch {
      message.error('加载 AI 引擎配置失败')
    } finally {
      setLoadingModels(false)
    }
  }

  const loadRoles = async () => {
    setLoadingRoles(true)
    try {
      const res = await getAiRoles()
      const data = Array.isArray(res.data) ? res.data : (res.data as any).results || []
      setRoles(data)
    } catch {
      message.error('加载 AI 角色配置失败')
    } finally {
      setLoadingRoles(false)
    }
  }

  const handleAddModel = () => {
    setEditingModel(null)
    modelForm.resetFields()
    modelForm.setFieldsValue({
      provider: 'compshare',
      base_url: 'https://api.modelverse.cn/v1/',
      model_name: 'grok-4-1-fast-non-reasoning',
      is_enabled: true,
      is_default: false,
    })
    setModelModalOpen(true)
  }

  const handleEditModel = (model: AiModel) => {
    setEditingModel(model)
    modelForm.setFieldsValue({
      name: model.name,
      provider: model.provider,
      api_key: '',
      base_url: model.base_url,
      model_name: model.model_name,
      is_enabled: model.is_enabled,
      is_default: model.is_default,
    })
    setModelModalOpen(true)
  }

  const handleDeleteModel = async (id: number) => {
    try {
      await deleteAiModel(id)
      message.success('已删除')
      loadModels()
    } catch {
      message.error('删除失败')
    }
  }

  const handleSubmitModel = async () => {
    try {
      const values = await modelForm.validateFields()
      if (editingModel) {
        if (!values.api_key) delete values.api_key
        await updateAiModel(editingModel.id, values)
        message.success('更新成功')
      } else {
        await createAiModel(values)
        message.success('添加成功')
      }
      setModelModalOpen(false)
      loadModels()
    } catch {
      message.error('操作失败')
    }
  }

  const handleAddRole = () => {
    setEditingRole(null)
    roleForm.resetFields()
    roleForm.setFieldsValue({
      tts_model: 'IndexTeam/IndexTTS-2',
      voice: 'jack_cheng',
      voice_label: '',
      difficulty_level: 'medium',
      weight: 33,
      sort_order: roles.length,
      is_enabled: true,
    })
    setRoleModalOpen(true)
  }

  const handleEditRole = (role: AiRole) => {
    setEditingRole(role)
    roleForm.setFieldsValue(role)
    setRoleModalOpen(true)
  }

  const handleDeleteRole = async (id: number) => {
    try {
      await deleteAiRole(id)
      message.success('已删除')
      loadRoles()
    } catch {
      message.error('删除失败')
    }
  }

  const handlePreviewRole = async (role: AiRole) => {
    setPreviewingRoleId(role.id)
    try {
      const res = await previewAiRoleVoice(role.id, `你好，我是${role.name}，这是我的专属音色。`)
      const audio = new Audio(`data:${res.data.mime_type};base64,${res.data.audio_base64}`)
      await audio.play()
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '语音试听失败')
    } finally {
      setPreviewingRoleId(null)
    }
  }

  const handleSubmitRole = async () => {
    try {
      const values = await roleForm.validateFields()
      if (editingRole) {
        await updateAiRole(editingRole.id, values)
        message.success('角色已更新')
      } else {
        await createAiRole(values)
        message.success('角色已添加')
      }
      setRoleModalOpen(false)
      loadRoles()
    } catch {
      message.error('操作失败')
    }
  }

  const modelColumns = [
    { title: '引擎名称', dataIndex: 'name', key: 'name' },
    {
      title: '模型标识',
      dataIndex: 'model_name',
      key: 'model_name',
      render: (text: string) => <code>{text}</code>,
    },
    {
      title: 'API Key',
      key: 'api_key_status',
      render: (_: any, record: AiModel) => (
        record.has_api_key
          ? <Tag icon={<CheckCircleOutlined />} color="success">已配置</Tag>
          : <Tag icon={<ExclamationCircleOutlined />} color="warning">未配置</Tag>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: AiModel) => (
        <Space>
          {record.is_enabled ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>}
          {record.is_default && <Tag color="blue">默认</Tag>}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: AiModel) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditModel(record)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDeleteModel(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const roleColumns = [
    {
      title: '角色名称',
      key: 'name',
      render: (_: any, record: AiRole) => (
        <Space>
          <Tag color="blue">{record.role_key}</Tag>
          <span>{record.name}</span>
        </Space>
      ),
    },
    {
      title: '语音',
      key: 'voice',
      render: (_: any, record: AiRole) => (
        <Space direction="vertical" size={2}>
          <code>{record.voice || '-'}</code>
          <span style={{ color: '#888' }}>{record.voice_label || record.tts_model}</span>
        </Space>
      ),
    },
    {
      title: '难度',
      key: 'difficulty_level',
      render: (_: any, record: AiRole) => (
        <Tag color={record.difficulty_level === 'easy' ? 'green' : record.difficulty_level === 'hard' ? 'red' : 'gold'}>
          {DIFFICULTY_LABEL_MAP[record.difficulty_level] || record.difficulty_level}
        </Tag>
      ),
    },
    {
      title: '权重',
      dataIndex: 'weight',
      key: 'weight',
      render: (v: number) => <Tag color="purple">{v}%</Tag>,
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: AiRole) => (
        <Space>
          {record.is_enabled ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>}
          <Tag>排序 {record.sort_order}</Tag>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: AiRole) => (
        <Space>
          <Button
            type="link"
            loading={previewingRoleId === record.id}
            onClick={() => handlePreviewRole(record)}
          >
            试听
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditRole(record)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDeleteRole(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Title level={3}>AI 设置</Title>
      <Paragraph type="secondary">
        引擎负责模型 API 调用，角色负责评分人格、提示词和专属语音（ModelVerse TTS `voice`）。
      </Paragraph>

      <Card
        title="AI 引擎配置"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAddModel}>添加引擎</Button>}
        style={{ marginBottom: 16 }}
      >
        <Table
          dataSource={models}
          columns={modelColumns}
          rowKey="id"
          loading={loadingModels}
          pagination={false}
          locale={{ emptyText: '暂无引擎配置' }}
        />
      </Card>

      <Card
        title="AI 角色配置"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAddRole}>添加角色</Button>}
      >
        <Table
          dataSource={roles}
          columns={roleColumns}
          rowKey="id"
          loading={loadingRoles}
          pagination={false}
          locale={{ emptyText: '暂无角色配置' }}
        />
      </Card>

      <Modal
        title={editingModel ? '编辑 AI 引擎' : '添加 AI 引擎'}
        open={modelModalOpen}
        onOk={handleSubmitModel}
        onCancel={() => setModelModalOpen(false)}
        width={520}
      >
        <Form form={modelForm} layout="vertical">
          <Form.Item name="name" label="显示名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：Grok 4.1 Fast" />
          </Form.Item>
          <Form.Item
            name="api_key"
            label="API Key"
            rules={editingModel ? [] : [{ required: true, message: '请输入 API Key' }]}
            help={editingModel ? '留空表示不修改' : undefined}
          >
            <Input.Password placeholder="sk-..." />
          </Form.Item>
          <Form.Item name="base_url" label="API Base URL" rules={[{ required: true, message: '请输入 Base URL' }]}>
            <Input placeholder="https://api.modelverse.cn/v1/" />
          </Form.Item>
          <Form.Item name="model_name" label="模型标识" rules={[{ required: true, message: '请输入模型标识' }]}>
            <AutoComplete
              options={MODEL_PRESETS.map(value => ({ value }))}
              placeholder="grok-4-1-fast-non-reasoning"
              filterOption={(inputValue, option) => (option?.value || '').toLowerCase().includes(inputValue.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="provider" label="供应商">
            <Input placeholder="compshare" />
          </Form.Item>
          <Space>
            <Form.Item name="is_enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="is_default" label="默认" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={editingRole ? '编辑 AI 角色' : '添加 AI 角色'}
        open={roleModalOpen}
        onOk={handleSubmitRole}
        onCancel={() => setRoleModalOpen(false)}
        width={640}
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item name="role_key" label="角色标识" rules={[{ required: true, message: '请输入角色标识' }]}>
            <Input placeholder="kind_architect_p7" />
          </Form.Item>
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input placeholder="和蔼型 P7 架构师" />
          </Form.Item>
          <Form.Item name="role_prompt" label="角色提示词" rules={[{ required: true, message: '请输入角色提示词' }]}>
            <TextArea rows={5} placeholder="该角色评分侧重点与风格..." />
          </Form.Item>
          <Space style={{ width: '100%' }} align="start">
            <Form.Item name="tts_model" label="TTS 模型" style={{ width: 220 }} rules={[{ required: true, message: '请输入 TTS 模型' }]}>
              <Input placeholder="IndexTeam/IndexTTS-2" />
            </Form.Item>
            <Form.Item name="voice" label="TTS 音色(voice)" style={{ width: 220 }} rules={[{ required: true, message: '请输入音色' }]}>
              <Input placeholder="jack_cheng / uspeech:xxxx" />
            </Form.Item>
            <Form.Item name="voice_label" label="音色说明" style={{ width: 140 }}>
              <Input placeholder="温和男声" />
            </Form.Item>
          </Space>
          <Form.Item name="difficulty_level" label="难度等级" rules={[{ required: true, message: '请选择难度等级' }]}>
            <Select
              options={[
                { value: 'easy', label: '简单' },
                { value: 'medium', label: '中等' },
                { value: 'hard', label: '困难' },
              ]}
            />
          </Form.Item>
          <Space>
            <Form.Item name="weight" label="评分权重(%)" rules={[{ required: true, message: '请输入权重' }]}>
              <InputNumber min={0} max={100} />
            </Form.Item>
            <Form.Item name="sort_order" label="排序">
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="is_enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
