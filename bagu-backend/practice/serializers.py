from rest_framework import serializers
from .models import AnswerRecord, AiModelConfig


class AnswerSubmitSerializer(serializers.Serializer):
    """提交答案的请求"""
    user_id = serializers.IntegerField()
    question_id = serializers.IntegerField()
    answer = serializers.CharField()
    model_id = serializers.IntegerField(required=False)


class AnswerRecordSerializer(serializers.ModelSerializer):
    question_title = serializers.CharField(source='question.title', read_only=True)
    category_name = serializers.CharField(source='question.category.name', read_only=True)

    class Meta:
        model = AnswerRecord
        fields = ['id', 'user', 'question', 'question_title', 'category_name',
                  'user_answer', 'ai_analysis', 'ai_score', 'ai_highlights',
                  'ai_missing_points', 'ai_suggestion', 'ai_improved_answer',
                  'ai_model_name', 'created_at']


class AiModelConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = AiModelConfig
        fields = ['id', 'name', 'provider', 'model_name', 'is_enabled', 'is_default']
