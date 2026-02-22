import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, Button, Tag, Typography, Spin, Space, Divider, Alert, message, Breadcrumb, Select } from 'antd'
import { SendOutlined, HomeOutlined, EyeOutlined, EyeInvisibleOutlined, PlusOutlined, RightOutlined, CheckCircleTwoTone } from '@ant-design/icons'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getQuestion, getQuestions, getRandomQuestion, getUsers, getAiModels, getAiRoles, createEvaluationRound, finalizeRound, setQuestionCompletion, type Question, type AnswerResult, type BaguUser, type AiModel, type AiRole, type EvaluationRound, type BattleResult } from '../../api'
import { useUserStore } from '../../stores/userStore'
import { fetchSSE } from '../../api/stream'
import type { StreamStatus } from '../../hooks/useStreamAnswer'
import useAutoRefresh from '../../hooks/useAutoRefresh'
import AnswerSlot, { type SlotData } from './AnswerSlot'
import ComparisonGrid from './ComparisonGrid'
import MarkdownRender from '../../components/MarkdownRender'

const { Title, Text } = Typography

interface CorrectionData {
  original: string
  corrected: string
}

interface CellState {
  status: StreamStatus
  thinkingText: string
  contentText: string
  result: AnswerResult | null
  error: string | null
  correction?: CorrectionData
}
const DIFFICULTY_LABEL: Record<'easy' | 'medium' | 'hard', string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}
const MAX_BATTLE_SLOTS = 2

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

  // 同分类题目列表（侧边栏）
  const [sidebarQuestions, setSidebarQuestions] = useState<Question[]>([])

  // 多用户多模型状态
  const [users, setUsers] = useState<BaguUser[]>([])
  const [aiModels, setAiModels] = useState<AiModel[]>([])
  const [aiRoles, setAiRoles] = useState<AiRole[]>([])
  const [selectedModelIds, setSelectedModelIds] = useState<number[]>([])
  const [selectedRoleKey, setSelectedRoleKey] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotData[]>(() => [{ id: newSlotId(), userId: null, answer: '' }])
  const [phase, setPhase] = useState<'input' | 'running' | 'result'>('input')
  const [cellStates, setCellStates] = useState<Record<string, CellState>>({})
  const [roundResults, setRoundResults] = useState<Record<string, EvaluationRound>>({})
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null)
  const [battleStreaming, setBattleStreaming] = useState<{ thinking: string; content: string } | null>(null)
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())

  // 加载用户列表、模型列表、角色列表
  useEffect(() => {
    getUsers().then(res => {
      const data = res.data as any
      const list: BaguUser[] = data?.results || data || []
      setUsers(list)
    })
    getAiModels().then(res => {
      const data = Array.isArray(res.data) ? res.data : (res.data as any).results || []
      const enabled = data.filter((item: AiModel) => item.is_enabled)
      setAiModels(enabled)
      const defaultModel = enabled.find((item: AiModel) => item.is_default) || enabled[0]
      setSelectedModelIds(defaultModel?.id ? [defaultModel.id] : [])
    })
    getAiRoles().then(res => {
      const data = Array.isArray(res.data) ? res.data : (res.data as any).results || []
      const enabled = data
        .filter((item: AiRole) => item.is_enabled)
        .sort((a: AiRole, b: AiRole) => a.sort_order - b.sort_order)
      setAiRoles(enabled)
      const mediumRole = enabled.find((item: AiRole) => item.difficulty_level === 'medium')
      setSelectedRoleKey((mediumRole || enabled[0])?.role_key ?? null)
    })
  }, [])

  // 历史状态兜底：多人模式最多只保留 2 个槽位
  useEffect(() => {
    if (slots.length > MAX_BATTLE_SLOTS) {
      message.warning('多人模式仅支持两人对战')
      setSlots(prev => prev.slice(0, MAX_BATTLE_SLOTS))
    }
  }, [slots.length])

  // 当前用户变化时同步到第一个槽位
  useEffect(() => {
    if (currentUser && slots.length > 0 && !slots[0].userId) {
      setSlots(prev => prev.map((s, i) => i === 0 ? { ...s, userId: currentUser.id } : s))
    }
  }, [currentUser])

  const loadSidebarQuestions = useCallback(async (categoryId: number) => {
    const res = await getQuestions({ category: categoryId, user_id: currentUser?.id })
    const qList = (res.data as any)?.results || res.data || []
    setSidebarQuestions(qList)
  }, [currentUser?.id])

  // 切题时重置 + 加载同分类题目列表
  useEffect(() => {
    if (!questionId) return
    setLoading(true)
    setPhase('input')
    setCellStates({})
    setRoundResults({})
    setBattleResult(null)
    setBattleStreaming(null)
    setSlots([{ id: newSlotId(), userId: currentUser?.id || null, answer: '' }])
    setShowAnswer(false)
    // 取消所有进行中的流
    abortControllersRef.current.forEach(c => c.abort())
    abortControllersRef.current.clear()
    getQuestion(Number(questionId))
      .then(res => {
        setQuestion(res.data)
        // 加载同分类题目列表用于侧边栏
        if (res.data.category) {
          void loadSidebarQuestions(res.data.category)
        }
      })
      .finally(() => setLoading(false))
  }, [questionId, currentUser?.id, loadSidebarQuestions])

  useAutoRefresh(
    async () => {
      if (!question?.category) return
      await loadSidebarQuestions(question.category)
    },
    { enabled: Boolean(currentUser && question?.category && phase === 'input'), intervalMs: 3000 },
  )

  const handleSubmit = useCallback(async () => {
    // 验证
    const validSlots = slots.filter(s => s.userId && s.answer.trim())
    if (validSlots.length === 0) {
      message.warning('请至少填写一个答题槽的用户和答案')
      return
    }
    const effectiveSelectedModelIds = selectedModelIds.filter(modelId => aiModels.some(model => model.id === modelId))
    if (effectiveSelectedModelIds.length === 0) {
      message.warning('请先选择评分模型')
      return
    }
    if (!selectedRoleKey) {
      message.warning('请先选择面试难度')
      return
    }
    if (!question) return
    const selectedRole = aiRoles.find(role => role.role_key === selectedRoleKey)
    if (!selectedRole) {
      message.warning('请选择有效的面试难度')
      return
    }

    // 取消旧的
    abortControllersRef.current.forEach(c => c.abort())
    abortControllersRef.current.clear()

    setPhase('running')
    setRoundResults({})
    setBattleResult(null)
    setBattleStreaming(null)

    // 初始化所有 cell 状态
    const initialStates: Record<string, CellState> = {}
    const completedResults: Record<string, AnswerResult> = {}
    for (const slot of validSlots) {
      for (const modelId of effectiveSelectedModelIds) {
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

    // 为多模型场景创建 Round
    const slotRoundMap: Record<string, string> = {}
    if (effectiveSelectedModelIds.length > 1) {
      for (const slot of validSlots) {
        try {
          const res = await createEvaluationRound({
            user_id: slot.userId!,
            question_id: question.id,
            user_answer: slot.answer.trim(),
            model_count: effectiveSelectedModelIds.length,
          })
          slotRoundMap[slot.id] = res.data.round_id
        } catch {
          // Round 创建失败不影响评分
        }
      }
    }

    // 并行发起所有 SSE 流
    const promises: Promise<void>[] = []
    for (const slot of validSlots) {
      for (const modelId of effectiveSelectedModelIds) {
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
            role_key: selectedRoleKey,
            difficulty_level: selectedRole?.difficulty_level,
            round_id: slotRoundMap[slot.id] || null,
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
            onCorrection(data) {
              setCellStates(prev => ({
                ...prev,
                [key]: {
                  ...prev[key],
                  correction: data,
                },
              }))
            },
            onResult(data) {
              completedResults[key] = data
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

    // 默认规则：答完即自动打卡完成（前端兜底，后端也会尝试自动标记）
    await Promise.allSettled(
      validSlots
        .filter(slot => Boolean(slot.userId))
        .map(slot => setQuestionCompletion(question.id, { user_id: slot.userId!, completed: true }))
    )

    // 完成后 finalize rounds
    if (effectiveSelectedModelIds.length > 1) {
      for (const slot of validSlots) {
        const roundId = slotRoundMap[slot.id]
        if (roundId) {
          try {
            const res = await finalizeRound(roundId)
            setRoundResults(prev => ({ ...prev, [slot.id]: res.data }))
          } catch {
            // finalize 失败不影响展示
          }
        }
      }
    }

    // 2 人对战模式 → 调用对战分析 API
    if (validSlots.length === 2 && question) {
      const getUserName = (userId: number | null) => {
        if (!userId) return '未选择'
        const user = users.find(u => u.id === userId)
        return user ? (user.nickname || user.username) : `用户${userId}`
      }

      // Wait a tick to allow state to settle, then read cellStates from DOM
      setBattleStreaming({ thinking: '', content: '' })
      const battleController = new AbortController()
      abortControllersRef.current.set('battle', battleController)

      try {
        // Collect scores from completed results
        const collectScores = (slotId: string) => {
          const summary = effectiveSelectedModelIds
            .map(modelId => {
              const key = makeCellKey(slotId, modelId)
              const result = completedResults[key]
              if (!result?.ai_score && result?.ai_score !== 0) {
                return null
              }
              const modelName = aiModels.find(model => model.id === modelId)?.name || `模型${modelId}`
              return `${modelName}: ${result.ai_score}`
            })
            .filter((line): line is string => Boolean(line))

          return summary.length > 0 ? summary.join('\n') : '暂无模型评分'
        }

        await fetchSSE(
          '/api/answers/battle-analysis/',
          {
            question_id: question.id,
            user_a: {
              name: getUserName(validSlots[0].userId),
              answer: validSlots[0].answer.trim(),
              scores: collectScores(validSlots[0].id),
            },
            user_b: {
              name: getUserName(validSlots[1].userId),
              answer: validSlots[1].answer.trim(),
              scores: collectScores(validSlots[1].id),
            },
          },
          {
            onThinking(content) {
              setBattleStreaming(prev => prev ? { ...prev, thinking: prev.thinking + content } : { thinking: content, content: '' })
            },
            onContent(content) {
              setBattleStreaming(prev => prev ? { ...prev, content: prev.content + content } : { thinking: '', content })
            },
            onBattleResult(data) {
              setBattleResult(data)
              setBattleStreaming(null)
            },
            onError(detail) {
              setBattleStreaming(null)
              console.error('对战分析失败:', detail)
            },
          },
          battleController.signal,
        )
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('对战分析失败:', err)
        }
        setBattleStreaming(null)
      }
    }

    setPhase('result')
  }, [slots, question, users, selectedModelIds, selectedRoleKey, aiRoles, aiModels])

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
    setRoundResults({})
    setBattleResult(null)
    setBattleStreaming(null)
  }

  const handleAddSlot = () => {
    if (slots.length >= MAX_BATTLE_SLOTS) {
      message.warning('多人模式仅支持两人对战')
      return
    }
    setSlots(prev => [...prev, { id: newSlotId(), userId: null, answer: '' }])
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
  const selectedModels = selectedModelIds
    .map(modelId => aiModels.find(model => model.id === modelId))
    .filter((model): model is AiModel => Boolean(model))

  // 当前题目在侧边栏列表中的序号
  const currentQuestionIndex = sidebarQuestions.findIndex(q => q.id === question.id)

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* 题目侧边栏 */}
      {sidebarQuestions.length > 1 && (
        <div style={{
          width: 240,
          flexShrink: 0,
          background: '#fff',
          borderRadius: 8,
          border: '1px solid #f0f0f0',
          overflow: 'hidden',
          alignSelf: 'flex-start',
          position: 'sticky',
          top: 80,
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #f0f0f0',
            fontWeight: 600,
            fontSize: 14,
            background: '#fafafa',
          }}>
            {question.category_name}
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
              {sidebarQuestions.length} 题
            </Text>
          </div>
          <div style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
            {sidebarQuestions.map((q, idx) => {
              const isCurrent = q.id === question.id
              return (
                <div
                  key={q.id}
                  onClick={() => { if (!isCurrent) navigate(`/practice/${q.id}`) }}
                  style={{
                    padding: '8px 12px',
                    cursor: isCurrent ? 'default' : 'pointer',
                    background: isCurrent ? '#e6f4ff' : 'transparent',
                    borderLeft: isCurrent ? '3px solid #1677ff' : '3px solid transparent',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = '#f5f5f5' }}
                  onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent' }}
                >
                  <Tag
                    color={isCurrent ? 'blue' : undefined}
                    style={{ flexShrink: 0, margin: 0, minWidth: 32, textAlign: 'center' }}
                  >
                    {idx + 1}
                  </Tag>
                  <Text
                    ellipsis
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: isCurrent ? 600 : 400,
                      color: isCurrent ? '#1677ff' : undefined,
                    }}
                  >
                    {q.title}
                  </Text>
                  {q.is_completed && <CheckCircleTwoTone twoToneColor="#52c41a" style={{ fontSize: 12 }} />}
                  {isCurrent && <RightOutlined style={{ color: '#1677ff', fontSize: 10 }} />}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 主内容区 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Breadcrumb items={[
          { title: <Link to="/"><HomeOutlined /> 首页</Link> },
          { title: <Link to={`/category/${question.category}`}>{question.category_name}</Link> },
          { title: question.title },
        ]} style={{ marginBottom: 16 }} />

        {/* 题目卡片 */}
        <Card style={{ marginBottom: 16 }}>
          <Title level={4}>
            {currentQuestionIndex >= 0 && (
              <Tag color="blue" style={{ marginRight: 8 }}>#{currentQuestionIndex + 1}</Tag>
            )}
            {question.title}
          </Title>
          <Space>
            <Tag color="blue">{question.category_name}</Tag>
            {question.sub_category_name && <Tag>{question.sub_category_name}</Tag>}
          </Space>
        </Card>

        {/* 答题区 */}
        {phase === 'input' && (
          <>
            <Card title="面试配置" size="small" style={{ marginBottom: 16 }}>
              <Space wrap style={{ width: '100%' }}>
                <div style={{ minWidth: 260 }}>
                  <Text type="secondary">评分模型</Text>
                  <Select
                    mode="multiple"
                    style={{ width: '100%', marginTop: 6 }}
                    value={selectedModelIds}
                    placeholder="请选择模型"
                    onChange={setSelectedModelIds}
                    options={aiModels.map(model => ({
                      value: model.id,
                      label: `${model.name}${model.is_default ? '（默认）' : ''}`,
                    }))}
                  />
                </div>
                <div style={{ minWidth: 320 }}>
                  <Text type="secondary">面试难度（音色）</Text>
                  <Select
                    style={{ width: '100%', marginTop: 6 }}
                    value={selectedRoleKey || undefined}
                    placeholder="请选择难度"
                    onChange={setSelectedRoleKey}
                    options={aiRoles.map(role => ({
                      value: role.role_key,
                      label: `${DIFFICULTY_LABEL[role.difficulty_level]} · ${role.name} · ${role.voice_label || role.voice}`,
                    }))}
                  />
                </div>
              </Space>
            </Card>

            {/* 答题槽 */}
            <Card
              title={slots.length > 1 ? '答题（双人对战）' : '你的回答（单人）'}
              extra={
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    size="small"
                    disabled={slots.length >= MAX_BATTLE_SLOTS}
                    onClick={handleAddSlot}
                  >
                    添加答题槽
                  </Button>
                  {slots.length >= MAX_BATTLE_SLOTS && (
                    <span
                      onClick={() => message.warning('多人模式仅支持两人对战')}
                      style={{ position: 'absolute', inset: 0, cursor: 'not-allowed' }}
                    />
                  )}
                </div>
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
                    questionId={question.id}
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
                  disabled={validSlots.length === 0 || selectedModelIds.length === 0 || !selectedRoleKey}
                >
                  提交答案
                  {validSlots.length > 1
                    ? ` (${validSlots.length}人)`
                    : ''}
                </Button>
              </div>

              {showAnswer && (
                <div style={{ marginTop: 16 }}>
                  <Divider>参考答案（回答话术）</Divider>
                  <MarkdownRender content={question.brief_answer || '暂无参考答案'} />
                  <div style={{ marginTop: 12 }}>
                    {question.source_url ? (
                      <>
                        <Text type="secondary">答案链接：</Text>
                        <a href={question.source_url} target="_blank" rel="noreferrer">{question.source_url}</a>
                      </>
                    ) : (
                      <Text type="secondary">答案链接：暂无链接</Text>
                    )}
                  </div>
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
            roundResults={roundResults}
            battleResult={battleResult}
            battleStreaming={battleStreaming}
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
    </div>
  )
}
