#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def _apply_lan_default_for_runserver():
    """默认让 runserver 监听局域网地址，除非用户显式传入 addr:port。"""
    if len(sys.argv) < 2 or sys.argv[1] != 'runserver':
        return
    if len(sys.argv) == 2 or (len(sys.argv) > 2 and sys.argv[2].startswith('-')):
        sys.argv.insert(2, '0.0.0.0:8000')


def main():
    """Run administrative tasks."""
    _apply_lan_default_for_runserver()
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bagu.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
