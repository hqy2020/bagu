# 八股备考系统 (Bagu)

Java 八股文 AI 刷题系统。按分类刷题，提交答案后 AI 实时评分分析，生成个人知识画像。

不想启动程序也可以直接查看静态题库文档：[docs/bagu-qa.md](docs/bagu-qa.md)

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
| AI | OpenAI 兼容 API（支持 DeepSeek、GPT、Doubao、Gemini 等） |
| 部署 | Docker（Nginx + Gunicorn + Supervisor） 或 本地直启（无需 Docker） |

## 🚀 快速部署（2 分钟）

### 方式一：Docker（推荐）

```bash
git clone https://github.com/hqy2020/bagu.git
cd bagu
docker compose up -d
```

浏览器打开 **http://localhost:9000** ✅

### 方式二：本地直启（无需 Docker）

```bash
git clone https://github.com/hqy2020/bagu.git
cd bagu

# 后端
cd bagu-backend
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py bootstrap_seed_data   # 首次初始化题库
python manage.py runserver 0.0.0.0:10011 &
cd ..

# 前端
cd bagu-frontend
npm install
npm run dev -- --port 9000 &
cd ..

# 浏览器打开 http://localhost:9000 ✅
```

> 前端 Vite 会自动代理 `/api` 和 `/admin` 到后端 10011 端口，访问 9000 端口即可完整使用。

### 配置 AI

打开 **http://localhost:9000/admin/** — 自动免密登录。如果浏览器弹出了登录页，用下面账号手动登：

- **账号：** `admin`
- **密码：** `admin`

进去后点击 **AI 模型配置** → 填入 API Key → 保存。

预置模型：DeepSeek-R1、GPT-5.1、Doubao Seed 1.6、Grok 4.1、Gemini 2.5 Flash

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

浏览器打开 **http://localhost:9000**

首次启动时仓库里没有 `bagu-backend/db.sqlite3` 是正常的。容器会自动执行迁移，并在 Docker Volume `bagu-data` 中创建数据库，然后加载内置题库和默认模型配置。

### 5. 配置 AI 模型 API Key

应用内置了 4 个预配置的 AI 模型，但需要填入你自己的 API Key 才能使用 AI 评分功能：

1. 打开 **http://localhost:9000/admin/**（自动免密登录）
2. 点击 **AI 模型配置**
3. 选择一个模型，将 `Api key` 字段改为你的实际 Key
4. 保存即可

> 默认配置使用 [优云智算 ModelVerse](https://www.compshare.cn/) 的 OpenAI 兼容 API。你也可以修改 `Base url` 指向其他 OpenAI 兼容服务（如 OpenAI 官方、DeepSeek 官方等）。

**预置模型：**

| 模型 | 标识 |
|------|------|
| DeepSeek-R1（默认） | `deepseek-ai/DeepSeek-R1` |
| GPT-5.1 Chat | `gpt-5.1-chat` |
| Doubao Seed 1.6 | `ByteDance/doubao-seed-1.6` |
| Grok 4.1 Fast Non Reasoning | `grok-4-1-fast-non-reasoning` |
| Gemini 2.5 Flash | `gemini-2.5-flash` |

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

答题记录和用户数据存储在 Docker Volume `bagu-data` 中。即使删除容器重建，数据也不会丢失。Redis 缓存数据则存储在 `bagu-redis-data` 中。

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

## 导出静态 QA 文档

如果你想把当前数据库里的题库导出成一个单独 Markdown，方便直接发给别人或放到仓库里浏览：

```bash
cd bagu-backend
source venv/bin/activate   # Windows: venv\Scripts\activate
python manage.py export_questions_markdown ../docs/bagu-qa.md
```

默认会生成项目根目录下的 `docs/bagu-qa.md`。

## 本地开发

### 后端

```bash
cd bagu-backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py bootstrap_seed_data   # 首次初始化内置题库和默认模型
python manage.py runserver 0.0.0.0:10011
```

### 前端

```bash
cd bagu-frontend
npm install
npm run dev     # 启动开发服务器，端口 10012
```

开发模式下 Vite 会自动代理 `/api` 请求到后端 10011 端口。

## 常见问题

### 1. 启动时提示找不到数据库文件

从现在这个版本开始，仓库不再提交 `bagu-backend/db.sqlite3`。这是刻意设计，不是漏文件：

- Docker 启动时，容器会自动在 `bagu-data` 数据卷里创建数据库并执行初始化。
- 本地开发时，先执行 `python manage.py migrate`，再执行 `python manage.py bootstrap_seed_data`。

如果你之前拉过旧版本，宿主机上可能残留了一个错误创建的 `bagu-backend/db.sqlite3` 目录。遇到这种情况，先删除它，再重新构建即可：

```bash
rm -rf bagu-backend/db.sqlite3
docker compose up -d --build
```

可以通过下面的命令确认初始化是否成功：

```bash
docker compose logs -f bagu
```

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
