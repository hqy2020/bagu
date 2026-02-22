"""Markdown 八股文解析器。"""

from pathlib import Path
import re

import frontmatter

URL_PATTERN = re.compile(r'https?://[^\s<>"\')\]]+')
TOP_URL_PATTERN = re.compile(r'^(?:链接|来源)[:：]\s*(https?://\S+)\s*$')
H1_LINE_PATTERN = re.compile(r'^\s*#\s+(.+?)\s*$')
SECTION_PATTERN = re.compile(r'^\s*##\s+(.+?)\s*$')
FENCE_OPEN_PATTERN = re.compile(r'^\s*```')
FENCE_CLOSE_PATTERN = re.compile(r'^\s*```\s*$')
META_LINE_PATTERN = re.compile(r'^\s*([A-Za-z0-9_\-\u4e00-\u9fa5]+)\s*:\s*(.*?)\s*$')
TITLE_PREFIX_PATTERN = re.compile(
    r'^\s*(?:[✅☑✔️]\s*)*(?:(?:\(?\d+\)?|[一二三四五六七八九十]+)\s*[.、,，:：)\）]\s*)*'
)
BUSINESS_DOMAINS = ('yuque.com', 'feishu.cn')


def parse_bagu_md(filepath):
    """解析八股文 Markdown 文件，返回结构化数据。"""
    filepath = Path(filepath)
    raw_text = filepath.read_text(encoding='utf-8', errors='ignore')
    post = frontmatter.loads(raw_text)

    meta = dict(post.metadata or {})
    content = post.content or ''

    fenced_meta, content = _extract_fenced_meta(content)
    merged_meta = {**fenced_meta, **meta}

    title = _extract_title(merged_meta, content, filepath.stem)
    source_url = _extract_source_url(merged_meta, content)
    clean_content = _strip_leading_source_lines(content)
    sections = _split_sections(clean_content)

    brief_answer = sections.get('回答话术', '').strip()
    if not brief_answer:
        brief_answer = _extract_first_paragraph(clean_content)

    detailed_answer = sections.get('问题详解', '').strip()
    if not detailed_answer:
        detailed_answer = clean_content.strip()

    key_points = _extract_key_points(sections.get('关键要点', ''))
    tags = _normalize_tags(merged_meta.get('tags', []))

    return {
        'title': title,
        'brief_answer': brief_answer,
        'detailed_answer': detailed_answer,
        'key_points': key_points,
        'source_url': source_url,
        'tags': tags,
    }


def _extract_source_url(meta, content):
    # 优先取正文前部业务链接（飞书/语雀导出格式）
    business_url = _extract_first_url(content, business_only=True)
    if business_url:
        return business_url

    # 回退到 frontmatter/source 字段
    source_meta = meta.get('source', '')
    if isinstance(source_meta, list):
        for item in source_meta:
            cleaned = _clean_url(str(item))
            if cleaned:
                return cleaned
    else:
        cleaned = _clean_url(str(source_meta))
        if cleaned:
            return cleaned

    # 最后回退正文前部任意链接，兼容历史样本
    return _extract_first_url(content, business_only=False)


def _extract_title(meta, content, fallback_stem):
    title = str(meta.get('title') or '').strip()
    if not title:
        title = _extract_first_h1_outside_fence(content) or fallback_stem
    return _clean_title(title)


def _clean_title(title):
    title = re.sub(r'^\s*[✅☑✔️]+\s*', '', title or '')
    title = TITLE_PREFIX_PATTERN.sub('', title)
    title = re.sub(r'\s+', ' ', title).strip()
    return title or '未命名题目'


