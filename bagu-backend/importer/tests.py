from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

import importer.importer as importer_service
from importer.parser import parse_bagu_md
from questions.models import Category, Question
from users.models import BaguUser, UserProfile


def write_file(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')


class ParserTests(TestCase):
    def test_parse_feishu_plain_url(self):
        with TemporaryDirectory() as tmp:
            md = Path(tmp) / 'sample.md'
            write_file(
                md,
                'https://nageoffer.feishu.cn/wiki/abc\n'
                '这是第一段回答。\n\n'
                '这是第二段。',
            )
            data = parse_bagu_md(md)

        self.assertEqual(data['source_url'], 'https://nageoffer.feishu.cn/wiki/abc')
        self.assertEqual(data['brief_answer'], '这是第一段回答。')
        self.assertIn('这是第一段回答。', data['detailed_answer'])

    def test_parse_feishu_prefixed_url(self):
        with TemporaryDirectory() as tmp:
            md = Path(tmp) / 'sample.md'
            write_file(
                md,
                '链接：https://nageoffer.feishu.cn/wiki/xyz\n'
                '正文第一段。',
            )
            data = parse_bagu_md(md)

        self.assertEqual(data['source_url'], 'https://nageoffer.feishu.cn/wiki/xyz')
        self.assertEqual(data['brief_answer'], '正文第一段。')
        self.assertIn('正文第一段。', data['detailed_answer'])

    def test_parse_yuque_fenced_meta_and_sections(self):
        with TemporaryDirectory() as tmp:
            md = Path(tmp) / 'sample.md'
            write_file(
                md,
                '```\n'
                'title: 什么是CAS？有哪些使用场景？\n'
                'tags: 并发,CAS\n'
                '```\n'
                'https://www.yuque.com/magestack/open8gu/abc\n'
                '## 回答话术\n'
                'CAS 是比较并交换。\n'
                '## 问题详解\n'
                '这里是详细解析。\n'
                '## 关键要点\n'
                '- 原子性\n'
                '- 无锁化\n',
            )
            data = parse_bagu_md(md)

        self.assertEqual(data['title'], '什么是CAS？有哪些使用场景？')
        self.assertEqual(data['source_url'], 'https://www.yuque.com/magestack/open8gu/abc')
        self.assertEqual(data['brief_answer'], 'CAS 是比较并交换。')
        self.assertEqual(data['detailed_answer'], '这里是详细解析。')
        self.assertEqual(data['key_points'], ['原子性', '无锁化'])
        self.assertEqual(data['tags'], ['并发', 'CAS'])

    def test_parse_frontmatter_regression(self):
        with TemporaryDirectory() as tmp:
            md = Path(tmp) / 'sample.md'
            write_file(
                md,
                '---\n'
                'title: Redis为什么这么快\n'
                'source: https://open8gu.com/redis/fast/\n'
                'tags:\n'
                '  - Redis\n'
                '  - 性能\n'
                '---\n'
                '## 回答话术\n'
                '因为内存访问快。\n'
                '## 问题详解\n'
                '详细解释。\n',
            )
            data = parse_bagu_md(md)

        self.assertEqual(data['title'], 'Redis为什么这么快')
        self.assertEqual(data['source_url'], 'https://open8gu.com/redis/fast/')
        self.assertEqual(data['tags'], ['Redis', '性能'])
        self.assertEqual(data['brief_answer'], '因为内存访问快。')
        self.assertEqual(data['detailed_answer'], '详细解释。')

    def test_parse_fallback_without_sections(self):
        with TemporaryDirectory() as tmp:
            md = Path(tmp) / '1. 线程池有哪些应用场景？.md'
            write_file(
                md,
                'https://www.yuque.com/magestack/open8gu/thread-pool\n'
                '线程池可以提升并发任务处理性能。\n\n'
                '第二段补充内容。\n',
            )
            data = parse_bagu_md(md)

        self.assertEqual(data['title'], '线程池有哪些应用场景？')
        self.assertEqual(data['brief_answer'], '线程池可以提升并发任务处理性能。')
        self.assertIn('第二段补充内容。', data['detailed_answer'])

    def test_parse_yuque_url_before_fenced_meta_ignores_code_comment_h1(self):
        with TemporaryDirectory() as tmp:
            md = Path(tmp) / 'sample.md'
            write_file(
                md,
                'https://www.yuque.com/magestack/open8gu/oegct3ayo729baqc\n'
                '```\n'
                'title: Redis宕机数据会丢失么？\n'
                'tags: 持久化\n'
                '```\n'
                '## 问题详解\n'
                '```conf\n'
                '# Redis can create append-only base files in either RDB or AOF formats. Using\n'
                'aof-use-rdb-preamble yes\n'
                '```\n',
            )
            data = parse_bagu_md(md)

        self.assertEqual(data['title'], 'Redis宕机数据会丢失么？')
        self.assertEqual(data['source_url'], 'https://www.yuque.com/magestack/open8gu/oegct3ayo729baqc')
        self.assertEqual(data['tags'], ['持久化'])


class ImporterFlowTests(TestCase):
    def test_cache_category_normalized_to_redis(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            feishu_dir = root / 'feishu'
            yuque_dir = root / 'yuque'
            feishu_dir.mkdir(parents=True, exist_ok=True)
            yuque_dir.mkdir(parents=True, exist_ok=True)

            write_file(
                yuque_dir / '缓存' / '✅ 缓存击穿怎么处理？.md',
                'https://www.yuque.com/magestack/open8gu/cache-breakdown\n正文',
            )

            candidates, summary = importer_service.build_merged_candidates(
                source_dirs=[('feishu', feishu_dir), ('yuque', yuque_dir)],
                require_source_url=True,
                require_business_source=True,
            )

        self.assertEqual(len(summary['errors']), 0)
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].category_name, 'Redis')
        self.assertEqual(candidates[0].sub_category_name, '缓存')

    def test_build_merged_candidates_yuque_priority(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            feishu_dir = root / 'feishu'
            yuque_dir = root / 'yuque'

            write_file(
                feishu_dir / 'Java并发' / '1. 线程池有哪些应用场景？.md',
                'https://nageoffer.feishu.cn/wiki/thread-pool\n飞书版本内容。',
            )
            write_file(
                yuque_dir / '并发编程' / '✅ 线程池有哪些应用场景？.md',
                '```\n'
                'title: 线程池有哪些应用场景？\n'
                '```\n'
                'https://www.yuque.com/magestack/open8gu/thread-pool\n'
                '语雀版本内容。',
            )

            candidates, summary = importer_service.build_merged_candidates(
                source_dirs=[('feishu', feishu_dir), ('yuque', yuque_dir)],
                require_source_url=True,
                require_business_source=True,
            )

        self.assertEqual(summary['deduped_count'], 1)
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].source_name, 'yuque')
        self.assertEqual(candidates[0].category_name, '并发编程')
        self.assertEqual(
            candidates[0].source_url,
            'https://www.yuque.com/magestack/open8gu/thread-pool',
        )

    def test_build_merged_candidates_missing_link(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            feishu_dir = root / 'feishu'
            yuque_dir = root / 'yuque'

            write_file(feishu_dir / 'Java并发' / '1. 无链接题目.md', '没有任何链接')
            write_file(
                yuque_dir / 'Redis' / '✅ Redis为什么这么快？.md',
                'https://www.yuque.com/magestack/open8gu/redis-fast\n正文',
            )

            candidates, summary = importer_service.build_merged_candidates(
                source_dirs=[('feishu', feishu_dir), ('yuque', yuque_dir)],
                require_source_url=True,
                require_business_source=True,
            )

        self.assertEqual(len(candidates), 1)
        self.assertEqual(len(summary['errors']), 1)
        self.assertIn('缺少 source_url', summary['errors'][0])


class RebuildCommandTests(TestCase):
    def test_rebuild_questions_fail_does_not_clear_existing_data(self):
        category = Category.objects.create(name='旧分类', icon='book')
        Question.objects.create(category=category, title='旧题目', source_url='https://open8gu.com/old')

        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            feishu_dir = root / 'feishu'
            yuque_dir = root / 'yuque'

            write_file(feishu_dir / 'Java并发' / '1. 无链接题目.md', '没有链接')
            write_file(
                yuque_dir / 'Redis' / '✅ Redis为什么这么快？.md',
                'https://www.yuque.com/magestack/open8gu/redis-fast\n正文',
            )

            with self.assertRaises(CommandError):
                call_command(
                    'rebuild_questions',
                    feishu_dir=str(feishu_dir),
                    yuque_dir=str(yuque_dir),
                )

        self.assertTrue(Category.objects.filter(name='旧分类').exists())
        self.assertTrue(Question.objects.filter(title='旧题目').exists())

    def test_rebuild_questions_success_and_reset_user_stats(self):
        old_category = Category.objects.create(name='旧分类', icon='book')
        Question.objects.create(category=old_category, title='旧题目', source_url='https://open8gu.com/old')

        user = BaguUser.objects.create(
            username='tester',
            nickname='测试用户',
            total_answers=8,
            avg_score=86.5,
        )
        profile = UserProfile.objects.create(
            user=user,
            category_scores={'旧分类': 90},
            strengths=['旧强项'],
            weaknesses=['旧弱项'],
            suggestions=['旧建议'],
            overall_level='advanced',
        )

        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            feishu_dir = root / 'feishu'
            yuque_dir = root / 'yuque'

            write_file(
                feishu_dir / 'Java并发' / '1. 线程池有哪些应用场景？.md',
                'https://nageoffer.feishu.cn/wiki/thread-pool\n飞书版本。',
            )
            write_file(
                yuque_dir / '并发编程' / '✅ 线程池有哪些应用场景？.md',
                '```\n'
                'title: 线程池有哪些应用场景？\n'
                '```\n'
                'https://www.yuque.com/magestack/open8gu/thread-pool\n'
                '语雀版本。',
            )
            write_file(
                yuque_dir / 'Redis' / '✅ Redis为什么这么快？.md',
                'https://www.yuque.com/magestack/open8gu/redis-fast\nRedis 正文。',
            )

            call_command(
                'rebuild_questions',
                feishu_dir=str(feishu_dir),
                yuque_dir=str(yuque_dir),
            )

        self.assertFalse(Category.objects.filter(name='旧分类').exists())
        self.assertEqual(Question.objects.count(), 2)
        self.assertEqual(Question.objects.filter(source_url='').count(), 0)

        thread_pool = Question.objects.get(title='线程池有哪些应用场景？')
        self.assertEqual(
            thread_pool.source_url,
            'https://www.yuque.com/magestack/open8gu/thread-pool',
        )

        user.refresh_from_db()
        profile.refresh_from_db()
        self.assertEqual(user.total_answers, 0)
        self.assertEqual(user.avg_score, 0.0)
        self.assertEqual(profile.category_scores, {})
        self.assertEqual(profile.strengths, [])
        self.assertEqual(profile.weaknesses, [])
        self.assertEqual(profile.suggestions, [])
        self.assertEqual(profile.overall_level, 'beginner')
