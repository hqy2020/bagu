from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
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
