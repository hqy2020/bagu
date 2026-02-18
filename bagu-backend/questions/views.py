from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
import random
from .models import Category, SubCategory, Question
from .serializers import (
    CategorySerializer, CategoryListSerializer,
    QuestionListSerializer, QuestionDetailSerializer,
)


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """分类接口"""
    queryset = Category.objects.prefetch_related('subcategories').all()
    serializer_class = CategorySerializer

    def get_serializer_class(self):
        if self.action == 'list':
            return CategorySerializer
        return CategorySerializer


class QuestionViewSet(viewsets.ReadOnlyModelViewSet):
    """题目接口"""
    queryset = Question.objects.select_related('category', 'sub_category').all()

    def get_serializer_class(self):
        if self.action == 'list':
            return QuestionListSerializer
        return QuestionDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        category_id = self.request.query_params.get('category')
        sub_category_id = self.request.query_params.get('sub_category')
        search = self.request.query_params.get('search')

        if category_id:
            qs = qs.filter(category_id=category_id)
        if sub_category_id:
            qs = qs.filter(sub_category_id=sub_category_id)
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(tags__contains=search))
        return qs

    @action(detail=False, methods=['get'])
    def random(self, request):
        """随机出题"""
        qs = self.get_queryset()
        category_id = request.query_params.get('category')
        if category_id:
            qs = qs.filter(category_id=category_id)

        count = qs.count()
        if count == 0:
            return Response({'detail': '没有题目'}, status=status.HTTP_404_NOT_FOUND)

        question = qs[random.randint(0, count - 1)]
        serializer = QuestionDetailSerializer(question)
        return Response(serializer.data)
