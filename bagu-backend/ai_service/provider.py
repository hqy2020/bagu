"""统一 AI 服务 Provider - 基于 OpenAI 兼容 API"""
import base64
import json
import re
from openai import OpenAI
from .prompts import build_answer_analysis_prompt, FOLLOW_UP_PROMPT, USER_PROFILE_PROMPT, TEXT_CORRECTION_PROMPT, BATTLE_ANALYSIS_PROMPT

# 模型定价表（每百万 token 的价格，单位：元）
# 格式：model_keyword -> (input_price, output_price)
MODEL_PRICING = {
    'DeepSeek-R1': (4.0, 16.0),
    'DeepSeek-V3': (2.0, 8.0),
    'deepseek-chat': (2.0, 8.0),
    'deepseek-reasoner': (4.0, 16.0),
    'qwen': (2.0, 6.0),
    'glm': (1.0, 1.0),
    'grok': (4.0, 12.0),
    'gemini': (2.0, 6.0),
}


def get_model_price(model_name, prompt_tokens, completion_tokens):
    """根据模型名称和 token 数量计算费用（元）"""
    input_price, output_price = 2.0, 8.0  # 默认价格
    for keyword, (ip, op) in MODEL_PRICING.items():
        if keyword.lower() in model_name.lower():
            input_price, output_price = ip, op
            break
    cost = (prompt_tokens * input_price + completion_tokens * output_price) / 1_000_000
    return round(cost, 6)


