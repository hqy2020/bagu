from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from questions.markdown_export import render_questions_markdown
from questions.models import Question


class Command(BaseCommand):
    help = '将题库导出为一个便于直接阅读的 Markdown 文件'

    def add_arguments(self, parser):
        parser.add_argument(
            'output_path',
            nargs='?',
            default=str(settings.BASE_DIR.parent / 'docs' / 'bagu-qa.md'),
            help='导出的 Markdown 路径，默认写入项目根目录 docs/bagu-qa.md',
        )

    def handle(self, *args, **options):
        output_path = Path(options['output_path']).expanduser()
        if not output_path.is_absolute():
            output_path = (Path.cwd() / output_path).resolve()

        questions = (
            Question.objects
            .select_related('category', 'sub_category')
            .order_by('category__sort_order', 'sub_category__sort_order', 'id')
        )
        markdown = render_questions_markdown(questions)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(markdown, encoding='utf-8')

        self.stdout.write(self.style.SUCCESS(
            f'已导出 {questions.count()} 题到 {output_path}'
        ))


