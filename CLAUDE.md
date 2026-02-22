# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

八股备考系统（bagu）—— 全栈 Java 八股文刷题应用。用户按分类刷题，提交答案后 AI 实时评分分析，生成个人知识画像。局域网场景，无认证设计。

## 技术栈

- **后端**：Django 4.2 + Django REST Framework 3.14 + SQLite3
- **前端**：React 19 + TypeScript + Vite 7 + Ant Design 6 + Zustand 5
- **AI**：OpenAI 兼容 API（DeepSeek-R1 via 优云智算 modelverse.cn）
- **题目导入**：python-frontmatter 解析 Obsidian Markdown 文件

## 常用命令

### 一键启动（项目根目录）
```bash
bash ../../start-bagu.sh
```

### 后端
```bash
cd bagu-backend
source venv/bin/activate
python manage.py runserver 0.0.0.0:8000     # 开发服务器
python manage.py migrate                     # 数据库迁移
python manage.py import_questions            # 从 Obsidian 导入题目
python manage.py import_questions --dry-run  # 预演模式
python manage.py import_questions /path/dir  # 指定目录导入
```

### 前端
```bash
cd bagu-frontend
npm install          # 安装依赖
npm run dev          # 开发服务器 (port 3000)
npm run build        # 生产构建
npm run lint         # ESLint 检查
```

## 架构概览

### 后端 Django Apps

| App | 职责 |
|-----|------|
| `bagu/` | Django 项目配置（settings、urls、CORS、自动登录中间件） |
| `questions/` | 分类(Category) → 子分类(SubCategory) → 题目(Question) 三层模型 |
| `practice/` | 答题记录(AnswerRecord) + AI 模型配置(AiModelConfig) |
| `users/` | 自定义用户(BaguUser) + 知识画像(UserProfile)，不依赖 Django Auth |
| `ai_service/` | AI Provider（OpenAI 兼容）+ Prompt 模板（面试官角色评分） |
| `importer/` | Markdown 解析器 + 目录递归导入器 + Django management command |

### 前端结构

| 目录 | 职责 |
|------|------|
| `src/api/` | Axios 实例（60s 超时适配 AI 推理）+ 集中 API 方法 + TS 接口定义 |
| `src/stores/` | Zustand 用户状态（localStorage 持久化，key: `bagu-user`） |
| `src/pages/` | Home(分类卡片) → QuestionList(题目列表) → Practice(答题+AI分析) → History / Profile |
| `src/components/` | AppLayout（Header+导航+用户选择器）、MarkdownRender（react-markdown+代码高亮） |

### 前端路由
```
/                       → Home（分类卡片展示）
/category/:categoryId   → QuestionList（题目列表+子分类筛选）
/practice/:questionId   → Practice（答题+AI评分分析）
/history                → History（答题历史表格）
/profile                → Profile（知识画像+分类评分图）
```

### Vite 代理配置
- `/api` → `http://127.0.0.1:8000`
- `/admin` → `http://127.0.0.1:8000`
- `/static` → `http://127.0.0.1:8000`

## 核心业务流

### 答题提交流程
```
用户输入答案 → POST /api/answers/submit/ (含 user_id, question_id, answer, model_id)
→ 后端 AiProvider.analyze_answer()（构建 Prompt → 调用 LLM → 解析 JSON）
→ 创建 AnswerRecord（score, highlights, missing_points, suggestion, improved_answer）
→ 更新用户统计（total_answers, avg_score）→ 返回前端展示
```

### 题目导入流程
```
Obsidian 90_八股文/ 目录 → 一级目录=Category → 二级目录=SubCategory → .md=Question
Frontmatter 提取 title/source/tags → 正文解析 ##回答话术/##问题详解/##关键要点
按 title 去重（update_or_create）→ 自动更新分类计数
```

## 关键设计决策

- **无认证**：局域网场景，用户在前端下拉选择，AutoLoginAdminMiddleware 免密进后台
- **自定义 BaguUser**：不依赖 Django Auth User，字段更精简
- **AI 容错**：JSON 解析失败降级为文本返回，前端 60s 超时适配长推理
- **配置驱动**：分类图标/颜色映射维护在前端 `ICON_MAP` / `COLOR_MAP`，后端 `icon` 字段
- **导入黑名单**：跳过 MOC、学习材料等非题目 Markdown 文件

## API 端点

```
GET    /api/categories/              # 分类列表（含子分类）
GET    /api/questions/               # 题目列表（?category=&sub_category=&search=）
GET    /api/questions/{id}/          # 题目详情
GET    /api/questions/random/        # 随机出题（?category=）
POST   /api/answers/submit/          # 提交答案 + AI 分析
GET    /api/answers/                 # 答题历史（?user_id=）
GET    /api/ai-models/               # 可用 AI 模型列表
GET    /api/users/                   # 用户列表
POST   /api/users/                   # 创建用户
GET    /api/users/{id}/profile/      # 用户知识画像
```