class AiProvider:
    """通过优云智算 OpenAI 兼容 API 调用 AI 模型"""

    def __init__(self, api_key, base_url='https://api.modelverse.cn/v1/', model_name='deepseek-ai/DeepSeek-R1'):
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.model = model_name

    def analyze_answer(self, title, brief_answer, detailed_answer, key_points, user_answer, roles=None):
        """分析用户回答，返回结构化结果"""
        prompt = build_answer_analysis_prompt(
            title=title,
            brief_answer=brief_answer,
            detailed_answer=detailed_answer,
            key_points=key_points,
            user_answer=user_answer,
            roles=roles,
        )

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0.7,
            max_tokens=2000,
        )

        content = response.choices[0].message.content
        return self._parse_response(content)

    def analyze_answer_stream(self, title, brief_answer, detailed_answer, key_points, user_answer, roles=None):
        """流式分析用户回答，yield (event_type, content) 元组"""
        prompt = build_answer_analysis_prompt(
            title=title,
            brief_answer=brief_answer,
            detailed_answer=detailed_answer,
            key_points=key_points,
            user_answer=user_answer,
            roles=roles,
        )

        stream = self.client.chat.completions.create(
            model=self.model,
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0.7,
            max_tokens=2000,
            stream=True,
            stream_options={'include_usage': True},
        )

        accumulated = ''
        in_thinking = False
        usage_info = None

        for chunk in stream:
            # 捕获 usage 信息（通常在最后一个 chunk）
            if hasattr(chunk, 'usage') and chunk.usage:
                usage_info = {
                    'prompt_tokens': chunk.usage.prompt_tokens or 0,
                    'completion_tokens': chunk.usage.completion_tokens or 0,
                    'total_tokens': chunk.usage.total_tokens or 0,
                }

            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            if delta.content is None:
                continue
            token = delta.content
            accumulated += token

            # 判断 <think> 状态：用累积文本的标签位置判断
            think_open = accumulated.rfind('<think>')
            think_close = accumulated.rfind('</think>')

            if think_open > think_close:
                # 在 <think> 块内
                if not in_thinking:
                    in_thinking = True
                    clean = token.replace('<think>', '')
                    if clean:
                        yield ('thinking', clean)
                else:
                    yield ('thinking', token)
            else:
                if in_thinking:
                    in_thinking = False
                    clean = token.replace('</think>', '')
                    if clean:
                        yield ('content', clean)
                else:
                    clean = token.replace('<think>', '').replace('</think>', '')
                    if clean:
                        yield ('content', clean)

        # 流结束，解析最终结果
        content_text = re.sub(r'<think>.*?</think>', '', accumulated, flags=re.DOTALL).strip()
        result = self._parse_response(content_text)

        # 计算费用
        if usage_info:
            usage_info['cost'] = get_model_price(
                self.model,
                usage_info['prompt_tokens'],
                usage_info['completion_tokens'],
            )
            result['usage'] = usage_info

        yield ('result', result)

    def correct_text(self, text):
        """用 AI 纠正文本中的错别字，返回纠正后的文本"""
        prompt = TEXT_CORRECTION_PROMPT.format(text=text)
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0.3,
            max_tokens=2000,
        )
        content = response.choices[0].message.content or text
        # 去除可能的 <think> 块
        content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
        return content

    def follow_up_stream(self, title, user_answer, score, highlights, missing_points, suggestion, follow_up_history, follow_up_question):
        """流式追问，yield (event_type, content) 元组"""
        prompt = FOLLOW_UP_PROMPT.format(
            title=title,
            user_answer=user_answer,
            score=score,
            highlights='、'.join(highlights) if highlights else '无',
            missing_points='、'.join(missing_points) if missing_points else '无',
            suggestion=suggestion or '无',
            follow_up_history=follow_up_history or '无',
            follow_up_question=follow_up_question,
        )

        stream = self.client.chat.completions.create(
            model=self.model,
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0.7,
            max_tokens=2000,
            stream=True,
        )

        accumulated = ''
        in_thinking = False

        for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            if delta.content is None:
                continue
            token = delta.content
            accumulated += token

            think_open = accumulated.rfind('<think>')
            think_close = accumulated.rfind('</think>')

            if think_open > think_close:
                if not in_thinking:
                    in_thinking = True
                    clean = token.replace('<think>', '')
                    if clean:
                        yield ('thinking', clean)
                else:
                    yield ('thinking', token)
            else:
                if in_thinking:
                    in_thinking = False
                    clean = token.replace('</think>', '')
                    if clean:
                        yield ('content', clean)
                else:
                    clean = token.replace('<think>', '').replace('</think>', '')
                    if clean:
                        yield ('content', clean)

        # 返回完整回答文本
        final_text = re.sub(r'<think>.*?</think>', '', accumulated, flags=re.DOTALL).strip()
        yield ('done', final_text)

    def generate_profile(self, username, total_answers, avg_score, category_data, recent_records):
        """生成用户知识画像，返回结构化结果"""
        prompt = USER_PROFILE_PROMPT.format(
            username=username,
            total_answers=total_answers,
            avg_score=avg_score,
            category_data=category_data,
            recent_records=recent_records,
        )

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0.7,
            max_tokens=2000,
        )

        content = response.choices[0].message.content or ''
        content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
        return self._parse_profile_response(content)

    def battle_analysis_stream(self, title, user_a_name, user_a_answer, user_a_scores,
                                user_b_name, user_b_answer, user_b_scores):
        """流式对战分析，yield (event_type, content) 元组"""
        prompt = BATTLE_ANALYSIS_PROMPT.format(
            title=title,
            user_a_name=user_a_name,
            user_a_answer=user_a_answer,
            user_a_scores=user_a_scores,
            user_b_name=user_b_name,
            user_b_answer=user_b_answer,
            user_b_scores=user_b_scores,
        )

        stream = self.client.chat.completions.create(
            model=self.model,
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0.7,
            max_tokens=2000,
            stream=True,
        )

        accumulated = ''
        in_thinking = False

        for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            if delta.content is None:
                continue
            token = delta.content
            accumulated += token

            think_open = accumulated.rfind('<think>')
            think_close = accumulated.rfind('</think>')

            if think_open > think_close:
                if not in_thinking:
                    in_thinking = True
                    clean = token.replace('<think>', '')
                    if clean:
                        yield ('thinking', clean)
                else:
                    yield ('thinking', token)
            else:
                if in_thinking:
                    in_thinking = False
                    clean = token.replace('</think>', '')
                    if clean:
                        yield ('content', clean)
                else:
                    clean = token.replace('<think>', '').replace('</think>', '')
                    if clean:
                        yield ('content', clean)

        # 解析最终结果
        content_text = re.sub(r'<think>.*?</think>', '', accumulated, flags=re.DOTALL).strip()
        result = self._parse_battle_response(content_text)
        yield ('result', result)

    def synthesize_speech(self, text, tts_model, voice, response_format='mp3'):
        """调用 OpenAI 兼容 /audio/speech 接口，返回 base64 音频"""
        speech = self.client.audio.speech.create(
            model=tts_model,
            voice=voice,
            input=text,
            response_format=response_format,
        )
        if hasattr(speech, 'read'):
            audio_bytes = speech.read()
        elif hasattr(speech, 'content'):
            audio_bytes = speech.content
        else:
            audio_bytes = bytes(speech)
        return base64.b64encode(audio_bytes).decode('utf-8')

    @staticmethod
    def _safe_int(value, default=0):
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    def _parse_response(self, content):
        """从 AI 响应中提取 JSON 结果"""
        # 尝试提取 ```json ... ``` 块
        json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        if json_match:
            text = json_match.group(1)
        else:
            text = content

        try:
            result = json.loads(text)
            role_scores = []
            raw_role_scores = result.get('role_scores', [])
            if isinstance(raw_role_scores, list):
                for idx, item in enumerate(raw_role_scores):
                    if not isinstance(item, dict):
                        continue
                    role_scores.append({
                        'role_key': item.get('role_key') or f'role_{idx + 1}',
                        'role_name': item.get('role_name') or f'角色{idx + 1}',
                        'score': self._safe_int(item.get('score'), 0),
                        'comment': item.get('comment', ''),
                    })

            score = self._safe_int(result.get('score'), 0)
            if score == 0 and role_scores:
                score = round(sum(item['score'] for item in role_scores) / len(role_scores))

            junior_score = self._safe_int(result.get('junior_score'), 0)
            junior_comment = result.get('junior_comment', '')
            mid_score = self._safe_int(result.get('mid_score'), 0)
            mid_comment = result.get('mid_comment', '')
            senior_score = self._safe_int(result.get('senior_score'), 0)
            senior_comment = result.get('senior_comment', '')

            if role_scores:
                if len(role_scores) >= 1:
                    junior_score = role_scores[0]['score']
                    junior_comment = role_scores[0]['comment']
                if len(role_scores) >= 2:
                    mid_score = role_scores[1]['score']
                    mid_comment = role_scores[1]['comment']
                if len(role_scores) >= 3:
                    senior_score = role_scores[2]['score']
                    senior_comment = role_scores[2]['comment']

            return {
                'score': score,
                'highlights': result.get('highlights', []),
                'missing_points': result.get('missing_points', []),
                'suggestion': result.get('suggestion', ''),
                'improved_answer': result.get('improved_answer', ''),
                'role_scores': role_scores,
                # 三级评分字段（向后兼容，旧模型可能不返回）
                'junior_score': junior_score,
                'junior_comment': junior_comment,
                'mid_score': mid_score,
                'mid_comment': mid_comment,
                'senior_score': senior_score,
                'senior_comment': senior_comment,
            }
        except (json.JSONDecodeError, ValueError):
            return {
                'score': 0,
                'highlights': [],
                'missing_points': [],
                'suggestion': content,
                'improved_answer': '',
                'role_scores': [],
                'junior_score': 0,
                'junior_comment': '',
                'mid_score': 0,
                'mid_comment': '',
                'senior_score': 0,
                'senior_comment': '',
            }

    def _parse_profile_response(self, content):
        """从 AI 响应中提取画像 JSON"""
        json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        if json_match:
            text = json_match.group(1)
        else:
            text = content

        try:
            result = json.loads(text)
            return {
                'category_scores': result.get('category_scores', {}),
                'strengths': result.get('strengths', []),
                'weaknesses': result.get('weaknesses', []),
                'suggestions': result.get('suggestions', []),
                'overall_level': result.get('overall_level', 'beginner'),
            }
        except (json.JSONDecodeError, ValueError):
            return None

    def _parse_battle_response(self, content):
        """从 AI 响应中提取对战分析 JSON"""
        json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        if json_match:
            text = json_match.group(1)
        else:
            text = content

        try:
            result = json.loads(text)
            return {
                'winner': result.get('winner', '平局'),
                'score_a': result.get('score_a', 0),
                'score_b': result.get('score_b', 0),
                'summary': result.get('summary', ''),
                'a_can_learn_from_b': result.get('a_can_learn_from_b', []),
                'b_can_learn_from_a': result.get('b_can_learn_from_a', []),
                'common_missing': result.get('common_missing', []),
            }
        except (json.JSONDecodeError, ValueError):
            return {
                'winner': '平局',
                'score_a': 0,
                'score_b': 0,
                'summary': content,
                'a_can_learn_from_b': [],
                'b_can_learn_from_a': [],
                'common_missing': [],
            }


def get_ai_provider():
    """从数据库配置获取默认 AI Provider"""
    from practice.models import AiModelConfig
    config = AiModelConfig.objects.filter(is_enabled=True, is_default=True).first()
    if not config:
        config = AiModelConfig.objects.filter(is_enabled=True).first()
    if not config:
        raise ValueError('未配置 AI 模型，请在 Django Admin 中添加 AI 模型配置')
    return AiProvider(
        api_key=config.api_key,
        base_url=config.base_url,
        model_name=config.model_name,
    ), config.name


def get_ai_provider_by_id(model_id):
    """根据模型 ID 获取 AI Provider"""
    from practice.models import AiModelConfig
    config = AiModelConfig.objects.get(pk=model_id, is_enabled=True)
    return AiProvider(
        api_key=config.api_key,
        base_url=config.base_url,
        model_name=config.model_name,
    ), config.name
