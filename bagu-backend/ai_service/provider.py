"""统一 AI 服务 Provider - 基于 OpenAI 兼容 API"""
import json
import re
from openai import OpenAI
from .prompts import ANSWER_ANALYSIS_PROMPT

# 模型定价表（每百万 token 的价格，单位：元）
# 格式：model_keyword -> (input_price, output_price)
MODEL_PRICING = {
    'DeepSeek-R1': (4.0, 16.0),
    'DeepSeek-V3': (2.0, 8.0),
    'deepseek-chat': (2.0, 8.0),
    'deepseek-reasoner': (4.0, 16.0),
    'qwen': (2.0, 6.0),
    'glm': (1.0, 1.0),
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

    def analyze_answer(self, title, brief_answer, detailed_answer, key_points, user_answer):
        """分析用户回答，返回结构化结果"""
        prompt = ANSWER_ANALYSIS_PROMPT.format(
            title=title,
            brief_answer=brief_answer,
            detailed_answer=detailed_answer,
            key_points='\n'.join(f'- {p}' for p in key_points) if key_points else '无',
            user_answer=user_answer,
        )

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0.7,
            max_tokens=2000,
        )

        content = response.choices[0].message.content
        return self._parse_response(content)

    def analyze_answer_stream(self, title, brief_answer, detailed_answer, key_points, user_answer):
        """流式分析用户回答，yield (event_type, content) 元组"""
        prompt = ANSWER_ANALYSIS_PROMPT.format(
            title=title,
            brief_answer=brief_answer,
            detailed_answer=detailed_answer,
            key_points='\n'.join(f'- {p}' for p in key_points) if key_points else '无',
            user_answer=user_answer,
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
            return {
                'score': int(result.get('score', 0)),
                'highlights': result.get('highlights', []),
                'missing_points': result.get('missing_points', []),
                'suggestion': result.get('suggestion', ''),
                'improved_answer': result.get('improved_answer', ''),
            }
        except (json.JSONDecodeError, ValueError):
            return {
                'score': 0,
                'highlights': [],
                'missing_points': [],
                'suggestion': content,
                'improved_answer': '',
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
