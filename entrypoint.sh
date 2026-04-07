#!/bin/bash
set -e

echo "==> Running database migrations..."
python /app/manage.py migrate --noinput

echo "==> Bootstrapping built-in data..."
python /app/manage.py bootstrap_seed_data

echo "==> Starting services..."
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
