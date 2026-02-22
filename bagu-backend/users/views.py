from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Avg
from .models import BaguUser, UserProfile
from .serializers import BaguUserSerializer, BaguUserDetailSerializer, UserProfileSerializer


class BaguUserViewSet(viewsets.ModelViewSet):
    """用户接口"""
    queryset = BaguUser.objects.all()

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return BaguUserDetailSerializer
        return BaguUserSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        # 创建用户时自动创建画像
        UserProfile.objects.get_or_create(user=user)

    @action(detail=True, methods=['get'])
    def profile(self, request, pk=None):
        """获取用户画像"""
        user = self.get_object()
        profile, _ = UserProfile.objects.get_or_create(user=user)
        return Response(UserProfileSerializer(profile).data)

    @action(detail=True, methods=['post'])
    def generate_profile(self, request, pk=None):
        """一键生成 AI 知识画像"""
        from practice.models import AnswerRecord
        from ai_service.provider import get_ai_provider

        user = self.get_object()
        profile, _ = UserProfile.objects.get_or_create(user=user)

        # 聚合分类数据
        records = AnswerRecord.objects.filter(user=user).select_related(
            'question', 'question__category'
        ).order_by('-created_at')[:50]

        if not records.exists():
            return Response(
                {'detail': '暂无答题记录，无法生成画像'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 按分类聚合
        category_stats = {}
        for r in records:
            cat_name = r.question.category.name
            if cat_name not in category_stats:
                category_stats[cat_name] = {'scores': [], 'count': 0}
            category_stats[cat_name]['scores'].append(r.ai_score)
            category_stats[cat_name]['count'] += 1

        category_data_lines = []
        for cat, stat in category_stats.items():
            avg = round(sum(stat['scores']) / len(stat['scores']), 1)
            category_data_lines.append(f"- {cat}：{stat['count']} 题，平均 {avg} 分")
        category_data = '\n'.join(category_data_lines)

        # 最近记录摘要
        recent_lines = []
        for r in records[:20]:
            highlights = '、'.join(r.ai_highlights[:3]) if r.ai_highlights else '无'
            missing = '、'.join(r.ai_missing_points[:3]) if r.ai_missing_points else '无'
            recent_lines.append(
                f"- [{r.question.category.name}] {r.question.title}: "
                f"{r.ai_score}分 | 亮点: {highlights} | 不足: {missing}"
            )
        recent_records = '\n'.join(recent_lines)

        try:
            provider, _ = get_ai_provider()
            result = provider.generate_profile(
                username=user.nickname or user.username,
                total_answers=user.total_answers,
                avg_score=user.avg_score,
                category_data=category_data,
                recent_records=recent_records,
            )
        except Exception as e:
            return Response(
                {'detail': f'AI 生成画像失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if not result:
            return Response(
                {'detail': 'AI 返回结果解析失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # 更新画像
        profile.category_scores = result['category_scores']
        profile.strengths = result['strengths']
        profile.weaknesses = result['weaknesses']
        profile.suggestions = result['suggestions']
        profile.overall_level = result['overall_level']
        profile.save()

        return Response(UserProfileSerializer(profile).data)
