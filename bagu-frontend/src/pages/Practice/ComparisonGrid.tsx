import { useEffect, useRef, useState } from 'react'
import { Card, Collapse, Progress, Typography, List, Button, message } from 'antd'
import { TrophyOutlined, CheckCircleOutlined, BulbOutlined, SoundOutlined, PauseCircleOutlined } from '@ant-design/icons'
import { previewAiRoleVoice, type AnswerResult, type AiModel, type BaguUser, type EvaluationRound, type BattleResult } from '../../api'
import type { StreamStatus } from '../../hooks/useStreamAnswer'
import type { SlotData } from './AnswerSlot'
import ResultCell from './ResultCell'
import StreamingCell from './StreamingCell'
import FollowUpBox from './FollowUpBox'
import MarkdownRender from '../../components/MarkdownRender'

const { Text } = Typography

interface CorrectionData {
  original: string
  corrected: string | null
}

interface CellState {
  status: StreamStatus
  thinkingText: string
  contentText: string
  result: AnswerResult | null
  error: string | null
  correction?: CorrectionData
}

interface Props {
  slots: SlotData[]
  models: AiModel[]
  cellStates: Record<string, CellState>
  users: BaguUser[]
  question: { brief_answer?: string; detailed_answer?: string; source_url?: string }
  roundResults?: Record<string, EvaluationRound>
  battleResult?: BattleResult | null
  battleStreaming?: { thinking: string; content: string } | null
}

function getCellKey(slotId: string, modelId: number) {
  return `${slotId}-${modelId}`
}

function normalizeText(text?: string) {
  if (!text) return ''
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function clipText(text: string, max = 420) {
  if (text.length <= max) return text
  return `${text.slice(0, max)}...`
}

function getFirstRoleId(results: AnswerResult[]) {
  for (const result of results) {
    const roleId = result.ai_role_scores?.find(item => typeof item.role_id === 'number')?.role_id
    if (typeof roleId === 'number') return roleId
  }
  return undefined
}

function getBestResult(results: AnswerResult[]) {
  if (!results.length) return null
  return [...results].sort((a, b) => b.ai_score - a.ai_score)[0]
}

function getCorePoint(bestResult: AnswerResult | null, question: { brief_answer?: string; detailed_answer?: string }) {
  const fromHighlight = normalizeText(bestResult?.ai_highlights?.[0])
  if (fromHighlight) return clipText(fromHighlight, 80)

  const fromBrief = normalizeText((question.brief_answer || '').split('\n').find(Boolean) || '')
  if (fromBrief) return clipText(fromBrief, 80)

  return '围绕核心场景，清晰给出思路、取舍和落地方案'
}

function buildImprovedPlaybackText(corePoint: string, improvedAnswer: string) {
  const normalized = clipText(normalizeText(improvedAnswer), 760)
  return `这个问题最核心的关键是：${corePoint}。面试官希望听到这样的回答：${normalized}`
}

function buildUserSummarySpeech(userName: string, score: number | null, results: AnswerResult[]) {
  if (!results.length) return ''

  const bestResult = getBestResult(results)
  const modelScores = results
    .map(result => `${result.ai_model_name}${result.ai_score}分`)
    .join('，')

  const highlights = bestResult?.ai_highlights?.slice(0, 2).map(item => normalizeText(item)).filter(Boolean).join('；') || ''
  const missing = bestResult?.ai_missing_points?.slice(0, 2).map(item => normalizeText(item)).filter(Boolean).join('；') || ''
  const suggestion = normalizeText(bestResult?.ai_suggestion || '')
  const scoreText = typeof score === 'number' ? `${score}分` : `${bestResult?.ai_score ?? 0}分`

  const speech = [
    `${userName}本题整体评估如下。`,
    `综合得分${scoreText}。`,
    modelScores ? `各模型评分：${modelScores}。` : '',
    highlights ? `主要亮点：${highlights}。` : '',
    missing ? `优先补强：${missing}。` : '',
    suggestion ? `改进建议：${suggestion}。` : '',
  ].filter(Boolean).join('')

  return clipText(speech, 900)
}

/** 纠错 Banner：支持"有修改"和"无需纠错"两种状态 */
function CorrectionBanner({ correction }: { correction: CorrectionData }) {
  // corrected 为 null 表示无需纠错
  if (!correction.corrected) {
    return (
      <div style={{
        padding: '8px 12px',
        background: '#f6ffed',
        border: '1px solid #b7eb8f',
        borderRadius: 6,
        marginBottom: 12,
        fontSize: 13,
      }}>
        <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 6 }} />
        <Text style={{ color: '#52c41a' }}>AI 纠错：无错别字</Text>
      </div>
    )
  }

  return (
    <div style={{
      padding: '8px 12px',
      background: '#fff7e6',
      border: '1px solid #ffd591',
      borderRadius: 6,
      marginBottom: 12,
      fontSize: 13,
    }}>
      <Text strong style={{ color: '#fa8c16' }}>AI 纠错：</Text>
      <div style={{ marginTop: 4 }}>
        <Text delete type="secondary">{correction.original.slice(0, 100)}{correction.original.length > 100 ? '...' : ''}</Text>
      </div>
      <div style={{ marginTop: 2 }}>
        <Text style={{ color: '#52c41a' }}>{correction.corrected.slice(0, 100)}{correction.corrected.length > 100 ? '...' : ''}</Text>
      </div>
    </div>
  )
}

