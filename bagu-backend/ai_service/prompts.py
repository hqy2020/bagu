"""AI 答题分析 Prompt 模板"""

ANSWER_ANALYSIS_PROMPT_TEMPLATE = """你是一个 Java 技术面试评审系统，需要按给定角色独立评分并输出统一 JSON。

## 题目
{title}

## 参考资料（仅作事实核验依据，不作为唯一评分标准）

### 标准答案（回答话术）
{brief_answer}

### 详细解析
{detailed_answer}

### 关键要点
{key_points}

## 候选人回答
{user_answer}

---

## 角色配置（按顺序评分）
{roles_section}

请注意：
1. 评分必须贴近真实面试场景，不能把参考资料当作机械 checklist。
2. 允许候选人用不同表达方式答对关键点，不要求逐字复述标准答案。
3. 若回答有明显误区要明确指出，但避免过度苛责。
4. role_scores 的顺序必须与上面的角色配置完全一致。
5. score 为 role_scores 的加权综合分（按角色权重），四舍五入取整。

### 评分区间（每个角色都适用）
- 90-100：该角色视角下表现优秀
- 70-89：该角色视角下表现良好
- 50-69：该角色视角下基本合格
- 30-49：该角色视角下明显不足
- 0-29：该角色视角下基本未涉及

只输出 JSON，不要输出其他内容：

```json
{{
  "role_scores": [
    {{
      "role_key": "角色标识",
      "role_name": "角色名称",
      "score": 0,
      "comment": "一句话评语"
    }}
  ],
  "score": 0,
  "highlights": ["答对的要点1", "答对的要点2"],
  "missing_points": ["遗漏的要点1", "遗漏的要点2"],
  "suggestion": "综合改进建议（一段话）",
  "improved_answer": "基于候选人回答改进后的完整回答话术"
}}
```
"""


DEFAULT_ROLE_DEFINITIONS = [
    {
        'role_key': 'kind_architect_p7',
        'name': '和蔼型 P7 架构师',
        'weight': 40,
        'role_prompt': '你有丰富一线架构与项目落地经验，关注系统设计取舍、稳定性、性能与工程可执行性。你表达方式温和、鼓励式，但会清晰指出关键缺口。',
        'tts_model': 'IndexTeam/IndexTTS-2',
        'voice': 'stephen_chow',
        'voice_label': '沉稳架构师男声',
    },
    {
        'role_key': 'passionate_engineer',
        'name': '技术热情型工程师',
        'weight': 30,
        'role_prompt': '你是刚进入团队但基础扎实的工程师，关注基础原理是否正确、术语是否准确、是否体现动手能力和学习热情。',
        'tts_model': 'IndexTeam/IndexTTS-2',
        'voice': 'jack_cheng',
        'voice_label': '热情技术男声',
    },
    {
        'role_key': 'female_reviewer',
        'name': '细致型女面试官',
        'weight': 30,
        'role_prompt': '你是一位技术过硬、表达清晰的女面试官，关注回答的结构化表达、边界条件、可维护性与团队协作意识，给出细致且专业的反馈。',
        'tts_model': 'IndexTeam/IndexTTS-2',
        'voice': 'crystla_liu',
        'voice_label': '清晰女声',
    },
]


def _normalize_roles(roles):
    if roles:
        normalized = []
        for idx, role in enumerate(roles):
            normalized.append({
                'role_key': getattr(role, 'role_key', '') or f'role_{idx + 1}',
                'name': getattr(role, 'name', '') or f'角色{idx + 1}',
                'weight': int(getattr(role, 'weight', 0) or 0),
                'role_prompt': (getattr(role, 'role_prompt', '') or '').strip(),
                'tts_model': getattr(role, 'tts_model', '') or '',
                'voice': getattr(role, 'voice', '') or '',
                'voice_label': getattr(role, 'voice_label', '') or '',
            })
        if normalized:
            return normalized
    return DEFAULT_ROLE_DEFINITIONS


