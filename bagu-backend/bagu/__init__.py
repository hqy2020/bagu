from django.db.backends.signals import connection_created


def enable_wal_mode(sender, connection, **kwargs):
    """启用 SQLite WAL 模式，允许并发读+单写"""
    if connection.vendor == 'sqlite':
        cursor = connection.cursor()
        cursor.execute('PRAGMA journal_mode=WAL;')


connection_created.connect(enable_wal_mode)
