from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('answers', views.AnswerRecordViewSet, basename='answers')
router.register('ai-models', views.AiModelConfigViewSet, basename='ai-models')
router.register('ai-roles', views.AiRoleConfigViewSet, basename='ai-roles')

urlpatterns = [
    path('answers/submit/', views.submit_answer, name='submit-answer'),
    path('answers/submit-stream/', views.submit_answer_stream, name='submit-answer-stream'),
    path('answers/question-history/', views.get_question_history, name='question-history'),
    path('answers/follow-up/', views.follow_up_stream, name='follow-up'),
    path('answers/battle-analysis/', views.battle_analysis_stream, name='battle-analysis'),
    path('rounds/create/', views.create_evaluation_round, name='create-round'),
    path('rounds/<uuid:round_id>/finalize/', views.finalize_round, name='finalize-round'),
    path('', include(router.urls)),
]
