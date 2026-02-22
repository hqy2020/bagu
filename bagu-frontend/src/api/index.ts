import request from './request'

export interface Category {
  id: number
  name: string
  icon: string
  question_count: number
  completed_count?: number
  completion_rate?: number
  subcategories: SubCategory[]
}

export interface SubCategory {
  id: number
  name: string
  sort_order: number
  question_count: number
}

export interface Question {
  id: number
  title: string
  category: number
  category_name: string
  sub_category: number | null
  sub_category_name: string
  difficulty: number
  tags: string[]
  brief_answer?: string
  detailed_answer?: string
  key_points?: string[]
  source_url?: string
  is_completed?: boolean
}

export interface RoleScore {
  role_id?: number
  role_key: string
  role_name: string
  tts_model?: string
  voice?: string
  voice_label?: string
  difficulty_level?: 'easy' | 'medium' | 'hard'
  weight?: number
  score: number
  comment: string
}

export interface UsageInfo {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost: number
}

export interface AnswerResult {
  id: number
  user: number
  question: number
  question_title: string
  category_name: string
  user_answer: string
  corrected_answer: string
  ai_score: number
  ai_highlights: string[]
  ai_missing_points: string[]
  ai_suggestion: string
  ai_improved_answer: string
  ai_role_scores: RoleScore[]
  ai_model_name: string
  // 三级面试官评分
  ai_junior_score: number
  ai_junior_comment: string
  ai_mid_score: number
  ai_mid_comment: string
  ai_senior_score: number
  ai_senior_comment: string
  round: string | null
  created_at: string
  usage?: UsageInfo
}

export interface AnswerRecordListItem {
  id: number
  question: number
  question_title: string
  category_name: string
  ai_score: number
  ai_model_name: string
  created_at: string
}

export interface EvaluationRound {
  id: string
  user: number
  question: number
  user_answer: string
  composite_score: number
  model_count: number
  completed: boolean
  created_at: string
  scores: Array<{ model: string; score: number; record_id: number }>
}

export interface FollowUpItem {
  id: number
  answer_record: number
  user_question: string
  ai_response: string
  ai_model_name: string
  created_at: string
}

export interface BaguUser {
  id: number
  username: string
  nickname: string
  role: number
  total_answers: number
  avg_score: number
}

export interface AiModel {
  id: number
  name: string
  provider: string
  base_url: string
  model_name: string
  is_default: boolean
  is_enabled: boolean
  has_api_key: boolean
}

export interface AiRole {
  id: number
  role_key: string
  name: string
  role_prompt: string
  tts_model: string
  voice: string
  voice_label: string
  difficulty_level: 'easy' | 'medium' | 'hard'
  weight: number
  sort_order: number
  is_enabled: boolean
}

export interface TtsPreviewResult {
  role_id: number
  role_key: string
  tts_model: string
  voice: string
  audio_base64: string
  mime_type: string
}

export interface UserProfile {
  category_scores: Record<string, number>
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  overall_level: string
}

export interface BattleResult {
  winner: string
  score_a: number
  score_b: number
  summary: string
  a_can_learn_from_b: string[]
  b_can_learn_from_a: string[]
  common_missing: string[]
}

export interface QuickReviewNode {
  key: string
  title: string
  points: string[]
}

export interface QuickReviewPreset {
  category_id: number
  category_name: string
  summary: string
  nodes: QuickReviewNode[]
}

// 分类
export const getCategories = (params?: { user_id?: number }) => request.get<Category[]>('/categories/', { params })
export const getCategory = (id: number) => request.get<Category>(`/categories/${id}/`)
export const getCategoryQuickReview = (categoryId: number) =>
  request.get<QuickReviewPreset>(`/categories/${categoryId}/quick-review/`)

// 题目
export const getQuestions = (params?: { category?: number; sub_category?: number; search?: string; user_id?: number }) =>
  request.get('/questions/', { params })
export const getQuestion = (id: number) => request.get<Question>(`/questions/${id}/`)
export const getRandomQuestion = (categoryId?: number) =>
  request.get<Question>('/questions/random/', { params: categoryId ? { category: categoryId } : {} })
export const setQuestionCompletion = (questionId: number, data: { user_id: number; completed: boolean }) =>
  request.post(`/questions/${questionId}/completion/`, data)

// 答题
export const submitAnswer = (data: {
  user_id: number
  question_id: number
  answer: string
  model_id?: number
  role_key?: string
  difficulty_level?: 'easy' | 'medium' | 'hard'
}) =>
  request.post<AnswerResult>('/answers/submit/', data)
export const getAnswerHistory = (userId?: number) =>
  request.get('/answers/', { params: userId ? { user_id: userId } : {} })
export const getQuestionHistory = (userId: number, questionId: number) =>
  request.get<AnswerRecordListItem[]>('/answers/question-history/', { params: { user_id: userId, question_id: questionId } })

// 评估轮次
export const createEvaluationRound = (data: { user_id: number; question_id: number; user_answer: string; model_count: number }) =>
  request.post<{ round_id: string; created_at: string }>('/rounds/create/', data)
export const finalizeRound = (roundId: string) =>
  request.post<EvaluationRound>(`/rounds/${roundId}/finalize/`)

// 用户
export const getUsers = () => request.get<BaguUser[]>('/users/')
export const createUser = (data: { username: string; nickname?: string }) => request.post<BaguUser>('/users/', data)
export const getUserProfile = (userId: number) => request.get<UserProfile>(`/users/${userId}/profile/`)
export const generateUserProfile = (userId: number) => request.post<UserProfile>(`/users/${userId}/generate_profile/`)

// AI 模型
export const getAiModels = () => request.get('/ai-models/')
export const createAiModel = (data: { name: string; provider?: string; api_key: string; base_url: string; model_name: string; is_enabled?: boolean; is_default?: boolean }) =>
  request.post('/ai-models/', data)
export const updateAiModel = (id: number, data: { name?: string; provider?: string; api_key?: string; base_url?: string; model_name?: string; is_enabled?: boolean; is_default?: boolean }) =>
  request.patch(`/ai-models/${id}/`, data)
export const deleteAiModel = (id: number) => request.delete(`/ai-models/${id}/`)

// AI 角色
export const getAiRoles = () => request.get<AiRole[]>('/ai-roles/')
export const createAiRole = (data: Omit<AiRole, 'id'>) => request.post('/ai-roles/', data)
export const updateAiRole = (id: number, data: Partial<Omit<AiRole, 'id'>>) => request.patch(`/ai-roles/${id}/`, data)
export const deleteAiRole = (id: number) => request.delete(`/ai-roles/${id}/`)
export const previewAiRoleVoice = (id: number, text: string) =>
  request.post<TtsPreviewResult>(`/ai-roles/${id}/tts-preview/`, { text })
