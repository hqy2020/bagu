from django.db import models


class Category(models.Model):
    """八股文大分类：Redis/并发编程/消息队列 等"""
    name = models.CharField('分类名', max_length=50, unique=True)
    icon = models.CharField('图标标识', max_length=50, default='book')
    sort_order = models.IntegerField('排序', default=0)
    question_count = models.IntegerField('题目数', default=0)

    class Meta:
        verbose_name = '分类'
        verbose_name_plural = '分类'
        ordering = ['sort_order']

    def __str__(self):
        return self.name

    def update_count(self):
        self.question_count = self.questions.count()
        self.save(update_fields=['question_count'])


class SubCategory(models.Model):
    """子分类：热门问题/数据结构/线程池 等"""
    category = models.ForeignKey(
        Category, on_delete=models.CASCADE, related_name='subcategories',
        verbose_name='所属分类'
    )
    name = models.CharField('子分类名', max_length=50)
    sort_order = models.IntegerField('排序', default=0)

    class Meta:
        verbose_name = '子分类'
        verbose_name_plural = '子分类'
        ordering = ['sort_order']
        unique_together = ['category', 'name']

    def __str__(self):
        return f'{self.category.name} / {self.name}'


class Question(models.Model):
    """八股文题目"""
    DIFFICULTY_CHOICES = [(i, str(i)) for i in range(1, 6)]

    category = models.ForeignKey(
        Category, on_delete=models.CASCADE, related_name='questions',
        verbose_name='分类'
    )
    sub_category = models.ForeignKey(
        SubCategory, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='questions', verbose_name='子分类'
    )
    title = models.CharField('题目标题', max_length=200)
    brief_answer = models.TextField('回答话术', blank=True, default='')
    detailed_answer = models.TextField('问题详解', blank=True, default='')
    key_points = models.JSONField('关键要点', default=list, blank=True)
    difficulty = models.IntegerField('难度', choices=DIFFICULTY_CHOICES, default=3)
    source_url = models.URLField('来源链接', blank=True, default='')
    tags = models.JSONField('标签', default=list, blank=True)
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        verbose_name = '题目'
        verbose_name_plural = '题目'
        ordering = ['category', 'sub_category', 'id']

    def __str__(self):
        return self.title
