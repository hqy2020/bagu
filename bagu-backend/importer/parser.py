"""Markdown 八股文解析器 - 兼容两种 frontmatter 格式"""
import re
import frontmatter


def parse_bagu_md(filepath):
    """解析八股文 Markdown 文件，返回结构化数据"""
    post = frontmatter.load(filepath)

    # 提取 frontmatter 信息
    meta = post.metadata
    content = post.content

    # 标题：优先 frontmatter.title，否则从正文 # 提取
    title = meta.get('title', '')
    if not title:
        title_match = re.match(r'^#\s+(.+?)[\s？?]*$', content, re.MULTILINE)
        title = title_match.group(1).strip() if title_match else filepath.stem

    # 来源链接
    source_url = meta.get('source', '')
    if isinstance(source_url, list):
        source_url = source_url[0] if source_url else ''
    source_url = str(source_url).strip('"\'')

    # 标签
    tags = meta.get('tags', [])
    if isinstance(tags, str):
        tags = [tags]

    # 分段提取内容
    sections = _split_sections(content)

    # 关键要点：提取列表项
    key_points = _extract_key_points(sections.get('关键要点', ''))

    return {
        'title': title,
        'brief_answer': sections.get('回答话术', ''),
        'detailed_answer': sections.get('问题详解', ''),
        'key_points': key_points,
        'source_url': source_url if source_url.startswith('http') else '',
        'tags': tags,
    }


def _split_sections(content):
    """按 ## 标题分割内容为 dict"""
    sections = {}
    current_section = None
    current_lines = []

    for line in content.split('\n'):
        h2_match = re.match(r'^##\s+(.+)$', line)
        if h2_match:
            if current_section:
                sections[current_section] = '\n'.join(current_lines).strip()
            current_section = h2_match.group(1).strip()
            current_lines = []
        else:
            current_lines.append(line)

    if current_section:
        sections[current_section] = '\n'.join(current_lines).strip()

    return sections


def _extract_key_points(text):
    """从关键要点部分提取要点列表"""
    if not text:
        return []
    points = []
    for line in text.split('\n'):
        # 匹配 - xxx 或 * xxx 格式
        match = re.match(r'^[-*]\s+(.+)$', line.strip())
        if match:
            point = match.group(1).strip()
            # 去掉 **加粗** 标记，保留内容
            point = re.sub(r'\*\*(.+?)\*\*', r'\1', point)
            points.append(point)
    return points