def _extract_fenced_meta(content):
    """解析语雀导出中顶部代码块元信息。"""
    lines = content.split('\n')
    idx = 0
    while idx < len(lines):
        stripped = lines[idx].strip()
        if not stripped:
            idx += 1
            continue
        # 兼容语雀“首行链接 + 元数据代码块”格式
        if TOP_URL_PATTERN.match(stripped) or _extract_url_from_text(stripped):
            idx += 1
            continue
        break

    if idx >= len(lines) or not FENCE_OPEN_PATTERN.match(lines[idx]):
        return {}, content

    close_idx = idx + 1
    while close_idx < len(lines):
        if FENCE_CLOSE_PATTERN.match(lines[close_idx]):
            break
        close_idx += 1

    if close_idx >= len(lines):
        return {}, content

    block = lines[idx + 1:close_idx]
    parsed = {}
    valid_pairs = 0
    for raw_line in block:
        match = META_LINE_PATTERN.match(raw_line)
        if not match:
            continue
        key = match.group(1).strip().lower()
        value = match.group(2).strip()
        parsed[key] = value
        valid_pairs += 1

    # 非 metadata 代码块（比如示例代码）不应吞掉正文
    if valid_pairs == 0:
        return {}, content

    remain = '\n'.join(lines[:idx] + lines[close_idx + 1:]).lstrip('\n')
    return parsed, remain


def _strip_leading_source_lines(content):
    lines = content.split('\n')
    idx = 0
    while idx < len(lines):
        stripped = lines[idx].strip()
        if not stripped:
            idx += 1
            continue
        if TOP_URL_PATTERN.match(stripped):
            idx += 1
            continue
        if _extract_url_from_text(stripped):
            idx += 1
            continue
        break
    return '\n'.join(lines[idx:]).strip()


def _split_sections(content):
    """按 ## 标题分割内容为 dict。"""
    sections = {}
    current_section = None
    current_lines = []

    for line in content.split('\n'):
        h2_match = SECTION_PATTERN.match(line)
        if h2_match:
            if current_section:
                sections[current_section] = '\n'.join(current_lines).strip()
            current_section = h2_match.group(1).strip()
            current_lines = []
            continue
        current_lines.append(line)

    if current_section:
        sections[current_section] = '\n'.join(current_lines).strip()

    return sections


def _extract_first_h1_outside_fence(content):
    in_fence = False
    for line in content.split('\n'):
        if FENCE_OPEN_PATTERN.match(line.strip()):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        match = H1_LINE_PATTERN.match(line)
        if match:
            return match.group(1).strip()
    return ''


def _extract_key_points(text):
    """从关键要点部分提取要点列表。"""
    if not text:
        return []
    points = []
    for line in text.split('\n'):
        match = re.match(r'^(?:[-*]|\d+[.、)])\s+(.+)$', line.strip())
        if not match:
            continue
        point = match.group(1).strip()
        point = re.sub(r'\*\*(.+?)\*\*', r'\1', point)
        if point:
            points.append(point)
    return points


def _normalize_tags(tags):
    if isinstance(tags, list):
        raw_items = tags
    elif isinstance(tags, str):
        raw_items = re.split(r'[,，]', tags)
    else:
        raw_items = []

    normalized = []
    for item in raw_items:
        value = str(item).strip().strip('"\'')
        if value:
            normalized.append(value)
    return normalized


def _extract_first_paragraph(content):
    blocks = re.split(r'\n\s*\n', content.strip())
    for block in blocks:
        text = block.strip()
        if not text:
            continue
        if text.startswith('#'):
            continue
        if _extract_url_from_text(text):
            continue
        return text
    return ''


def _extract_first_url(content, business_only):
    for raw_line in content.split('\n')[:40]:
        line = raw_line.strip()
        if not line:
            continue

        prefixed = TOP_URL_PATTERN.match(line)
        if prefixed:
            candidate = _clean_url(prefixed.group(1))
            if candidate and (not business_only or _is_business_url(candidate)):
                return candidate

        candidate = _extract_url_from_text(line)
        if not candidate:
            continue
        if business_only and not _is_business_url(candidate):
            continue
        return candidate
    return ''


def _extract_url_from_text(text):
    match = URL_PATTERN.search(text or '')
    if not match:
        return ''
    return _clean_url(match.group(0))


def _clean_url(url):
    url = str(url or '').strip().strip('"\'' )
    if not url.startswith('http'):
        return ''
    return url.rstrip('.,;:!)]}>，。；：！？')


def _is_business_url(url):
    return any(domain in url for domain in BUSINESS_DOMAINS)
