from django.db import models


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
    ai_analysis = models.TextField('AI 分析', blank=True, default='')
    ai_score = models.IntegerField('AI 评分', default=0)
    ai_highlights = models.JSONField('答对的点', default=list, blank=True)
    ai_missing_points = models.JSONField('遗漏的点', default=list, blank=True)
    ai_suggestion = models.TextField('改进建议', blank=True, default='')
    ai_improved_answer = models.TextField('AI 改进版答案', blank=True, default='')
    ai_model_name = models.CharField('AI 模型', max_length=100, blank=True, default='')
    created_at = models.DateTimeField('创建时间', auto_now_add=True)

    class Meta:
        verbose_name = '答题记录'
        verbose_name_plural = '答题记录'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user} - {self.question.title} ({self.ai_score}分)'


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
