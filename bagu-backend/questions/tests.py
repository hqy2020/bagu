from datetime import datetime
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import call_command
from django.test import TestCase

from questions.markdown_export import render_questions_markdown
from questions.models import Category, Question, SubCategory


class MarkdownExportTests(TestCase):
    def setUp(self):
        self.redis = Category.objects.create(name='Redis', sort_order=1)
        self.concurrent = Category.objects.create(name='并发编程', sort_order=2)
        self.data_structures = SubCategory.objects.create(
            category=self.redis,
            name='数据结构',
            sort_order=1,
        )
        self.thread_pool = SubCategory.objects.create(
            category=self.concurrent,
            name='线程池',
            sort_order=1,
        )

        Question.objects.create(
            category=self.redis,
            sub_category=self.data_structures,
            title='Redis 为什么这么快？',
            brief_answer='因为它主要基于内存，且单线程模型减少了上下文切换。',
            detailed_answer='详细解释 Redis 的 IO 多路复用、内存模型与高效数据结构。',
            key_points=['内存访问快', 'IO 多路复用', '高效数据结构'],
            tags=['Redis', '性能'],
            source_url='https://example.com/redis-fast',
        )
        Question.objects.create(
            category=self.concurrent,
            sub_category=self.thread_pool,
            title='线程池有哪些核心参数？',
            brief_answer='核心参数包括核心线程数、最大线程数、阻塞队列和拒绝策略。',
            detailed_answer='详细解释 ThreadPoolExecutor 的参数协同关系。',
            key_points=['corePoolSize', 'maximumPoolSize', 'workQueue', 'RejectedExecutionHandler'],
            tags=['并发', '线程池'],
        )

    def test_render_questions_markdown_groups_questions(self):
        questions = (
            Question.objects
            .select_related('category', 'sub_category')
            .order_by('category__sort_order', 'sub_category__sort_order', 'id')
        )

        markdown = render_questions_markdown(
            questions,
            generated_at=datetime(2026, 4, 7, 18, 30, 0),
        )

        self.assertIn('# 八股 QA 汇总', markdown)
        self.assertIn('> 导出时间：2026-04-07 18:30:00', markdown)
        self.assertIn('## Redis', markdown)
        self.assertIn('### 数据结构', markdown)
        self.assertIn('#### 1. Redis 为什么这么快？', markdown)
        self.assertIn('**回答话术**', markdown)
        self.assertIn('- 内存访问快', markdown)
        self.assertIn('<summary>展开问题详解</summary>', markdown)
        self.assertIn('来源：<https://example.com/redis-fast>', markdown)
        self.assertIn('## 并发编程', markdown)

    def test_export_questions_markdown_command_writes_file(self):
        with TemporaryDirectory() as tmp:
            output_path = Path(tmp) / 'bagu-qa.md'
            out = StringIO()

            call_command('export_questions_markdown', str(output_path), stdout=out)
            self.assertTrue(output_path.exists())

            content = output_path.read_text(encoding='utf-8')

        self.assertIn('Redis 为什么这么快？', content)
        self.assertIn('线程池有哪些核心参数？', content)
        self.assertIn('已导出 2 题到', out.getvalue())
