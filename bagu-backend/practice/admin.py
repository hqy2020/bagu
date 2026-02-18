from django.contrib import admin
from .models import AnswerRecord, AiModelConfig


@admin.register(AnswerRecord)
class AnswerRecordAdmin(admin.ModelAdmin):
    list_display = ['user', 'question', 'ai_score', 'ai_model_name', 'created_at']
    list_filter = ['ai_model_name', 'created_at']
    search_fields = ['question__title']
    readonly_fields = ['created_at']


@admin.register(AiModelConfig)
class AiModelConfigAdmin(admin.ModelAdmin):
    list_display = ['name', 'provider', 'model_name', 'is_enabled', 'is_default']
    list_filter = ['provider', 'is_enabled']
    list_editable = ['is_enabled', 'is_default']
