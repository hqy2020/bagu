from django.db import models


class BaguUser(models.Model):
    """八股刷题用户（非 Django Auth User，简单用户模型）"""
    ROLE_CHOICES = [
        (0, '普通用户'),
        (1, '管理员'),
    ]
    username = models.CharField('用户名', max_length=50, unique=True)
    nickname = models.CharField('昵称', max_length=50, blank=True, default='')
    role = models.IntegerField('角色', choices=ROLE_CHOICES, default=0)
    total_answers = models.IntegerField('总答题数', default=0)
    avg_score = models.FloatField('平均分', default=0.0)
    created_at = models.DateTimeField('创建时间', auto_now_add=True)

    class Meta:
        verbose_name = '用户'
        verbose_name_plural = '用户'

    def __str__(self):
        return self.nickname or self.username


class UserProfile(models.Model):
    """用户知识画像"""
    LEVEL_CHOICES = [
        ('beginner', '入门'),
        ('intermediate', '熟练'),
        ('advanced', '精通'),
    ]
    user = models.OneToOneField(
        BaguUser, on_delete=models.CASCADE, related_name='profile',
        verbose_name='用户'
    )
    category_scores = models.JSONField(
        '分类评分', default=dict, blank=True,
        help_text='{"Redis": 85, "并发编程": 60}'
    )
    strengths = models.JSONField('优势领域', default=list, blank=True)
    weaknesses = models.JSONField('薄弱领域', default=list, blank=True)
    suggestions = models.JSONField('学习建议', default=list, blank=True)
    overall_level = models.CharField(
        '综合水平', max_length=20, choices=LEVEL_CHOICES, default='beginner'
    )
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        verbose_name = '用户画像'
        verbose_name_plural = '用户画像'

    def __str__(self):
        return f'{self.user} 的画像'
