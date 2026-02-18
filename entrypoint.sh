#!/bin/bash
set -e

echo "==> Running database migrations..."
python /app/manage.py migrate --noinput

echo "==> Starting services..."
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
