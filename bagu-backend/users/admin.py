from django.contrib import admin
from .models import BaguUser, UserProfile


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    extra = 0


@admin.register(BaguUser)
class BaguUserAdmin(admin.ModelAdmin):
    list_display = ['username', 'nickname', 'role', 'total_answers', 'avg_score']
    list_filter = ['role']
    inlines = [UserProfileInline]


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'overall_level', 'updated_at']
    list_filter = ['overall_level']
