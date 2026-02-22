from rest_framework import serializers
from .models import AnswerRecord, AiModelConfig, AiRoleConfig, EvaluationRound, FollowUpQuestion


class AnswerSubmitSerializer(serializers.Serializer):
    """提交答案的请求"""
    user_id = serializers.IntegerField()
    question_id = serializers.IntegerField()
    answer = serializers.CharField()
    model_id = serializers.IntegerField(required=False)
    role_key = serializers.CharField(required=False, allow_blank=True)
    difficulty_level = serializers.ChoiceField(
        choices=['easy', 'medium', 'hard'],
        required=False,
    )


class AnswerRecordSerializer(serializers.ModelSerializer):
    question_title = serializers.CharField(source='question.title', read_only=True)
    category_name = serializers.CharField(source='question.category.name', read_only=True)

    class Meta:
        model = AnswerRecord
        fields = ['id', 'user', 'question', 'question_title', 'category_name',
                  'user_answer', 'corrected_answer', 'ai_analysis', 'ai_score',
                  'ai_highlights', 'ai_missing_points', 'ai_suggestion', 'ai_improved_answer', 'ai_role_scores',
                  'ai_model_name',
                  'ai_junior_score', 'ai_junior_comment',
                  'ai_mid_score', 'ai_mid_comment',
                  'ai_senior_score', 'ai_senior_comment',
                  'round', 'created_at']


class AnswerRecordListSerializer(serializers.ModelSerializer):
    """轻量版 - 用于列表展示（历史记录等）"""
    question_title = serializers.CharField(source='question.title', read_only=True)
    category_name = serializers.CharField(source='question.category.name', read_only=True)

    class Meta:
        model = AnswerRecord
        fields = ['id', 'question', 'question_title', 'category_name',
                  'ai_score', 'ai_model_name', 'created_at']


class EvaluationRoundSerializer(serializers.ModelSerializer):
    scores = serializers.SerializerMethodField()

    class Meta:
        model = EvaluationRound
        fields = ['id', 'user', 'question', 'user_answer', 'composite_score',
                  'model_count', 'completed', 'created_at', 'scores']

    def get_scores(self, obj):
        records = obj.answer_records.all()
        return [
            {'model': r.ai_model_name, 'score': r.ai_score, 'record_id': r.id}
            for r in records
        ]


class FollowUpQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = FollowUpQuestion
        fields = ['id', 'answer_record', 'user_question', 'ai_response',
                  'ai_model_name', 'created_at']


class AiModelConfigSerializer(serializers.ModelSerializer):
    has_api_key = serializers.SerializerMethodField()

    class Meta:
        model = AiModelConfig
        fields = ['id', 'name', 'provider', 'base_url', 'model_name', 'is_enabled', 'is_default', 'has_api_key']

    def get_has_api_key(self, obj):
        return bool(obj.api_key)


class AiModelConfigWriteSerializer(serializers.ModelSerializer):
    api_key = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = AiModelConfig
        fields = ['id', 'name', 'provider', 'api_key', 'base_url', 'model_name', 'is_enabled', 'is_default']

    def update(self, instance, validated_data):
        # 如果没传 api_key 或传空字符串，保留原值
        if 'api_key' in validated_data and not validated_data['api_key']:
            validated_data.pop('api_key')
        return super().update(instance, validated_data)


class AiRoleConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = AiRoleConfig
        fields = [
            'id',
            'role_key',
            'name',
            'role_prompt',
            'tts_model',
            'voice',
            'voice_label',
            'difficulty_level',
            'weight',
            'sort_order',
            'is_enabled',
        ]
