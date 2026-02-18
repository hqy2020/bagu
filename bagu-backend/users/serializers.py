from rest_framework import serializers
from .models import BaguUser, UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['category_scores', 'strengths', 'weaknesses',
                  'suggestions', 'overall_level', 'updated_at']


class BaguUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = BaguUser
        fields = ['id', 'username', 'nickname', 'role', 'total_answers', 'avg_score']


class BaguUserDetailSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = BaguUser
        fields = ['id', 'username', 'nickname', 'role', 'total_answers',
                  'avg_score', 'created_at', 'profile']
