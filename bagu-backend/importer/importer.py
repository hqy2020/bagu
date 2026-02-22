"""批量导入八股文 MD 到数据库。"""

from dataclasses import dataclass
from pathlib import Path
import re

from questions.models import Category, SubCategory, Question
from .parser import parse_bagu_md

# 跳过非题目文件
SKIP_FILES = {
    '八股准备手册',
    '八股复习总攻略',
    '八股文 MOC',
    '八股文原始提取',
    '八股文学习-Claude个性化建议',
    '八股文学习材料-Codex分析',
    '八股文学习材料-最终版',
    '八股知识画像',
}

# 分类图标映射
CATEGORY_ICONS = {
    'Redis': 'database',
    '并发编程': 'thunderbolt',
    '消息队列': 'mail',
    'Spring': 'appstore',
    '缓存': 'rocket',
    '分布式': 'cloud-server',
    '数据库': 'database',
    '微服务': 'cloud-server',
    'JVM': 'book',
    '场景题': 'book',
    '面试那点事': 'book',
    '设计模式': 'book',
}

# 一级分类归一化
CATEGORY_NORMALIZATION_MAP = {
    'Java并发': '并发编程',
    '并发编程': '并发编程',
    'Java虚拟机': 'JVM',
    'JVM': 'JVM',
    'Spring': 'Spring',
    'spring': 'Spring',
    '微服务学习': '微服务',
    '微服务': '微服务',
    'Dubbo': '微服务',
    'RocketMQ消息队列': '消息队列',
    'RocketMQ': '消息队列',
    'RabbitMQ': '消息队列',
    'Kafka': '消息队列',
    '消息队列': '消息队列',
    'MySQL数据库分库分表': '数据库',
    'MySQL': '数据库',
    '分库分表': '数据库',
    'Redis': 'Redis',
    '缓存': 'Redis',
    '分布式': '分布式',
    '场景题': '场景题',
    '面试那点事': '面试那点事',
    '设计模式': '设计模式',
}

# 一级目录并入大类时，根目录题目补默认子类
DEFAULT_SUBCATEGORY_BY_ROOT = {
    'Kafka': 'Kafka',
    'RabbitMQ': 'RabbitMQ',
    'RocketMQ': 'RocketMQ',
    'RocketMQ消息队列': 'RocketMQ',
    'Dubbo': 'Dubbo',
    'MySQL': 'MySQL',
    '分库分表': '分库分表',
    '微服务学习': '微服务',
    'Java虚拟机': 'JVM',
    'JVM': 'JVM',
    '缓存': '缓存',
}

SOURCE_PRIORITY = {
    'yuque': 20,
    'feishu': 10,
    'single': 0,
}

BUSINESS_SOURCE_HOSTS = ('yuque.com', 'feishu.cn')
TITLE_PREFIX_PATTERN = re.compile(
    r'^\s*(?:[✅☑✔️]\s*)*(?:(?:\(?\d+\)?|[一二三四五六七八九十]+)\s*[.、,，:：)\）]\s*)*'
)


@dataclass(frozen=True)
class QuestionCandidate:
    source_name: str
    filepath: Path
    raw_category: str
    raw_sub_category: str | None
    category_name: str
    sub_category_name: str | None
    title: str
    normalized_title: str
    brief_answer: str
    detailed_answer: str
    key_points: list
    source_url: str
    tags: list


def import_from_directory(source_dir, dry_run=False):
    """
    兼容旧命令：从单目录导入。

    单目录内仍会进行分类归一化与标题去重（按同一 source 优先级）。
    """
    candidates, scan_stats = collect_candidates_from_directory(
        source_dir=source_dir,
        source_name='single',
        require_source_url=False,
        require_business_source=False,
    )
    deduped = deduplicate_candidates(candidates)
    stats = import_candidates(deduped, dry_run=dry_run)
    stats['errors'].extend(scan_stats['errors'])
    return stats


