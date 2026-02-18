# 八股备考系统 (Bagu)

Java 八股文 AI 刷题系统。按分类刷题，提交答案后 AI 实时评分分析，生成个人知识画像。

## 功能特性

- **分类刷题** — 题目按 Redis、并发编程、消息队列、缓存实战等分类组织，支持子分类筛选和搜索
- **AI 实时评分** — 提交答案后，AI 从回答完整性、准确性等维度打分，指出亮点和遗漏，给出改进建议和参考答案
- **流式输出** — SSE 流式推送 AI 分析过程，思考链实时可见
- **多模型对比** — 同一道题可同时选多个 AI 模型评分，对比不同模型的分析差异
- **多人 PK** — 支持多人同时作答同一道题，横向对比各自得分
- **知识画像** — 按分类统计答题数和平均分，可视化个人掌握情况
- **答题历史** — 完整的答题记录，可回顾过往表现
- **Markdown 题目导入** — 从 Obsidian 笔记自动解析导入题目

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 19 + TypeScript + Vite + Ant Design |
| 后端 | Django 4.2 + Django REST Framework |
| 数据库 | SQLite |
| AI | OpenAI 兼容 API（支持 DeepSeek、GPT、Doubao 等） |
| 部署 | Docker（Nginx + Gunicorn + Supervisor） |

## 快速开始（Docker Desktop）

只需 Docker Desktop，无需安装 Python / Node.js 环境。

### 1. 安装 Docker Desktop

前往 [Docker Desktop 官网](https://www.docker.com/products/docker-desktop/) 下载安装。

- macOS: 下载 `.dmg`，拖入 Applications
- Windows: 下载 `.exe` 安装，需启用 WSL 2

安装完成后启动 Docker Desktop，确保状态栏图标显示 **Running**。

### 2. 克隆项目

```bash
git clone https://github.com/hqy2020/bagu.git
cd bagu
```

### 3. 一键启动

```bash
docker compose up -d
```

首次构建约 2-3 分钟（需下载依赖），之后启动只需几秒。

### 4. 访问应用

浏览器打开 **http://localhost:8080**

### 5. 配置 AI 模型 API Key

应用内置了 4 个预配置的 AI 模型，但需要填入你自己的 API Key 才能使用 AI 评分功能：

1. 打开 **http://localhost:8080/admin/**（自动免密登录）
2. 点击 **AI 模型配置**
3. 选择一个模型，将 `Api key` 字段改为你的实际 Key
4. 保存即可

> 默认配置使用 [优云智算 ModelVerse](https://www.compshare.cn/) 的 OpenAI 兼容 API。你也可以修改 `Base url` 指向其他 OpenAI 兼容服务（如 OpenAI 官方、DeepSeek 官方等）。

**预置模型：**

| 模型 | 标识 |
|------|------|
| DeepSeek-R1（默认） | `deepseek-ai/DeepSeek-R1` |
| GPT-5.1 Chat | `gpt-5.1-chat` |
| DeepSeek-OCR | `deepseek-ai/DeepSeek-OCR` |
| Doubao Seed 1.6 | `ByteDance/doubao-seed-1.6` |

### 6. 停止和重启

```bash
# 停止
docker compose down

# 重启（保留数据）
docker compose up -d

# 重新构建（代码有改动时）
docker compose up -d --build
```

### Docker Desktop 图形界面操作

如果你更喜欢用 GUI：

1. 打开 **Docker Desktop**
2. 点击左侧 **Containers** 标签
3. 找到 **bagu** 容器组
4. 用 ▶️ / ⏹️ 按钮控制启停
5. 点击容器名可以查看日志

## 数据持久化

答题记录和用户数据存储在 Docker Volume `bagu-data` 中。即使删除容器重建，数据也不会丢失。

```bash
# 查看数据卷
docker volume ls | grep bagu

# ⚠️ 彻底删除所有数据（不可恢复）
docker compose down -v
```

## 导入自定义题目

题目以 Markdown 文件组织，目录结构即为分类：

```
题目目录/
├── Redis/
│   ├── 数据结构/
│   │   ├── ZSet底层实现.md
│   │   └── String与Hash选型.md
│   └── 缓存策略/
│       └── 缓存击穿解决方案.md
└── 并发编程/
    └── 线程池工作原理.md
```

每个 `.md` 文件是一道题，支持 frontmatter：

```markdown
---
title: ZSet底层实现原理
tags: [Redis, 数据结构]
---

## 回答话术
（简洁的面试回答模板）

## 问题详解
（深入的技术分析）

## 关键要点
（核心知识点列表）
```

导入命令：

```bash
# 进入容器执行
docker compose exec bagu python /app/manage.py import_questions /path/to/题目目录

# 预演模式（不实际写入）
docker compose exec bagu python /app/manage.py import_questions /path/to/题目目录 --dry-run
```

## 本地开发

### 后端

```bash
cd bagu-backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

### 前端

```bash
cd bagu-frontend
npm install
npm run dev     # 启动开发服务器，端口 3000
```

开发模式下 Vite 会自动代理 `/api` 请求到后端 8000 端口。

## 项目结构

```
bagu/
├── bagu-backend/          # Django 后端
│   ├── bagu/              #   项目配置
│   ├── questions/         #   题目管理（分类→子分类→题目）
│   ├── practice/          #   答题记录 + AI 模型配置
│   ├── users/             #   用户 + 知识画像
│   ├── ai_service/        #   AI 调用（OpenAI 兼容）
│   └── importer/          #   Markdown 题目导入
├── bagu-frontend/         # React 前端
│   └── src/
│       ├── pages/         #   页面组件
│       ├── api/           #   API 调用层
│       ├── stores/        #   Zustand 状态管理
│       └── components/    #   通用组件
├── Dockerfile             # 多阶段构建
├── docker-compose.yml     # 编排配置
├── nginx.conf             # Nginx 反代配置
└── supervisord.conf       # 进程管理
```

## License

MIT
