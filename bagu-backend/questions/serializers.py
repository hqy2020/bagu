from rest_framework import serializers
from .models import Category, SubCategory, Question


class SubCategorySerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = SubCategory
        fields = ['id', 'name', 'sort_order', 'question_count']

    def get_question_count(self, obj):
        return obj.questions.count()


class CategorySerializer(serializers.ModelSerializer):
    subcategories = SubCategorySerializer(many=True, read_only=True)
    completed_count = serializers.SerializerMethodField()
    completion_rate = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'icon', 'sort_order', 'question_count',
                  'completed_count', 'completion_rate', 'subcategories']

    def get_completed_count(self, obj):
        completed_map = self.context.get('completed_count_map', {})
        return completed_map.get(obj.id, 0)

    def get_completion_rate(self, obj):
        if not obj.question_count:
            return 0
        completed = self.get_completed_count(obj)
        return round(completed * 100 / obj.question_count, 1)


class CategoryListSerializer(serializers.ModelSerializer):
    """简版分类序列化（用于列表）"""
    completed_count = serializers.SerializerMethodField()
    completion_rate = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'icon', 'question_count', 'completed_count', 'completion_rate']

    def get_completed_count(self, obj):
        completed_map = self.context.get('completed_count_map', {})
        return completed_map.get(obj.id, 0)

    def get_completion_rate(self, obj):
        if not obj.question_count:
            return 0
        completed = self.get_completed_count(obj)
        return round(completed * 100 / obj.question_count, 1)


class QuestionListSerializer(serializers.ModelSerializer):
    """题目列表（不含详细内容）"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    sub_category_name = serializers.CharField(source='sub_category.name', read_only=True, default='')
    is_completed = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = ['id', 'title', 'category', 'category_name',
                  'sub_category', 'sub_category_name', 'difficulty', 'tags', 'is_completed']

    def get_is_completed(self, obj):
        completed_question_ids = self.context.get('completed_question_ids')
        if not completed_question_ids:
            return False
        return obj.id in completed_question_ids


class QuestionQuickReviewSerializer(QuestionListSerializer):
    """快速复习：题目列表 + 关键要点（考前扫一遍用）"""

    class Meta(QuestionListSerializer.Meta):
        fields = QuestionListSerializer.Meta.fields + ['key_points']


class QuestionDetailSerializer(serializers.ModelSerializer):
    """题目详情（含完整内容）"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    sub_category_name = serializers.CharField(source='sub_category.name', read_only=True, default='')

    class Meta:
        model = Question
        fields = '__all__'