def build_merged_candidates(source_dirs, require_source_url=False, require_business_source=False):
    """
    扫描多来源目录，完成解析与去重。

    参数:
      source_dirs: [('feishu', '/path/to/dir'), ('yuque', '/path/to/dir')]
    """
    all_candidates = []
    all_errors = []
    source_file_counts = {}

    for source_name, source_dir in source_dirs:
        candidates, source_stats = collect_candidates_from_directory(
            source_dir=source_dir,
            source_name=source_name,
            require_source_url=require_source_url,
            require_business_source=require_business_source,
        )
        all_candidates.extend(candidates)
        all_errors.extend(source_stats['errors'])
        source_file_counts[source_name] = source_stats['scanned']

    deduped_candidates = deduplicate_candidates(all_candidates)
    category_counts = {}
    for candidate in deduped_candidates:
        category_counts[candidate.category_name] = category_counts.get(candidate.category_name, 0) + 1

    summary = {
        'source_file_counts': source_file_counts,
        'parsed_candidates': len(all_candidates),
        'selected_candidates': len(deduped_candidates),
        'deduped_count': len(all_candidates) - len(deduped_candidates),
        'category_counts': category_counts,
        'errors': all_errors,
    }
    return deduped_candidates, summary


def collect_candidates_from_directory(source_dir, source_name='single', require_source_url=False, require_business_source=False):
    """扫描目录并解析题目。"""
    source_path = Path(source_dir)
    if not source_path.exists():
        return [], {'scanned': 0, 'errors': [f'{source_dir}: 目录不存在']}
    if not source_path.is_dir():
        return [], {'scanned': 0, 'errors': [f'{source_dir}: 不是目录']}

    candidates = []
    errors = []
    scanned = 0

    for filepath, raw_category, raw_sub_category in _iter_markdown_entries(source_path):
        scanned += 1
        try:
            parsed = parse_bagu_md(filepath)
            source_url = (parsed.get('source_url') or '').strip()
            if require_source_url and not source_url:
                raise ValueError('缺少 source_url')
            if require_business_source and not is_business_source_url(source_url):
                raise ValueError(f'source_url 不是飞书/语雀链接: {source_url or "空"}')

            category_name = normalize_category_name(raw_category)
            sub_category_name = normalize_sub_category_name(raw_category, raw_sub_category, category_name)
            title = clean_title(parsed.get('title') or filepath.stem)

            candidate = QuestionCandidate(
                source_name=source_name,
                filepath=filepath,
                raw_category=raw_category,
                raw_sub_category=raw_sub_category,
                category_name=category_name,
                sub_category_name=sub_category_name,
                title=title,
                normalized_title=normalize_title_for_dedupe(title),
                brief_answer=(parsed.get('brief_answer') or '').strip(),
                detailed_answer=(parsed.get('detailed_answer') or '').strip(),
                key_points=parsed.get('key_points') or [],
                source_url=source_url,
                tags=parsed.get('tags') or [],
            )
            candidates.append(candidate)
        except Exception as exc:  # noqa: BLE001 - 收集每个文件错误，继续处理
            errors.append(f'{filepath}: {exc}')

    return candidates, {'scanned': scanned, 'errors': errors}


def deduplicate_candidates(candidates):
    """按 (归一化分类, 归一化标题) 去重。"""
    selected = {}
    sorted_candidates = sorted(
        candidates,
        key=lambda item: (
            item.category_name,
            item.normalized_title,
            str(item.filepath),
        ),
    )

    for candidate in sorted_candidates:
        key = (candidate.category_name, candidate.normalized_title)
        current = selected.get(key)
        if current is None:
            selected[key] = candidate
            continue
        selected[key] = choose_better_candidate(current, candidate)

    return list(selected.values())


