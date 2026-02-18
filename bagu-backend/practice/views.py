import json
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from django.db.models import Avg
from django.http import StreamingHttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .models import AnswerRecord, AiModelConfig
from .serializers import AnswerSubmitSerializer, AnswerRecordSerializer, AiModelConfigSerializer
from questions.models import Question
from users.models import BaguUser
from ai_service.provider import AiProvider, get_ai_provider


@api_view(['POST'])
def submit_answer(request):
    """提交答案 → AI 分析 → 保存记录 → 更新用户统计"""
    serializer = AnswerSubmitSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    # 获取用户和题目
    try:
        user = BaguUser.objects.get(pk=data['user_id'])
    except BaguUser.DoesNotExist:
        return Response({'detail': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)

    try:
        question = Question.objects.get(pk=data['question_id'])
    except Question.DoesNotExist:
        return Response({'detail': '题目不存在'}, status=status.HTTP_404_NOT_FOUND)

    # AI 分析
    try:
        if 'model_id' in data and data['model_id']:
            config = AiModelConfig.objects.get(pk=data['model_id'], is_enabled=True)
            provider = AiProvider(
                api_key=config.api_key,
                base_url=config.base_url,
                model_name=config.model_name,
            )
            model_name = config.name
        else:
            provider, model_name = get_ai_provider()

        result = provider.analyze_answer(
            title=question.title,
            brief_answer=question.brief_answer,
            detailed_answer=question.detailed_answer,
            key_points=question.key_points,
            user_answer=data['answer'],
        )
    except ValueError as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'detail': f'AI 分析失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # 保存记录
    record = AnswerRecord.objects.create(
        user=user,
        question=question,
        user_answer=data['answer'],
        ai_score=result['score'],
        ai_highlights=result['highlights'],
        ai_missing_points=result['missing_points'],
        ai_suggestion=result['suggestion'],
        ai_improved_answer=result['improved_answer'],
        ai_model_name=model_name,
    )

    # 更新用户统计
    user.total_answers += 1
    avg = AnswerRecord.objects.filter(user=user).aggregate(avg=Avg('ai_score'))
    user.avg_score = round(avg['avg'] or 0, 1)
    user.save(update_fields=['total_answers', 'avg_score'])

    return Response(AnswerRecordSerializer(record).data, status=status.HTTP_201_CREATED)


@csrf_exempt
@require_POST
def submit_answer_stream(request):
    """流式提交答案 → SSE 实时推送 AI 分析过程"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'detail': '无效的 JSON'}, status=400)

    user_id = data.get('user_id')
    question_id = data.get('question_id')
    answer_text = data.get('answer', '').strip()
    model_id = data.get('model_id')

    if not all([user_id, question_id, answer_text]):
        return JsonResponse({'detail': '缺少必要参数'}, status=400)

    try:
        user = BaguUser.objects.get(pk=user_id)
    except BaguUser.DoesNotExist:
        return JsonResponse({'detail': '用户不存在'}, status=404)

    try:
        question = Question.objects.get(pk=question_id)
    except Question.DoesNotExist:
        return JsonResponse({'detail': '题目不存在'}, status=404)

    try:
        if model_id:
            config = AiModelConfig.objects.get(pk=model_id, is_enabled=True)
            provider = AiProvider(
                api_key=config.api_key,
                base_url=config.base_url,
                model_name=config.model_name,
            )
            model_name = config.name
        else:
            provider, model_name = get_ai_provider()
    except (AiModelConfig.DoesNotExist, ValueError) as e:
        return JsonResponse({'detail': str(e)}, status=400)

    def sse_generator():
        try:
            final_result = None
            for event_type, content in provider.analyze_answer_stream(
                title=question.title,
                brief_answer=question.brief_answer,
                detailed_answer=question.detailed_answer,
                key_points=question.key_points,
                user_answer=answer_text,
            ):
                if event_type == 'result':
                    final_result = content
                    # 保存记录
                    record = AnswerRecord.objects.create(
                        user=user,
                        question=question,
                        user_answer=answer_text,
                        ai_score=final_result['score'],
                        ai_highlights=final_result['highlights'],
                        ai_missing_points=final_result['missing_points'],
                        ai_suggestion=final_result['suggestion'],
                        ai_improved_answer=final_result['improved_answer'],
                        ai_model_name=model_name,
                    )
                    # 更新用户统计
                    user.total_answers += 1
                    avg = AnswerRecord.objects.filter(user=user).aggregate(avg=Avg('ai_score'))
                    user.avg_score = round(avg['avg'] or 0, 1)
                    user.save(update_fields=['total_answers', 'avg_score'])

                    result_data = AnswerRecordSerializer(record).data
                    # 附加 usage 信息（不入库，仅前端展示）
                    if 'usage' in final_result:
                        result_data['usage'] = final_result['usage']
                    yield f"event: result\ndata: {json.dumps(result_data, ensure_ascii=False)}\n\n"
                else:
                    yield f"event: {event_type}\ndata: {json.dumps({'content': content}, ensure_ascii=False)}\n\n"

            yield "event: done\ndata: {}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'detail': str(e)}, ensure_ascii=False)}\n\n"

    response = StreamingHttpResponse(
        sse_generator(),
        content_type='text/event-stream',
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response


class AnswerRecordViewSet(viewsets.ReadOnlyModelViewSet):
    """答题历史"""
    serializer_class = AnswerRecordSerializer

    def get_queryset(self):
        qs = AnswerRecord.objects.select_related('question', 'question__category').all()
        user_id = self.request.query_params.get('user_id')
        if user_id:
            qs = qs.filter(user_id=user_id)
        return qs


class AiModelConfigViewSet(viewsets.ReadOnlyModelViewSet):
    """AI 模型列表（只暴露可选模型，不暴露 api_key）"""
    queryset = AiModelConfig.objects.filter(is_enabled=True)
    serializer_class = AiModelConfigSerializer
