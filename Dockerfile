# ============================================
# Stage 1: 前端构建
# ============================================
FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend
COPY bagu-frontend/package.json bagu-frontend/package-lock.json ./
RUN npm ci
COPY bagu-frontend/ ./
RUN npm run build

# ============================================
# Stage 2: 后端运行环境
# ============================================
FROM python:3.9-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV SQLITE_PATH=/data/db.sqlite3

# 安装 nginx 和 supervisor
RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx supervisor && \
    rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
WORKDIR /app
COPY bagu-backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# 复制后端代码
COPY bagu-backend/ ./

# 复制前端构建产物
COPY --from=frontend-build /app/frontend/dist /var/www/frontend

# 复制配置文件
COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 预创建持久化目录，首次启动时由 migrate 自动创建 SQLite 文件
RUN mkdir -p /data

# collectstatic
RUN python manage.py collectstatic --noinput

EXPOSE 9000 9001

ENTRYPOINT ["/entrypoint.sh"]