def choose_better_candidate(current, incoming):
    """冲突时选择更优候选：语雀优先，其次选内容更完整。"""
    current_priority = SOURCE_PRIORITY.get(current.source_name, 0)
    incoming_priority = SOURCE_PRIORITY.get(incoming.source_name, 0)
    if incoming_priority > current_priority:
        return incoming
    if incoming_priority < current_priority:
        return current

    current_score = len(current.brief_answer) + len(current.detailed_answer)
    incoming_score = len(incoming.brief_answer) + len(incoming.detailed_answer)
    if incoming_score > current_score:
        return incoming
    return current


def import_candidates(candidates, dry_run=False):
    """将候选题目写入数据库。"""
    stats = {'created': 0, 'skipped': 0, 'errors': []}
    if dry_run:
        stats['created'] = len(candidates)
        return stats

    category_cache = {}
    sub_category_cache = {}

    ordered_candidates = sorted(
        candidates,
        key=lambda item: (
            item.category_name,
            item.sub_category_name or '',
            item.title,
        ),
    )

    for candidate in ordered_candidates:
        try:
            category = category_cache.get(candidate.category_name)
            if category is None:
                icon = CATEGORY_ICONS.get(candidate.category_name, 'book')
                category, _ = Category.objects.get_or_create(
                    name=candidate.category_name,
                    defaults={'icon': icon},
                )
                category_cache[candidate.category_name] = category

            sub_category = None
            if candidate.sub_category_name:
                sub_key = (category.id, candidate.sub_category_name)
                sub_category = sub_category_cache.get(sub_key)
                if sub_category is None:
                    sub_category, _ = SubCategory.objects.get_or_create(
                        category=category,
                        name=candidate.sub_category_name,
                    )
                    sub_category_cache[sub_key] = sub_category

            _, created = Question.objects.update_or_create(
                title=candidate.title,
                category=category,
                defaults={
                    'sub_category': sub_category,
                    'brief_answer': candidate.brief_answer,
                    'detailed_answer': candidate.detailed_answer,
                    'key_points': candidate.key_points,
                    'source_url': candidate.source_url,
                    'tags': candidate.tags,
                },
            )
            if created:
                stats['created'] += 1
            else:
                stats['skipped'] += 1
        except Exception as exc:  # noqa: BLE001 - 单文件失败不终止导入
            stats['errors'].append(f'{candidate.filepath}: {exc}')

    for category in Category.objects.all():
        category.update_count()

    return stats


def normalize_category_name(raw_category):
    return CATEGORY_NORMALIZATION_MAP.get(raw_category, raw_category)


def normalize_sub_category_name(raw_category, raw_sub_category, normalized_category):
    if raw_sub_category:
        return raw_sub_category.strip() or None
    if raw_category != normalized_category:
        return DEFAULT_SUBCATEGORY_BY_ROOT.get(raw_category)
    return None


def normalize_title_for_dedupe(title):
    cleaned = clean_title(title)
    cleaned = cleaned.replace('？', '?').replace('（', '(').replace('）', ')').replace('，', ',')
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned.lower()


def clean_title(title):
    title = re.sub(r'^\s*[✅☑✔️]+\s*', '', str(title or ''))
    title = TITLE_PREFIX_PATTERN.sub('', title)
    title = re.sub(r'\s+', ' ', title).strip()
    return title or '未命名题目'


def is_business_source_url(source_url):
    return bool(source_url) and any(host in source_url for host in BUSINESS_SOURCE_HOSTS)


def _iter_markdown_entries(source_path):
    for category_dir in sorted(source_path.iterdir()):
        if not category_dir.is_dir():
            continue
        if category_dir.name.startswith('.'):
            continue

        raw_category = category_dir.name
        for item in sorted(category_dir.iterdir()):
            if item.is_dir():
                raw_sub_category = item.name
                for md_file in sorted(item.glob('*.md')):
                    if md_file.stem in SKIP_FILES:
                        continue
                    yield md_file, raw_category, raw_sub_category
            elif item.suffix.lower() == '.md':
                if item.stem in SKIP_FILES:
                    continue
                yield item, raw_category, None
