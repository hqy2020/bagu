"""manage.py import_questions 命令 - 导入八股文"""
from django.core.management.base import BaseCommand
from django.conf import settings
from importer.importer import import_from_directory


class Command(BaseCommand):
    help = '从 Markdown 文件导入八股文题目'

    def add_arguments(self, parser):
        parser.add_argument(
            'source_dir', nargs='?', type=str,
            help='八股文目录路径（默认使用 settings.BAGU_SOURCE_DIR）'
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='预演模式，不写入数据库'
        )

    def handle(self, *args, **options):
        source_dir = options['source_dir'] or str(settings.BAGU_SOURCE_DIR)
        dry_run = options['dry_run']

        self.stdout.write(f'导入目录: {source_dir}')
        if dry_run:
            self.stdout.write(self.style.WARNING('预演模式 - 不会写入数据库'))

        stats = import_from_directory(source_dir, dry_run=dry_run)

        self.stdout.write(self.style.SUCCESS(
            f'\n导入完成: 新增 {stats["created"]} 题, 跳过 {stats["skipped"]} 题'
        ))
        if stats['errors']:
            self.stdout.write(self.style.ERROR(f'错误 {len(stats["errors"])} 个:'))
            for err in stats['errors']:
                self.stdout.write(f'  - {err}')
