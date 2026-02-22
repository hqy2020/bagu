import uuid
from django.db import models


class EvaluationRound(models.Model):
    """评估轮次 - 一次完整评估（可能包含多个 AI 模型的评分）"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        'users.BaguUser', on_delete=models.CASCADE,
        related_name='evaluation_rounds', verbose_name='用户'
    )
    question = models.ForeignKey(
        'questions.Question', on_delete=models.CASCADE,
        related_name='evaluation_rounds', verbose_name='题目'
    )
    user_answer = models.TextField('用户回答')
    composite_score = models.FloatField('综合评分', default=0.0)
    model_count = models.IntegerField('模型数量', default=0)
    completed = models.BooleanField('是否完成', default=False)
    created_at = models.DateTimeField('创建时间', auto_now_add=True)

    class Meta:
        verbose_name = '评估轮次'
        verbose_name_plural = '评估轮次'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user} - {self.question.title} (综合{self.composite_score}分)'


class AnswerRecord(models.Model):
    """答题记录"""
    user = models.ForeignKey(
        'users.BaguUser', on_delete=models.CASCADE,
        related_name='answer_records', verbose_name='用户'
    )
    question = models.ForeignKey(
        'questions.Question', on_delete=models.CASCADE,
        related_name='answer_records', verbose_name='题目'
    )
    user_answer = models.TextField('用户回答')
    corrected_answer = models.TextField('纠错后回答', blank=True, default='')
    ai_analysis = models.TextField('AI 分析', blank=True, default='')
    ai_score = models.IntegerField('AI 评分', default=0)
    ai_highlights = models.JSONField('答对的点', default=list, blank=True)
    ai_missing_points = models.JSONField('遗漏的点', default=list, blank=True)
    ai_suggestion = models.TextField('改进建议', blank=True, default='')
    ai_improved_answer = models.TextField('AI 改进版答案', blank=True, default='')
    ai_model_name = models.CharField('AI 模型', max_length=100, blank=True, default='')
    ai_role_scores = models.JSONField('角色评分详情', default=list, blank=True)
    # 三级面试官评分
    ai_junior_score = models.IntegerField('初级面试官评分', default=0)
    ai_junior_comment = models.CharField('初级面试官评语', max_length=500, blank=True, default='')
    ai_mid_score = models.IntegerField('中级面试官评分', default=0)
    ai_mid_comment = models.CharField('中级面试官评语', max_length=500, blank=True, default='')
    ai_senior_score = models.IntegerField('高级面试官评分', default=0)
    ai_senior_comment = models.CharField('高级面试官评语', max_length=500, blank=True, default='')
    # 关联评估轮次
    round = models.ForeignKey(
        EvaluationRound, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='answer_records', verbose_name='评估轮次'
    )
    created_at = models.DateTimeField('创建时间', auto_now_add=True)

    class Meta:
        verbose_name = '答题记录'
        verbose_name_plural = '答题记录'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user} - {self.question.title} ({self.ai_score}分)'


class FollowUpQuestion(models.Model):
    """追问记录"""
    answer_record = models.ForeignKey(
        AnswerRecord, on_delete=models.CASCADE,
        related_name='follow_ups', verbose_name='答题记录'
    )
    user_question = models.TextField('用户追问')
    ai_response = models.TextField('AI 回答')
    ai_model_name = models.CharField('AI 模型', max_length=100, blank=True, default='')
    created_at = models.DateTimeField('创建时间', auto_now_add=True)

    class Meta:
        verbose_name = '追问记录'
        verbose_name_plural = '追问记录'
        ordering = ['created_at']

    def __str__(self):
        return f'追问: {self.user_question[:30]}...'


class AiModelConfig(models.Model):
    """AI 模型配置"""
    name = models.CharField('模型显示名', max_length=100)
    provider = models.CharField('供应商', max_length=50, default='compshare')
    api_key = models.CharField('API Key', max_length=200)
    base_url = models.URLField('API Base URL', default='https://api.modelverse.cn/v1/')
    model_name = models.CharField(
        '模型标识', max_length=200,
        default='deepseek-ai/DeepSeek-R1',
        help_text='如 deepseek-ai/DeepSeek-R1'
    )
    is_enabled = models.BooleanField('是否启用', default=True)
    is_default = models.BooleanField('是否默认', default=False)

    class Meta:
        verbose_name = 'AI 模型配置'
        verbose_name_plural = 'AI 模型配置'

    def __str__(self):
        return f'{self.name} ({"默认" if self.is_default else "备用"})'

    def save(self, *args, **kwargs):
        if self.is_default:
            AiModelConfig.objects.filter(is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class AiRoleConfig(models.Model):
    """AI 角色配置（用于角色评分与语音绑定）"""
    DIFFICULTY_CHOICES = [
        ('easy', '简单'),
        ('medium', '中等'),
        ('hard', '困难'),
    ]

    role_key = models.CharField(
        '角色标识',
        max_length=50,
        unique=True,
        help_text='如 kind_architect / passionate_engineer / female_reviewer',
    )
    name = models.CharField('角色名称', max_length=100)
    role_prompt = models.TextField(
        '角色提示词',
        default='',
        help_text='该角色的评分风格、关注点与输出要求',
    )
    tts_model = models.CharField(
        'TTS 模型',
        max_length=100,
        default='IndexTeam/IndexTTS-2',
        help_text='参考 ModelVerse 文档，如 IndexTeam/IndexTTS-2',
    )
    voice = models.CharField(
        'TTS 音色',
        max_length=120,
        blank=True,
        default='jack_cheng',
        help_text='ModelVerse /v1/audio/speech 的 voice 字段值（内置名或 uspeech:xxxx）',
    )
    voice_label = models.CharField('音色说明', max_length=100, blank=True, default='')
    difficulty_level = models.CharField(
        '难度等级',
        max_length=20,
        choices=DIFFICULTY_CHOICES,
        default='medium',
        help_text='该角色对应的面试难度',
    )
    weight = models.IntegerField('评分权重(%)', default=33)
    sort_order = models.IntegerField('排序', default=0)
    is_enabled = models.BooleanField('是否启用', default=True)

    class Meta:
        verbose_name = 'AI 角色配置'
        verbose_name_plural = 'AI 角色配置'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.name} ({self.role_key})'
