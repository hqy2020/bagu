from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.conf import settings
from django.core.cache import cache
from django.db.models import Q, Count
import random
from .models import Category, Question, UserQuestionProgress
from .serializers import (
    CategorySerializer,
    QuestionListSerializer, QuestionQuickReviewSerializer, QuestionDetailSerializer,
)
from .quick_review_presets import get_quick_review_preset
from users.models import BaguUser


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """分类接口"""
    queryset = Category.objects.prefetch_related('subcategories').all()
    serializer_class = CategorySerializer

    def get_serializer_class(self):
        if self.action == 'list':
            return CategorySerializer
        return CategorySerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        user_id = self.request.query_params.get('user_id')
        if not user_id:
            return context

        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            return context

        rows = (
            UserQuestionProgress.objects
            .filter(user_id=user_id_int, is_completed=True)
            .values('question__category_id')
            .annotate(completed_count=Count('id'))
        )
        context['completed_count_map'] = {
            row['question__category_id']: row['completed_count']
            for row in rows
        }
        return context

    def list(self, request, *args, **kwargs):
        if request.query_params.get('user_id'):
            return super().list(request, *args, **kwargs)

        cache_key = _build_cache_key('categories:list', request)
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().list(request, *args, **kwargs)
        _cache_set(cache_key, response.data, settings.API_CACHE_TTL)
        return response

    def retrieve(self, request, *args, **kwargs):
        if request.query_params.get('user_id'):
            return super().retrieve(request, *args, **kwargs)

        cache_key = _build_cache_key('categories:detail', request, lookup=kwargs.get('pk'))
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().retrieve(request, *args, **kwargs)
        _cache_set(cache_key, response.data, settings.API_CACHE_TTL)
        return response

    @action(detail=True, methods=['get'], url_path='quick-review')
    def quick_review(self, request, pk=None):
        """面试前快速复盘小抄（预设内容）。"""
        category = self.get_object()
        preset = get_quick_review_preset(category.name)
        if not preset:
            return Response({'detail': f'分类“{category.name}”暂未配置快速复盘小抄'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'category_id': category.id,
            'category_name': category.name,
            **preset,
        })


class QuestionViewSet(viewsets.ReadOnlyModelViewSet):
    """题目接口"""
    queryset = Question.objects.select_related('category', 'sub_category').all()

    def get_serializer_class(self):
        if self.action == 'list':
            return QuestionListSerializer
        return QuestionDetailSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        user_id = self.request.query_params.get('user_id')
        if not user_id:
            return context

        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            return context

        completed_ids = set(
            UserQuestionProgress.objects
            .filter(user_id=user_id_int, is_completed=True)
            .values_list('question_id', flat=True)
        )
        context['completed_question_ids'] = completed_ids
        return context

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

    def list(self, request, *args, **kwargs):
        # 用户维度有打卡态，不缓存，避免展示延迟
        if request.query_params.get('user_id'):
            return super().list(request, *args, **kwargs)

        cache_key = _build_cache_key('questions:list', request)
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().list(request, *args, **kwargs)
        _cache_set(cache_key, response.data, settings.API_CACHE_TTL)
        return response

    def retrieve(self, request, *args, **kwargs):
        if request.query_params.get('user_id'):
            return super().retrieve(request, *args, **kwargs)

        cache_key = _build_cache_key('questions:detail', request, lookup=kwargs.get('pk'))
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().retrieve(request, *args, **kwargs)
        _cache_set(cache_key, response.data, settings.API_CACHE_TTL)
        return response

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

    @action(detail=False, methods=['get'], url_path='quick-review')
    def quick_review(self, request):
        """
        快速复习（按分类拉取题目 + 关键要点）。

        Query params:
          - category: 必填
          - user_id: 可选，用于返回 is_completed
        """
        category_id = request.query_params.get('category')
        if not category_id:
            return Response({'detail': '缺少 category'}, status=status.HTTP_400_BAD_REQUEST)

        qs = (
            Question.objects
            .select_related('category', 'sub_category')
            .filter(category_id=category_id)
            .order_by('sub_category__sort_order', 'id')
        )
        serializer = QuestionQuickReviewSerializer(qs, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def completion(self, request, pk=None):
        """手动标记某题完成/未完成"""
        user_id = request.data.get('user_id')
        completed = bool(request.data.get('completed', True))

        if not user_id:
            return Response({'detail': '缺少 user_id'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = BaguUser.objects.get(pk=user_id)
        except BaguUser.DoesNotExist:
            return Response({'detail': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)

        question = self.get_object()
        progress, _ = UserQuestionProgress.objects.get_or_create(
            user=user,
            question=question,
            defaults={'is_completed': completed},
        )

        if completed:
            progress.mark_completed()
        else:
            progress.mark_incomplete()

        return Response({
            'user_id': user.id,
            'question_id': question.id,
            'is_completed': progress.is_completed,
            'completed_at': progress.completed_at,
        })


def _build_cache_key(prefix, request, lookup=None):
    pairs = sorted((key, value) for key, value in request.query_params.items())
    params = '&'.join(f'{k}={v}' for k, v in pairs)
    if lookup is not None:
        return f'api:{prefix}:{lookup}:{params}'
    return f'api:{prefix}:{params}'


def _cache_get(key):
    try:
        return cache.get(key)
    except Exception:
        # Redis 不可用时降级为直查 DB
        return None


def _cache_set(key, value, timeout):
    try:
        cache.set(key, value, timeout)
    except Exception:
        # Redis 不可用时降级为直查 DB
        return None