def _build_roles_section(roles):
    lines = []
    for index, role in enumerate(_normalize_roles(roles), start=1):
        prompt = role.get('role_prompt') or '从真实技术面试视角给出专业评分。'
        voice = role.get('voice') or '未配置'
        voice_label = role.get('voice_label') or '未配置'
        tts_model = role.get('tts_model') or '未配置'
        weight = role.get('weight', 0)
        lines.append(
            f"{index}. [{role['role_key']}] {role['name']}（权重 {weight}%）\n"
            f"   - 角色提示词：{prompt}\n"
            f"   - 专属语音：{voice_label} ({voice}, model={tts_model})"
        )
    return '\n'.join(lines)


def build_answer_analysis_prompt(title, brief_answer, detailed_answer, key_points, user_answer, roles):
    return ANSWER_ANALYSIS_PROMPT_TEMPLATE.format(
        title=title,
        brief_answer=brief_answer,
        detailed_answer=detailed_answer,
        key_points='\n'.join(f'- {p}' for p in key_points) if key_points else '无',
        user_answer=user_answer,
        roles_section=_build_roles_section(roles),
    )


FOLLOW_UP_PROMPT = """你是一位资深 Java 技术面试官，候选人刚刚回答了一道面试题，现在正在向你追问。

## 面试题
{title}

## 候选人的回答
{user_answer}

## AI 评分结果
- 综合得分：{score} 分
- 亮点：{highlights}
- 遗漏：{missing_points}
- 建议：{suggestion}

## 之前的追问记录
{follow_up_history}

## 候选人当前追问
{follow_up_question}

---

请以面试官的身份回答候选人的追问。要求：
1. 针对追问内容给出专业、清晰的解答
2. 如果追问涉及之前遗漏的知识点，详细展开讲解
3. 适当引导候选人深入思考
4. 回答要有条理，可以使用 Markdown 格式
"""


USER_PROFILE_PROMPT = """请根据以下用户的答题数据，生成一份综合知识画像分析。

## 用户信息
- 用户名：{username}
- 总答题数：{total_answers}
- 平均分：{avg_score}

## 各分类答题数据
{category_data}

## 最近答题记录摘要
{recent_records}

---

请输出 JSON 格式的知识画像（不要输出其他内容，只输出 JSON）：

```json
{{
    "category_scores": {{"分类名": 平均分数}},
    "strengths": ["优势领域1", "优势领域2"],
    "weaknesses": ["薄弱领域1", "薄弱领域2"],
    "suggestions": ["学习建议1", "学习建议2", "学习建议3"],
    "overall_level": "beginner 或 intermediate 或 advanced"
}}
```

评判标准：
- 平均分 >= 80 且答题数 >= 20：advanced
- 平均分 >= 60 且答题数 >= 10：intermediate
- 其他：beginner
"""


TEXT_CORRECTION_PROMPT = """请在 Java 后端技术语境下，纠正以下文本中的错别字和明显错误。

要求：
1. 只纠正错别字、拼写错误和明显的笔误
2. 不要改变原意和表述方式
3. 不要添加新内容或优化表达
4. 技术术语纠正（如"哈希吗"→"哈希码"，"死说"→"死锁"，"县城"→"线程"）
5. 如果没有错误，原样返回

请直接输出纠正后的文本，不要添加任何解释或标记。

---

{text}
"""


BATTLE_ANALYSIS_PROMPT = """你是一位资深 Java 技术面试官。两位候选人回答了同一道面试题，请对比分析他们的回答。

## 面试题
{title}

## 候选人 A：{user_a_name}
### 回答内容
{user_a_answer}

### 各模型评分结果
{user_a_scores}

## 候选人 B：{user_b_name}
### 回答内容
{user_b_answer}

### 各模型评分结果
{user_b_scores}

---

请对比分析两位候选人的回答，输出 JSON 格式（不要输出其他内容，只输出 JSON）：

```json
{{
    "winner": "A 或 B 或 平局",
    "score_a": <候选人A综合分>,
    "score_b": <候选人B综合分>,
    "summary": "一句话总结对战结果",
    "a_can_learn_from_b": ["候选人A可以从B学到的点1", "候选人A可以从B学到的点2"],
    "b_can_learn_from_a": ["候选人B可以从A学到的点1", "候选人B可以从A学到的点2"],
    "common_missing": ["两人共同遗漏的点1", "两人共同遗漏的点2"]
}}
```
"""