/** AI 示范回答卡片 */
function ImprovedAnswerCard({
  content,
  canPlay,
  loading,
  isPlaying,
  isPaused,
  onPlay,
}: {
  content: string
  canPlay: boolean
  loading: boolean
  isPlaying: boolean
  isPaused: boolean
  onPlay: () => void
}) {
  return (
    <Card
      title={<><BulbOutlined style={{ marginRight: 8, color: '#faad14' }} />AI 示范回答</>}
      extra={(
        <Button
          size="small"
          icon={isPlaying ? <PauseCircleOutlined /> : <SoundOutlined />}
          onClick={onPlay}
          loading={loading}
          disabled={!canPlay}
        >
          {isPaused ? '继续示范讲解' : isPlaying ? '暂停示范讲解' : '播放示范讲解'}
        </Button>
      )}
      style={{ marginBottom: 16, border: '1px solid #ffe58f' }}
      styles={{ header: { background: '#fffbe6' } }}
    >
      <MarkdownRender content={content} />
    </Card>
  )
}

/** 2 人对战布局 */
function BattleLayout({
  slots,
  models,
  cellStates,
  users,
  question,
  roundResults,
  battleResult,
  battleStreaming,
  onPlayVoice,
  activeAudioKey,
  pausedAudioKey,
  loadingAudioKey,
}: Props & {
  onPlayVoice: (roleId: number | undefined, text: string, playbackKey: string) => void
  activeAudioKey: string | null
  pausedAudioKey: string | null
  loadingAudioKey: string | null
}) {
  const getUserName = (userId: number | null) => {
    if (!userId) return '未选择'
    const user = users.find(u => u.id === userId)
    return user ? (user.nickname || user.username) : `用户${userId}`
  }

  const slotA = slots[0]
  const slotB = slots[1]
  const nameA = getUserName(slotA.userId)
  const nameB = getUserName(slotB.userId)

  // 计算每个 slot 的综合分
  const getSlotScore = (slot: SlotData) => {
    const scores = models
      .map(m => cellStates[getCellKey(slot.id, m.id)]?.result?.ai_score)
      .filter((s): s is number => s !== undefined && s !== null)
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  }

  const scoreA = roundResults?.[slotA.id]?.composite_score ?? getSlotScore(slotA)
  const scoreB = roundResults?.[slotB.id]?.composite_score ?? getSlotScore(slotB)

  const getSlotResults = (slot: SlotData) => (
    models
      .map(model => cellStates[getCellKey(slot.id, model.id)]?.result)
      .filter((result): result is AnswerResult => Boolean(result))
  )

  // 获取 slot 的纠错数据（始终返回，包括无需纠错的情况）
  const getSlotCorrection = (slot: SlotData): CorrectionData | null => {
    for (const model of models) {
      const cell = cellStates[getCellKey(slot.id, model.id)]
      if (cell?.correction) return cell.correction
    }
    return null
  }

  // 获取最佳 AI 改进答案（得分较高者）
  const getBestImprovedResult = () => {
    const resultA = getBestResult(getSlotResults(slotA))
    const resultB = getBestResult(getSlotResults(slotB))

    if (resultA?.ai_improved_answer && resultB?.ai_improved_answer) {
      return resultA.ai_score >= resultB.ai_score ? resultA : resultB
    }
    return resultA?.ai_improved_answer ? resultA : (resultB?.ai_improved_answer ? resultB : null)
  }

  const renderSlotColumn = (slot: SlotData, userName: string, score: number | null) => {
    const correction = getSlotCorrection(slot)
    const slotResults = getSlotResults(slot)
    const summarySpeech = buildUserSummarySpeech(userName, score, slotResults)
    const summaryRoleId = getFirstRoleId(slotResults)
    const summaryKey = `summary-${slot.id}`
    const isSummaryLoading = loadingAudioKey === summaryKey
    const isSummaryPlaying = activeAudioKey === summaryKey && pausedAudioKey !== summaryKey && !isSummaryLoading
    const isSummaryPaused = pausedAudioKey === summaryKey

    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <Text strong style={{ fontSize: 16 }}>{userName}</Text>
          {score !== null && (
            <div style={{ marginTop: 8 }}>
              <Progress
                type="circle"
                percent={score}
                strokeColor={score >= 80 ? '#52c41a' : score >= 60 ? '#faad14' : '#ff4d4f'}
                size={60}
                format={p => <span style={{ fontSize: 16, fontWeight: 'bold' }}>{p}</span>}
              />
            </div>
          )}
          {slotResults.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Button
                size="small"
                icon={isSummaryPlaying ? <PauseCircleOutlined /> : <SoundOutlined />}
                onClick={() => onPlayVoice(summaryRoleId, summarySpeech, summaryKey)}
                loading={isSummaryLoading}
                disabled={!summaryRoleId || !summarySpeech}
              >
                {isSummaryPaused ? '继续用户总评' : isSummaryPlaying ? '暂停用户总评' : '播放用户总评'}
              </Button>
            </div>
          )}
        </div>

        {slot.answer.trim() && (
          <Card size="small" title="该用户回答" style={{ marginBottom: 12 }}>
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              <MarkdownRender content={slot.answer} />
            </div>
          </Card>
        )}

        {/* 该用户独立的纠错展示（始终显示） */}
        {correction && <CorrectionBanner correction={correction} />}

        {models.map(model => {
          const key = getCellKey(slot.id, model.id)
          const cell = cellStates[key]
          if (!cell) return null

          const isStreaming = cell.status === 'thinking' || cell.status === 'streaming'
          const hasResult = cell.status === 'done' && cell.result !== null

          return (
            <Card
              key={model.id}
              size="small"
              title={models.length > 1 ? model.name : undefined}
              style={{ marginBottom: 8 }}
            >
              {isStreaming && (
                <StreamingCell
                  status={cell.status}
                  thinkingText={cell.thinkingText}
                  contentText={cell.contentText}
                  error={cell.error}
                  compact
                />
              )}
              {hasResult && cell.result && (
                <>
                  <ResultCell result={cell.result} compact />
                  <FollowUpBox recordId={cell.result.id} modelId={model.id} compact />
                </>
              )}
              {cell.status === 'error' && (
                <StreamingCell
                  status={cell.status}
                  thinkingText=""
                  contentText=""
                  error={cell.error}
                  compact
                />
              )}
            </Card>
          )
        })}
      </div>
    )
  }

  const allDone = Object.values(cellStates).length > 0 &&
    Object.values(cellStates).every(c => c.status === 'done' || c.status === 'error')
  const bestImprovedResult = allDone ? getBestImprovedResult() : null
  const bestImprovedAnswer = bestImprovedResult?.ai_improved_answer || null
  const bestCorePoint = getCorePoint(bestImprovedResult, question)
  const bestImprovedSpeech = bestImprovedAnswer ? buildImprovedPlaybackText(bestCorePoint, bestImprovedAnswer) : ''
  const bestImprovedRoleId = bestImprovedResult ? getFirstRoleId([bestImprovedResult]) : undefined
  const improvedKey = 'improved-battle'
  const isImprovedLoading = loadingAudioKey === improvedKey
  const isImprovedPlaying = activeAudioKey === improvedKey && pausedAudioKey !== improvedKey && !isImprovedLoading
  const isImprovedPaused = pausedAudioKey === improvedKey

  return (
    <>
      {/* 左右对比区 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        {renderSlotColumn(slotA, nameA, scoreA)}

        {/* VS 分隔 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          fontWeight: 'bold',
          color: '#faad14',
          minWidth: 50,
          flexShrink: 0,
        }}>
          VS
        </div>

        {renderSlotColumn(slotB, nameB, scoreB)}
      </div>

      {/* 胜负判定 */}
      {scoreA !== null && scoreB !== null && (
        <Card style={{ marginBottom: 16, textAlign: 'center', background: '#f6ffed', border: '1px solid #b7eb8f' }}>
          <TrophyOutlined style={{ fontSize: 24, color: '#faad14', marginRight: 8 }} />
          <Text strong style={{ fontSize: 18 }}>
            {scoreA > scoreB
              ? `${nameA} 胜出！（${scoreA} vs ${scoreB}）`
              : scoreB > scoreA
                ? `${nameB} 胜出！（${scoreB} vs ${scoreA}）`
                : `平局！（${scoreA} vs ${scoreB}）`
            }
          </Text>
        </Card>
      )}

      {/* 对战分析流式输出 */}
      {battleStreaming && !battleResult && (
        <Card title="AI 对战分析中..." style={{ marginBottom: 16 }}>
          <StreamingCell
            status={battleStreaming.thinking ? 'thinking' : 'streaming'}
            thinkingText={battleStreaming.thinking}
            contentText={battleStreaming.content}
            error={null}
          />
        </Card>
      )}

      {/* 对战小结 */}
      {battleResult && (
        <Card
          title={<><TrophyOutlined style={{ marginRight: 8 }} />对战小结（AI 生成）</>}
          style={{ marginBottom: 16 }}
        >
          <Text style={{ fontSize: 15, display: 'block', marginBottom: 12 }}>{battleResult.summary}</Text>

          {battleResult.a_can_learn_from_b.length > 0 && (
            <>
              <Text strong>{nameA} 可学习 {nameB}：</Text>
              <List
                size="small"
                dataSource={battleResult.a_can_learn_from_b}
                renderItem={item => <List.Item>{item}</List.Item>}
                style={{ marginBottom: 8 }}
              />
            </>
          )}

          {battleResult.b_can_learn_from_a.length > 0 && (
            <>
              <Text strong>{nameB} 可学习 {nameA}：</Text>
              <List
                size="small"
                dataSource={battleResult.b_can_learn_from_a}
                renderItem={item => <List.Item>{item}</List.Item>}
                style={{ marginBottom: 8 }}
              />
            </>
          )}

          {battleResult.common_missing.length > 0 && (
            <>
              <Text strong>两人共同遗漏：</Text>
              <List
                size="small"
                dataSource={battleResult.common_missing}
                renderItem={item => <List.Item>{item}</List.Item>}
              />
            </>
          )}
        </Card>
      )}

      {/* AI 示范回答（对战模式） */}
      {bestImprovedAnswer && (
        <ImprovedAnswerCard
          content={bestImprovedAnswer}
          canPlay={Boolean(bestImprovedRoleId && bestImprovedSpeech)}
          loading={isImprovedLoading}
          isPlaying={isImprovedPlaying}
          isPaused={isImprovedPaused}
          onPlay={() => onPlayVoice(bestImprovedRoleId, bestImprovedSpeech, improvedKey)}
        />
      )}

      {/* 参考答案 */}
      <Collapse
        items={[{
          key: '1',
          label: '参考答案（回答话术）',
          children: <MarkdownRender content={question.brief_answer || '暂无'} />,
        }, {
          key: '2',
          label: '详细解析',
          children: <MarkdownRender content={question.detailed_answer || '暂无'} />,
        }, {
          key: '3',
          label: '答案链接',
          children: question.source_url
            ? <a href={question.source_url} target="_blank" rel="noreferrer">{question.source_url}</a>
            : <Text type="secondary">暂无链接</Text>,
        }]}
        style={{ marginBottom: 16 }}
      />
    </>
  )
}


