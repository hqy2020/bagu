"""重建八股题库：扫描多来源 -> 校验 -> 清库 -> 重建。"""

from django.core.management.base import BaseCommand, CommandError
from django.core.cache import cache
from django.db import transaction

from importer.importer import build_merged_candidates, import_candidates
from questions.models import Category
from users.models import BaguUser, UserProfile


class Command(BaseCommand):
    help = '重建题库：归一化分类、去重并导入飞书/语雀题目'

    def add_arguments(self, parser):
        parser.add_argument(
            '--feishu-dir',
            required=True,
            help='飞书八股目录路径',
        )
        parser.add_argument(
            '--yuque-dir',
            required=True,
            help='语雀八股目录路径',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='仅扫描与校验，不写库不删库',
        )

    def handle(self, *args, **options):
        feishu_dir = options['feishu_dir']
        yuque_dir = options['yuque_dir']
        dry_run = options['dry_run']

        self.stdout.write(f'飞书目录: {feishu_dir}')
        self.stdout.write(f'语雀目录: {yuque_dir}')
        if dry_run:
            self.stdout.write(self.style.WARNING('预演模式 - 不会写入数据库'))

        candidates, summary = build_merged_candidates(
            source_dirs=[('feishu', feishu_dir), ('yuque', yuque_dir)],
            require_source_url=True,
            require_business_source=True,
        )
        self._print_summary(summary)

        if summary['errors']:
            self._print_errors(summary['errors'])
            raise CommandError(f'检测到 {len(summary["errors"])} 个解析/链接错误，已中止。')

        if not candidates:
            raise CommandError('候选题目为空，已中止。')

        if dry_run:
            self.stdout.write(self.style.SUCCESS(f'预演通过：预计导入 {len(candidates)} 题。'))
            return

        with transaction.atomic():
            Category.objects.all().delete()

            import_stats = import_candidates(candidates, dry_run=False)
            if import_stats['errors']:
                self._print_errors(import_stats['errors'])
                raise CommandError(f'导入阶段失败，共 {len(import_stats["errors"])} 个错误，事务已回滚。')

            reset_users = BaguUser.objects.update(total_answers=0, avg_score=0.0)
            reset_profiles = UserProfile.objects.update(
                category_scores={},
                strengths=[],
                weaknesses=[],
                suggestions=[],
                overall_level='beginner',
            )

            try:
                cache.clear()
            except Exception:
                # Redis 不可用时跳过缓存清理，不影响导入
                pass

        self.stdout.write(
            self.style.SUCCESS(
                '\n重建完成：'
                f'新增 {import_stats["created"]} 题，'
                f'覆盖 {import_stats["skipped"]} 题，'
                f'重置用户 {reset_users} 条，'
                f'重置画像 {reset_profiles} 条。'
            )
        )

    def _print_summary(self, summary):
        source_counts = summary['source_file_counts']
        self.stdout.write(
            '扫描统计: '
            f'飞书 {source_counts.get("feishu", 0)} 份, '
            f'语雀 {source_counts.get("yuque", 0)} 份'
        )
        self.stdout.write(
            '候选统计: '
            f'解析成功 {summary["parsed_candidates"]} 份, '
            f'去重后 {summary["selected_candidates"]} 题, '
            f'冲突去重 {summary["deduped_count"]} 题'
        )

        if summary['category_counts']:
            self.stdout.write('分类分布:')
            for category, count in sorted(
                summary['category_counts'].items(),
                key=lambda item: item[1],
                reverse=True,
            ):
                self.stdout.write(f'  - {category}: {count}')

    def _print_errors(self, errors):
        self.stdout.write(self.style.ERROR(f'错误 {len(errors)} 个（最多展示前 20 个）:'))
        for err in errors[:20]:
            self.stdout.write(f'  - {err}')
