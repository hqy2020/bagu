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

    class Meta:
        model = Category
        fields = ['id', 'name', 'icon', 'sort_order', 'question_count', 'subcategories']


class CategoryListSerializer(serializers.ModelSerializer):
    """简版分类序列化（用于列表）"""
    class Meta:
        model = Category
        fields = ['id', 'name', 'icon', 'question_count']


class QuestionListSerializer(serializers.ModelSerializer):
    """题目列表（不含详细内容）"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    sub_category_name = serializers.CharField(source='sub_category.name', read_only=True, default='')

    class Meta:
        model = Question
        fields = ['id', 'title', 'category', 'category_name',
                  'sub_category', 'sub_category_name', 'difficulty', 'tags']


class QuestionDetailSerializer(serializers.ModelSerializer):
    """题目详情（含完整内容）"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    sub_category_name = serializers.CharField(source='sub_category.name', read_only=True, default='')

    class Meta:
        model = Question
        fields = '__all__'
