"""批量导入八股文 MD 到数据库"""
import os
from pathlib import Path
from questions.models import Category, SubCategory, Question
from .parser import parse_bagu_md

# 跳过非题目文件
SKIP_FILES = {'八股准备手册', '八股复习总攻略', '八股文 MOC', '八股文原始提取',
              '八股文学习-Claude个性化建议', '八股文学习材料-Codex分析',
              '八股文学习材料-最终版', '八股知识画像'}

# 分类图标映射
CATEGORY_ICONS = {
    'Redis': 'database',
    '并发编程': 'thunderbolt',
    '消息队列': 'mail',
    '框架八股': 'appstore',
    '缓存实战': 'rocket',
    '分布式': 'cloud-server',
}


def import_from_directory(source_dir, dry_run=False):
    """从目录结构导入八股文"""
    source_path = Path(source_dir)
    stats = {'created': 0, 'skipped': 0, 'errors': []}

    for category_dir in sorted(source_path.iterdir()):
        if not category_dir.is_dir():
            continue

        category_name = category_dir.name
        if category_name.startswith('.'):
            continue

        # 创建/获取分类
        icon = CATEGORY_ICONS.get(category_name, 'book')
        if not dry_run:
            category, _ = Category.objects.get_or_create(
                name=category_name,
                defaults={'icon': icon}
            )

        # 遍历子目录
        for item in sorted(category_dir.iterdir()):
            if item.is_dir():
                # 有子分类目录
                sub_name = item.name
                if not dry_run:
                    sub_cat, _ = SubCategory.objects.get_or_create(
                        category=category, name=sub_name
                    )
                for md_file in sorted(item.glob('*.md')):
                    result = _import_file(md_file, category if not dry_run else None,
                                         sub_cat if not dry_run else None, dry_run)
                    _update_stats(stats, result, md_file)
            elif item.suffix == '.md' and item.stem not in SKIP_FILES:
                # 直接在分类目录下的 md 文件
                result = _import_file(item, category if not dry_run else None,
                                     None, dry_run)
                _update_stats(stats, result, item)

    # 更新分类计数
    if not dry_run:
        for cat in Category.objects.all():
            cat.update_count()

    return stats


def _import_file(filepath, category, sub_category, dry_run):
    """导入单个 MD 文件"""
    try:
        data = parse_bagu_md(filepath)
        if dry_run:
            return 'created'

        _, created = Question.objects.update_or_create(
            title=data['title'],
            category=category,
            defaults={
                'sub_category': sub_category,
                'brief_answer': data['brief_answer'],
                'detailed_answer': data['detailed_answer'],
                'key_points': data['key_points'],
                'source_url': data['source_url'],
                'tags': data['tags'],
            }
        )
        return 'created' if created else 'skipped'
    except Exception as e:
        return f'error: {e}'


def _update_stats(stats, result, filepath):
    if result == 'created':
        stats['created'] += 1
    elif result == 'skipped':
        stats['skipped'] += 1
    else:
        stats['errors'].append(f'{filepath.name}: {result}')
