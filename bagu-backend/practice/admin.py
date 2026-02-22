from django.contrib import admin
from .models import AnswerRecord, AiModelConfig, AiRoleConfig, EvaluationRound, FollowUpQuestion


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


@admin.register(AiRoleConfig)
class AiRoleConfigAdmin(admin.ModelAdmin):
    list_display = ['name', 'role_key', 'difficulty_level', 'voice', 'tts_model', 'weight', 'is_enabled', 'sort_order']
    list_filter = ['is_enabled', 'difficulty_level']
    list_editable = ['weight', 'is_enabled', 'sort_order']
    search_fields = ['name', 'role_key', 'voice', 'role_prompt']


@admin.register(EvaluationRound)
class EvaluationRoundAdmin(admin.ModelAdmin):
    list_display = ['user', 'question', 'composite_score', 'model_count', 'completed', 'created_at']
    list_filter = ['completed', 'created_at']
    readonly_fields = ['created_at']


@admin.register(FollowUpQuestion)
class FollowUpQuestionAdmin(admin.ModelAdmin):
    list_display = ['answer_record', 'user_question', 'ai_model_name', 'created_at']
    list_filter = ['ai_model_name', 'created_at']
    readonly_fields = ['created_at']
