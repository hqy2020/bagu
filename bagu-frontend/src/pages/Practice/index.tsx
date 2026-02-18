import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, Button, Tag, Typography, Spin, Space, Divider, Alert, message, Breadcrumb, Checkbox } from 'antd'
import { SendOutlined, HomeOutlined, EyeOutlined, EyeInvisibleOutlined, PlusOutlined } from '@ant-design/icons'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getQuestion, getRandomQuestion, getUsers, getAiModels, type Question, type AnswerResult, type BaguUser, type AiModel } from '../../api'
import { useUserStore } from '../../stores/userStore'
import { fetchSSE } from '../../api/stream'
import type { StreamStatus } from '../../hooks/useStreamAnswer'
import AnswerSlot, { type SlotData } from './AnswerSlot'
import ComparisonGrid from './ComparisonGrid'
import MarkdownRender from '../../components/MarkdownRender'

const { Title, Text } = Typography

interface CellState {
  status: StreamStatus
  thinkingText: string
  contentText: string
  result: AnswerResult | null
  error: string | null
}

function makeCellKey(slotId: string, modelId: number) {
  return `${slotId}-${modelId}`
}

let slotCounter = 0
function newSlotId() {
  return `slot-${++slotCounter}`
}

export default function Practice() {
  const { questionId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useUserStore()
  const [question, setQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAnswer, setShowAnswer] = useState(false)

  // 多用户多模型状态
  const [users, setUsers] = useState<BaguUser[]>([])
  const [aiModels, setAiModels] = useState<AiModel[]>([])
  const [slots, setSlots] = useState<SlotData[]>(() => [{ id: newSlotId(), userId: null, answer: '' }])
  const [selectedModelIds, setSelectedModelIds] = useState<number[]>([])
  const [phase, setPhase] = useState<'input' | 'running' | 'result'>('input')
  const [cellStates, setCellStates] = useState<Record<string, CellState>>({})
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())

  // 加载用户列表和模型列表
  useEffect(() => {
    getUsers().then(res => {
      const data = res.data as any
      const list: BaguUser[] = data?.results || data || []
      setUsers(list)
    })
    getAiModels().then(res => {
      const models = res.data?.results || res.data || []
      setAiModels(models)
      // 默认选中第一个模型
      const defaultModel = models.find((m: AiModel) => m.is_default) || models[0]
      if (defaultModel) {
        setSelectedModelIds([defaultModel.id])
      }
    })
  }, [])

  // 当前用户变化时同步到第一个槽位
  useEffect(() => {
    if (currentUser && slots.length > 0 && !slots[0].userId) {
      setSlots(prev => prev.map((s, i) => i === 0 ? { ...s, userId: currentUser.id } : s))
    }
  }, [currentUser])

  // 切题时重置
  useEffect(() => {
    if (!questionId) return
    setLoading(true)
    setPhase('input')
    setCellStates({})
    setSlots([{ id: newSlotId(), userId: currentUser?.id || null, answer: '' }])
    setShowAnswer(false)
    // 取消所有进行中的流
    abortControllersRef.current.forEach(c => c.abort())
    abortControllersRef.current.clear()
    getQuestion(Number(questionId))
      .then(res => setQuestion(res.data))
      .finally(() => setLoading(false))
  }, [questionId])

  const handleSubmit = useCallback(async () => {
    // 验证
    const validSlots = slots.filter(s => s.userId && s.answer.trim())
    if (validSlots.length === 0) {
      message.warning('请至少填写一个答题槽的用户和答案')
      return
    }
    if (selectedModelIds.length === 0) {
      message.warning('请至少选择一个 AI 模型')
      return
    }
    if (!question) return

    // 取消旧的
    abortControllersRef.current.forEach(c => c.abort())
    abortControllersRef.current.clear()

    setPhase('running')

    // 初始化所有 cell 状态
    const initialStates: Record<string, CellState> = {}
    for (const slot of validSlots) {
      for (const modelId of selectedModelIds) {
        const key = makeCellKey(slot.id, modelId)
        initialStates[key] = {
          status: 'thinking',
          thinkingText: '',
          contentText: '',
          result: null,
          error: null,
        }
      }
    }
    setCellStates(initialStates)

    // 并行发起所有 SSE 流
    const promises: Promise<void>[] = []
    for (const slot of validSlots) {
      for (const modelId of selectedModelIds) {
        const key = makeCellKey(slot.id, modelId)
        const controller = new AbortController()
        abortControllersRef.current.set(key, controller)

        const p = fetchSSE(
          '/api/answers/submit-stream/',
          {
            user_id: slot.userId,
            question_id: question.id,
            answer: slot.answer.trim(),
            model_id: modelId,
          },
          {
            onThinking(content) {
              setCellStates(prev => ({
                ...prev,
                [key]: {
                  ...prev[key],
                  status: 'thinking',
                  thinkingText: prev[key].thinkingText + content,
                },
              }))
            },
            onContent(content) {
              setCellStates(prev => ({
                ...prev,
                [key]: {
                  ...prev[key],
                  status: 'streaming',
                  contentText: prev[key].contentText + content,
                },
              }))
            },
            onResult(data) {
              setCellStates(prev => ({
                ...prev,
                [key]: {
                  ...prev[key],
                  status: 'done',
                  result: data,
                },
              }))
            },
            onError(detail) {
              setCellStates(prev => ({
                ...prev,
                [key]: {
                  ...prev[key],
                  status: 'error',
                  error: detail,
                },
              }))
            },
            onDone() {
              setCellStates(prev => {
                const cell = prev[key]
                if (cell && cell.status !== 'done' && cell.status !== 'error') {
                  return { ...prev, [key]: { ...cell, status: 'done' } }
                }
                return prev
              })
            },
          },
          controller.signal,
        ).catch(err => {
          if (err.name === 'AbortError') return
          setCellStates(prev => ({
            ...prev,
            [key]: {
              ...prev[key],
              status: 'error',
              error: err.message || '连接失败',
            },
          }))
        })

        promises.push(p)
      }
    }

    await Promise.allSettled(promises)
    setPhase('result')
  }, [slots, selectedModelIds, question])

  const handleNext = async () => {
    if (!question) return
    try {
      const res = await getRandomQuestion(question.category)
      navigate(`/practice/${res.data.id}`)
    } catch {
      message.info('该分类暂无更多题目')
    }
  }

  const handleReset = () => {
    abortControllersRef.current.forEach(c => c.abort())
    abortControllersRef.current.clear()
    setPhase('input')
    setCellStates({})
  }

  if (loading) return <Spin size="large" style={{ display: 'block', marginTop: 100 }} />
  if (!question) return <Alert message="题目不存在" type="error" />

  const allDone = phase === 'result' || (
    phase === 'running' &&
    Object.values(cellStates).length > 0 &&
    Object.values(cellStates).every(c => c.status === 'done' || c.status === 'error')
  )

  // 自动转到 result 阶段
  if (phase === 'running' && allDone) {
    // 延迟设置避免渲染循环
    setTimeout(() => setPhase('result'), 0)
  }

  const validSlots = slots.filter(s => s.userId && s.answer.trim())
  const selectedModels = aiModels.filter(m => selectedModelIds.includes(m.id))

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Breadcrumb items={[
        { title: <Link to="/"><HomeOutlined /> 首页</Link> },
        { title: <Link to={`/category/${question.category}`}>{question.category_name}</Link> },
        { title: question.title },
      ]} style={{ marginBottom: 16 }} />

      {/* 题目卡片 */}
      <Card style={{ marginBottom: 16 }}>
        <Title level={4}>{question.title}</Title>
        <Space>
          <Tag color="blue">{question.category_name}</Tag>
          {question.sub_category_name && <Tag>{question.sub_category_name}</Tag>}
        </Space>
      </Card>

      {/* 答题区 */}
      {phase === 'input' && (
        <>
          {/* 模型选择 */}
          {aiModels.length > 1 && (
            <Card title="选择 AI 模型" size="small" style={{ marginBottom: 16 }}>
              <Checkbox.Group
                value={selectedModelIds}
                onChange={vals => setSelectedModelIds(vals as number[])}
              >
                <Space wrap>
                  {aiModels.map(model => (
                    <Checkbox key={model.id} value={model.id}>
                      {model.name}
                      {model.is_default && <Tag color="blue" style={{ marginLeft: 4 }}>默认</Tag>}
                    </Checkbox>
                  ))}
                </Space>
              </Checkbox.Group>
            </Card>
          )}

          {/* 答题槽 */}
          <Card
            title={slots.length > 1 ? '答题（多人模式）' : '你的回答'}
            extra={
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                size="small"
                onClick={() => setSlots(prev => [...prev, { id: newSlotId(), userId: null, answer: '' }])}
              >
                添加答题槽
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
            {slots.map((slot, idx) => (
              <div key={slot.id}>
                {slots.length > 1 && <Text strong style={{ marginBottom: 4, display: 'block' }}>答题槽 {idx + 1}</Text>}
                <AnswerSlot
                  slot={slot}
                  users={users}
                  disabled={false}
                  removable={slots.length > 1}
                  onChange={updated => setSlots(prev => prev.map(s => s.id === slot.id ? updated : s))}
                  onRemove={() => setSlots(prev => prev.filter(s => s.id !== slot.id))}
                />
                {idx < slots.length - 1 && <Divider dashed style={{ margin: '8px 0' }} />}
              </div>
            ))}

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
              <Button
                icon={showAnswer ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={() => setShowAnswer(!showAnswer)}
              >
                {showAnswer ? '隐藏参考答案' : '查看参考答案'}
              </Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSubmit}
                disabled={validSlots.length === 0 || selectedModelIds.length === 0}
              >
                提交答案
                {validSlots.length > 1 || selectedModelIds.length > 1
                  ? ` (${validSlots.length}人 × ${selectedModelIds.length}模型)`
                  : ''}
              </Button>
            </div>

            {showAnswer && (
              <div style={{ marginTop: 16 }}>
                <Divider>参考答案（回答话术）</Divider>
                <MarkdownRender content={question.brief_answer || '暂无参考答案'} />
              </div>
            )}
          </Card>
        </>
      )}

      {/* 流式过程 + 结果展示 */}
      {(phase === 'running' || phase === 'result') && Object.keys(cellStates).length > 0 && (
        <ComparisonGrid
          slots={validSlots.length > 0 ? validSlots : slots.filter(s => s.userId)}
          models={selectedModels}
          cellStates={cellStates}
          users={users}
          question={question}
        />
      )}

      {/* 底部操作 */}
      {phase === 'result' && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Space size="large">
            <Button onClick={handleReset}>重新作答</Button>
            <Button type="primary" size="large" onClick={handleNext}>
              下一题
            </Button>
          </Space>
        </div>
      )}
    </div>
  )
}
