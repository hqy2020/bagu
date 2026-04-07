from django.core.management import call_command
from django.core.management.base import BaseCommand

from practice.models import AiModelConfig
from questions.models import Category, Question, SubCategory


class Command(BaseCommand):
    help = '首次启动时自动加载内置题库和默认 AI 模型配置'

    def handle(self, *args, **options):
        if Category.objects.exists() or SubCategory.objects.exists() or Question.objects.exists():
            self.stdout.write('题库数据已存在，跳过内置题库导入')
        else:
            call_command('loaddata', 'builtin_questions', verbosity=0)
            self.stdout.write(self.style.SUCCESS('已加载内置题库'))

        if AiModelConfig.objects.exists():
            self.stdout.write('AI 模型配置已存在，跳过默认模型导入')
        else:
            call_command('loaddata', 'builtin_ai_models', verbosity=0)
            self.stdout.write(self.style.SUCCESS('已加载默认 AI 模型配置'))
