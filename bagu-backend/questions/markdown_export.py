from collections import OrderedDict

from django.utils import timezone


def render_questions_markdown(questions, generated_at=None):
    question_list = list(questions)
    generated_at = generated_at or timezone.localtime()
    sub_category_sentinel = object()

    category_counts = OrderedDict()
    for question in question_list:
        category_counts.setdefault(question.category.name, 0)
        category_counts[question.category.name] += 1

    lines = [
        '# 八股 QA 汇总',
        '',
        '这个文档由 `python manage.py export_questions_markdown` 自动生成，方便在不启动程序时直接查看题库。',
        '',
        f'> 导出时间：{generated_at.strftime("%Y-%m-%d %H:%M:%S")}',
        f'> 题目总数：{len(question_list)}',
        '',
        '## 分类索引',
        '',
    ]

    if category_counts:
        for name, count in category_counts.items():
            lines.append(f'- {name}（{count} 题）')
    else:
        lines.append('- 当前没有可导出的题目')

    current_category_id = None
    current_sub_category_id = sub_category_sentinel
    category_question_no = 0

    for question in question_list:
        if question.category_id != current_category_id:
            if current_category_id is not None:
                lines.extend(['', '---', ''])
            current_category_id = question.category_id
            current_sub_category_id = sub_category_sentinel
            category_question_no = 0
            lines.extend([
                f'## {question.category.name}',
                '',
            ])

        sub_category_id = question.sub_category_id
        if sub_category_id != current_sub_category_id:
            current_sub_category_id = sub_category_id
            sub_category_name = question.sub_category.name if question.sub_category else '未分类'
            lines.extend([
                f'### {sub_category_name}',
                '',
            ])

        category_question_no += 1
        lines.append(f'#### {category_question_no}. {question.title}')
        lines.append('')

        if question.tags:
            lines.append(f'标签：{", ".join(question.tags)}')
            lines.append('')

        if question.brief_answer:
            lines.extend([
                '**回答话术**',
                '',
                question.brief_answer.strip(),
                '',
            ])

        if question.key_points:
            lines.append('**关键要点**')
            lines.append('')
            for point in question.key_points:
                lines.append(f'- {point}')
            lines.append('')

        if question.detailed_answer:
            lines.extend([
                '<details>',
                '<summary>展开问题详解</summary>',
                '',
                question.detailed_answer.strip(),
                '',
                '</details>',
                '',
            ])

        if question.source_url:
            lines.append(f'来源：<{question.source_url}>')
            lines.append('')

        lines.append('---')
        lines.append('')

    while lines and not lines[-1].strip():
        lines.pop()

    return '\n'.join(lines) + '\n'
