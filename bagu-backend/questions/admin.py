from django.contrib import admin
from .models import Category, SubCategory, Question, UserQuestionProgress


class SubCategoryInline(admin.TabularInline):
    model = SubCategory
    extra = 0


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'icon', 'question_count', 'sort_order']
    list_editable = ['sort_order']
    inlines = [SubCategoryInline]


@admin.register(SubCategory)
class SubCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'sort_order']
    list_filter = ['category']
    list_editable = ['sort_order']


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'sub_category', 'difficulty', 'created_at']
    list_filter = ['category', 'sub_category', 'difficulty']
    search_fields = ['title', 'brief_answer']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(UserQuestionProgress)
class UserQuestionProgressAdmin(admin.ModelAdmin):
    list_display = ['user', 'question', 'is_completed', 'completed_at', 'updated_at']
    list_filter = ['is_completed', 'question__category']
    search_fields = ['user__username', 'user__nickname', 'question__title']
    readonly_fields = ['created_at', 'updated_at']