export default function ComparisonGrid({ slots, models, cellStates, users, question, roundResults, battleResult, battleStreaming }: Props) {
  const [activeAudioKey, setActiveAudioKey] = useState<string | null>(null)
  const [pausedAudioKey, setPausedAudioKey] = useState<string | null>(null)
  const [loadingAudioKey, setLoadingAudioKey] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioKeyRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      audioKeyRef.current = null
    }
  }, [])

  const handlePlayVoice = async (roleId: number | undefined, text: string, playbackKey: string) => {
    if (!roleId) {
      message.warning('当前角色未配置语音，无法播放')
      return
    }
    if (!text) {
      message.warning('暂无可播放内容')
      return
    }

    const currentAudio = audioRef.current
    const currentKey = audioKeyRef.current

    if (currentAudio && currentKey === playbackKey) {
      if (currentAudio.paused) {
        try {
          await currentAudio.play()
          setPausedAudioKey(null)
        } catch {
          message.error('继续播放失败')
        }
      } else {
        currentAudio.pause()
        setPausedAudioKey(playbackKey)
      }
      return
    }

    if (currentAudio) {
      currentAudio.pause()
      currentAudio.onended = null
      currentAudio.onerror = null
      audioRef.current = null
      audioKeyRef.current = null
    }

    setLoadingAudioKey(playbackKey)
    try {
      const res = await previewAiRoleVoice(roleId, text)
      const audio = new Audio(`data:${res.data.mime_type};base64,${res.data.audio_base64}`)
      audioRef.current = audio
      audioKeyRef.current = playbackKey
      setActiveAudioKey(playbackKey)
      setPausedAudioKey(null)

      audio.onended = () => {
        if (audioKeyRef.current === playbackKey) {
          audioRef.current = null
          audioKeyRef.current = null
          setActiveAudioKey(null)
          setPausedAudioKey(null)
        }
      }
      audio.onerror = () => {
        if (audioKeyRef.current === playbackKey) {
          audioRef.current = null
          audioKeyRef.current = null
          setActiveAudioKey(null)
          setPausedAudioKey(null)
        }
      }
      await audio.play()
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '播放失败')
      if (audioKeyRef.current === playbackKey) {
        audioRef.current = null
        audioKeyRef.current = null
        setActiveAudioKey(null)
        setPausedAudioKey(null)
      }
    } finally {
      setLoadingAudioKey(prev => prev === playbackKey ? null : prev)
    }
  }

  // 2 人对战模式
  if (slots.length === 2) {
    return (
      <BattleLayout
        slots={slots}
        models={models}
        cellStates={cellStates}
        users={users}
        question={question}
        roundResults={roundResults}
        battleResult={battleResult}
        battleStreaming={battleStreaming}
        onPlayVoice={handlePlayVoice}
        activeAudioKey={activeAudioKey}
        pausedAudioKey={pausedAudioKey}
        loadingAudioKey={loadingAudioKey}
      />
    )
  }

  // 单人模式：支持单模型与多模型并行
  if (slots.length === 1) {
    const slot = slots[0]
    const modelCells = models.map(model => ({
      model,
      key: getCellKey(slot.id, model.id),
      cell: cellStates[getCellKey(slot.id, model.id)],
    }))

    const correction = modelCells.map(item => item.cell?.correction).find(Boolean) || null
    const slotScores = modelCells
      .map(item => item.cell?.result?.ai_score)
      .filter((score): score is number => score !== undefined && score !== null)
    const compositeScore = slotScores.length > 0
      ? Math.round(slotScores.reduce((total, score) => total + score, 0) / slotScores.length)
      : null
    const displayScore = roundResults?.[slot.id]?.composite_score ?? compositeScore
    const slotResults = modelCells
      .map(item => item.cell?.result)
      .filter((result): result is AnswerResult => Boolean(result))
    const bestResult = getBestResult(slotResults)
    const bestImprovedAnswer = bestResult?.ai_improved_answer || null
    const summarySpeech = buildUserSummarySpeech('你', displayScore, slotResults)
    const summaryRoleId = getFirstRoleId(slotResults)
    const summaryKey = `summary-${slot.id}`
    const corePoint = getCorePoint(bestResult, question)
    const improvedSpeech = bestImprovedAnswer ? buildImprovedPlaybackText(corePoint, bestImprovedAnswer) : ''
    const improvedRoleId = bestResult ? getFirstRoleId([bestResult]) : undefined
    const improvedKey = 'improved-single'
    const isSummaryLoading = loadingAudioKey === summaryKey
    const isSummaryPlaying = activeAudioKey === summaryKey && pausedAudioKey !== summaryKey && !isSummaryLoading
    const isSummaryPaused = pausedAudioKey === summaryKey
    const isImprovedLoading = loadingAudioKey === improvedKey
    const isImprovedPlaying = activeAudioKey === improvedKey && pausedAudioKey !== improvedKey && !isImprovedLoading
    const isImprovedPaused = pausedAudioKey === improvedKey

    return (
      <>
        {slot.answer.trim() && (
          <Card style={{ marginBottom: 16 }} title="你的回答">
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              <MarkdownRender content={slot.answer} />
            </div>
          </Card>
        )}

        {correction && <CorrectionBanner correction={correction} />}

        {slotResults.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <Text strong style={{ marginRight: 12 }}>本次答题总评语音</Text>
            <Button
              size="small"
              icon={isSummaryPlaying ? <PauseCircleOutlined /> : <SoundOutlined />}
              onClick={() => handlePlayVoice(summaryRoleId, summarySpeech, summaryKey)}
              loading={isSummaryLoading}
              disabled={!summaryRoleId || !summarySpeech}
            >
              {isSummaryPaused ? '继续用户总评' : isSummaryPlaying ? '暂停用户总评' : '播放用户总评'}
            </Button>
          </Card>
        )}

        {displayScore !== null && displayScore !== undefined && models.length > 1 && (
          <Card style={{ marginBottom: 16, textAlign: 'center', background: '#f0f5ff', border: '1px solid #adc6ff' }}>
            <Text strong style={{ marginRight: 12 }}>综合分（模型平均）</Text>
            <Progress
              type="circle"
              percent={displayScore}
              strokeColor={displayScore >= 80 ? '#52c41a' : displayScore >= 60 ? '#faad14' : '#ff4d4f'}
              size={70}
              format={p => <span style={{ fontSize: 18, fontWeight: 600 }}>{p}</span>}
            />
          </Card>
        )}

        {modelCells.map(({ model, key, cell }) => {
          if (!cell) return null
          const isStreaming = cell.status === 'thinking' || cell.status === 'streaming'
          const hasResult = cell.status === 'done' && cell.result !== null

          return (
            <Card key={key} style={{ marginBottom: 16 }} title={models.length > 1 ? model.name : undefined}>
              {isStreaming && (
                <StreamingCell
                  status={cell.status}
                  thinkingText={cell.thinkingText}
                  contentText={cell.contentText}
                  error={cell.error}
                />
              )}

              {hasResult && cell.result && (
                <>
                  <ResultCell result={cell.result} />
                  <FollowUpBox recordId={cell.result.id} modelId={model.id} />
                </>
              )}

              {cell.status === 'error' && (
                <StreamingCell
                  status={cell.status}
                  thinkingText={cell.thinkingText}
                  contentText={cell.contentText}
                  error={cell.error}
                />
              )}
            </Card>
          )
        })}

        {/* AI 示范回答（单人模式） */}
        {bestImprovedAnswer && (
          <ImprovedAnswerCard
            content={bestImprovedAnswer}
            canPlay={Boolean(improvedRoleId && improvedSpeech)}
            loading={isImprovedLoading}
            isPlaying={isImprovedPlaying}
            isPaused={isImprovedPaused}
            onPlay={() => handlePlayVoice(improvedRoleId, improvedSpeech, improvedKey)}
          />
        )}

        <Collapse
          items={[{
            key: '1',
            label: '参考答案（回答话术）',
            children: <MarkdownRender content={question.brief_answer || '暂无'} />,
          }, {
            key: '2',
            label: '详细解析',
            children: <MarkdownRender content={question.detailed_answer || '暂无'} />,
          }, {
            key: '3',
            label: '答案链接',
            children: question.source_url
              ? <a href={question.source_url} target="_blank" rel="noreferrer">{question.source_url}</a>
              : <Text type="secondary">暂无链接</Text>,
          }]}
          style={{ marginBottom: 16 }}
        />
      </>
    )
  }

  return (
    <Card style={{ marginBottom: 16 }}>
      <Text type="secondary">当前仅支持单人或双人对战展示，请返回重新提交。</Text>
    </Card>
  )
}
