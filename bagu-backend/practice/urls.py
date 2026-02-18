from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('answers', views.AnswerRecordViewSet, basename='answers')
router.register('ai-models', views.AiModelConfigViewSet, basename='ai-models')

urlpatterns = [
    path('answers/submit/', views.submit_answer, name='submit-answer'),
    path('answers/submit-stream/', views.submit_answer_stream, name='submit-answer-stream'),
    path('', include(router.urls)),
]
