import request from './request'

export interface Category {
  id: number
  name: string
  icon: string
  question_count: number
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
  ai_score: number
  ai_highlights: string[]
  ai_missing_points: string[]
  ai_suggestion: string
  ai_improved_answer: string
  ai_model_name: string
  created_at: string
  usage?: UsageInfo
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
  model_name: string
  is_default: boolean
}

export interface UserProfile {
  category_scores: Record<string, number>
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  overall_level: string
}

// 分类
export const getCategories = () => request.get<Category[]>('/categories/')
export const getCategory = (id: number) => request.get<Category>(`/categories/${id}/`)

// 题目
export const getQuestions = (params?: { category?: number; sub_category?: number; search?: string }) =>
  request.get('/questions/', { params })
export const getQuestion = (id: number) => request.get<Question>(`/questions/${id}/`)
export const getRandomQuestion = (categoryId?: number) =>
  request.get<Question>('/questions/random/', { params: categoryId ? { category: categoryId } : {} })

// 答题
export const submitAnswer = (data: { user_id: number; question_id: number; answer: string; model_id?: number }) =>
  request.post<AnswerResult>('/answers/submit/', data)
export const getAnswerHistory = (userId?: number) =>
  request.get('/answers/', { params: userId ? { user_id: userId } : {} })

// 用户
export const getUsers = () => request.get<BaguUser[]>('/users/')
export const createUser = (data: { username: string; nickname?: string }) => request.post<BaguUser>('/users/', data)
export const getUserProfile = (userId: number) => request.get<UserProfile>(`/users/${userId}/profile/`)

// AI 模型
export const getAiModels = () => request.get('/ai-models/')
