import json
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from django.db.models import Avg
from django.http import StreamingHttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET
from .models import AnswerRecord, AiModelConfig, AiRoleConfig, EvaluationRound, FollowUpQuestion
from .serializers import (
    AnswerSubmitSerializer, AnswerRecordSerializer, AnswerRecordListSerializer,
    AiModelConfigSerializer, AiModelConfigWriteSerializer, AiRoleConfigSerializer,
    EvaluationRoundSerializer, FollowUpQuestionSerializer,
)
from questions.models import Question, mark_question_completed
from users.models import BaguUser
from ai_service.provider import get_ai_provider, get_ai_provider_by_id


def _get_enabled_roles(role_key=None, difficulty_level=None):
    qs = AiRoleConfig.objects.filter(is_enabled=True)
    if role_key:
        qs = qs.filter(role_key=role_key)
    elif difficulty_level:
        qs = qs.filter(difficulty_level=difficulty_level)
    roles = list(qs.order_by('sort_order', 'id'))
    if not roles:
        raise ValueError('未配置 AI 角色，请先在后台或设置页添加并启用角色')
    return roles


def _safe_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _merge_role_scores(result, roles):
    raw = result.get('role_scores', []) or []
    merged = []

    for idx, role in enumerate(roles):
        score_item = raw[idx] if idx < len(raw) and isinstance(raw[idx], dict) else {}
        merged.append({
            'role_id': role.id,
            'role_key': role.role_key,
            'role_name': role.name,
            'tts_model': role.tts_model,
            'voice': role.voice,
            'voice_label': role.voice_label,
            'difficulty_level': role.difficulty_level,
            'weight': role.weight,
            'score': _safe_int(score_item.get('score'), 0),
            'comment': score_item.get('comment', ''),
        })

    if merged:
        total_weight = sum(max(item['weight'], 0) for item in merged)
        if total_weight > 0:
            weighted_sum = sum(item['score'] * max(item['weight'], 0) for item in merged)
            result['score'] = round(weighted_sum / total_weight)
        else:
            result['score'] = round(sum(item['score'] for item in merged) / len(merged))

        result['role_scores'] = merged
        if len(merged) >= 1:
            result['junior_score'] = merged[0]['score']
            result['junior_comment'] = merged[0]['comment']
        if len(merged) >= 2:
            result['mid_score'] = merged[1]['score']
            result['mid_comment'] = merged[1]['comment']
        if len(merged) >= 3:
            result['senior_score'] = merged[2]['score']
            result['senior_comment'] = merged[2]['comment']

    return result


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
        roles = _get_enabled_roles(
            role_key=data.get('role_key'),
            difficulty_level=data.get('difficulty_level'),
        )
        if 'model_id' in data and data['model_id']:
            provider, model_name = get_ai_provider_by_id(data['model_id'])
        else:
            provider, model_name = get_ai_provider()

        result = provider.analyze_answer(
            title=question.title,
            brief_answer=question.brief_answer,
            detailed_answer=question.detailed_answer,
            key_points=question.key_points,
            user_answer=data['answer'],
            roles=roles,
        )
        result = _merge_role_scores(result, roles)
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
        ai_role_scores=result.get('role_scores', []),
        ai_junior_score=result.get('junior_score', 0),
        ai_junior_comment=result.get('junior_comment', ''),
        ai_mid_score=result.get('mid_score', 0),
        ai_mid_comment=result.get('mid_comment', ''),
        ai_senior_score=result.get('senior_score', 0),
        ai_senior_comment=result.get('senior_comment', ''),
    )

    # 更新用户统计
    user.total_answers += 1
    avg = AnswerRecord.objects.filter(user=user).aggregate(avg=Avg('ai_score'))
    user.avg_score = round(avg['avg'] or 0, 1)
    user.save(update_fields=['total_answers', 'avg_score'])
    mark_question_completed(user_id=user.id, question_id=question.id)

    return Response(AnswerRecordSerializer(record).data, status=status.HTTP_201_CREATED)


@csrf_exempt
@require_POST
def submit_answer_stream(request):
    """流式提交答案 → AI 纠错 → SSE 实时推送 AI 分析过程"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'detail': '无效的 JSON'}, status=400)

    user_id = data.get('user_id')
    question_id = data.get('question_id')
    answer_text = data.get('answer', '').strip()
    model_id = data.get('model_id')
    round_id = data.get('round_id')
    role_key = data.get('role_key')
    difficulty_level = data.get('difficulty_level')

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
        roles = _get_enabled_roles(role_key=role_key, difficulty_level=difficulty_level)
        if model_id:
            provider, model_name = get_ai_provider_by_id(model_id)
        else:
            provider, model_name = get_ai_provider()
    except (AiModelConfig.DoesNotExist, ValueError) as e:
        return JsonResponse({'detail': str(e)}, status=400)

    # 获取关联的 round
    evaluation_round = None
    if round_id:
        try:
            evaluation_round = EvaluationRound.objects.get(pk=round_id)
        except EvaluationRound.DoesNotExist:
            pass

    def sse_generator():
        try:
            # Step 1: AI 纠错（始终发送 correction 事件，前端根据是否有修改显示不同状态）
            corrected_text = answer_text
            try:
                corrected_text = provider.correct_text(answer_text)
                if corrected_text != answer_text:
                    yield f"event: correction\ndata: {json.dumps({'original': answer_text, 'corrected': corrected_text}, ensure_ascii=False, default=str)}\n\n"
                else:
                    yield f"event: correction\ndata: {json.dumps({'corrected': None}, ensure_ascii=False, default=str)}\n\n"
            except Exception:
                # 纠错失败也发送事件，让前端知道纠错已完成
                yield f"event: correction\ndata: {json.dumps({'corrected': None}, ensure_ascii=False, default=str)}\n\n"

            # Step 2: 流式评分（使用纠错后的文本）
            final_result = None
            for event_type, content in provider.analyze_answer_stream(
                title=question.title,
                brief_answer=question.brief_answer,
                detailed_answer=question.detailed_answer,
                key_points=question.key_points,
                user_answer=corrected_text,
                roles=roles,
            ):
                if event_type == 'result':
                    final_result = _merge_role_scores(content, roles)
                    # 保存记录
                    record = AnswerRecord.objects.create(
                        user=user,
                        question=question,
                        user_answer=answer_text,
                        corrected_answer=corrected_text if corrected_text != answer_text else '',
                        ai_score=final_result['score'],
                        ai_highlights=final_result['highlights'],
                        ai_missing_points=final_result['missing_points'],
                        ai_suggestion=final_result['suggestion'],
                        ai_improved_answer=final_result['improved_answer'],
                        ai_model_name=model_name,
                        ai_role_scores=final_result.get('role_scores', []),
                        ai_junior_score=final_result.get('junior_score', 0),
                        ai_junior_comment=final_result.get('junior_comment', ''),
                        ai_mid_score=final_result.get('mid_score', 0),
                        ai_mid_comment=final_result.get('mid_comment', ''),
                        ai_senior_score=final_result.get('senior_score', 0),
                        ai_senior_comment=final_result.get('senior_comment', ''),
                        round=evaluation_round,
                    )
                    # 更新用户统计
                    user.total_answers += 1
                    avg = AnswerRecord.objects.filter(user=user).aggregate(avg=Avg('ai_score'))
                    user.avg_score = round(avg['avg'] or 0, 1)
                    user.save(update_fields=['total_answers', 'avg_score'])
                    mark_question_completed(user_id=user.id, question_id=question.id)

                    result_data = AnswerRecordSerializer(record).data
                    # 附加 usage 信息（不入库，仅前端展示）
                    if 'usage' in final_result:
                        result_data['usage'] = final_result['usage']
                    yield f"event: result\ndata: {json.dumps(result_data, ensure_ascii=False, default=str)}\n\n"
                else:
                    yield f"event: {event_type}\ndata: {json.dumps({'content': content}, ensure_ascii=False, default=str)}\n\n"

            yield "event: done\ndata: {}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'detail': str(e)}, ensure_ascii=False, default=str)}\n\n"

    response = StreamingHttpResponse(
        sse_generator(),
        content_type='text/event-stream',
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response


@csrf_exempt
@require_GET
def get_question_history(request):
    """获取用户在某道题的历史答题记录"""
    user_id = request.GET.get('user_id')
    question_id = request.GET.get('question_id')

    if not user_id or not question_id:
        return JsonResponse({'detail': '缺少 user_id 或 question_id'}, status=400)

    records = AnswerRecord.objects.filter(
        user_id=user_id, question_id=question_id
    ).select_related('question', 'question__category').order_by('-created_at')[:10]

    data = AnswerRecordListSerializer(records, many=True).data
    return JsonResponse(data, safe=False)


@csrf_exempt
@require_POST
def create_evaluation_round(request):
    """创建评估轮次"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'detail': '无效的 JSON'}, status=400)

    user_id = data.get('user_id')
    question_id = data.get('question_id')
    user_answer = data.get('user_answer', '').strip()
    model_count = data.get('model_count', 1)

    if not all([user_id, question_id, user_answer]):
        return JsonResponse({'detail': '缺少必要参数'}, status=400)

    try:
        user = BaguUser.objects.get(pk=user_id)
        question = Question.objects.get(pk=question_id)
    except (BaguUser.DoesNotExist, Question.DoesNotExist):
        return JsonResponse({'detail': '用户或题目不存在'}, status=404)

    round_obj = EvaluationRound.objects.create(
        user=user,
        question=question,
        user_answer=user_answer,
        model_count=model_count,
    )

    return JsonResponse({
        'round_id': str(round_obj.id),
        'created_at': round_obj.created_at.isoformat(),
    })


@csrf_exempt
@require_POST
def finalize_round(request, round_id):
    """完成评估轮次，计算综合分（简单平均）"""
    try:
        round_obj = EvaluationRound.objects.get(pk=round_id)
    except EvaluationRound.DoesNotExist:
        return JsonResponse({'detail': '轮次不存在'}, status=404)

    records = round_obj.answer_records.all()
    if not records.exists():
        return JsonResponse({'detail': '该轮次无评分记录'}, status=400)

    scores = [r.ai_score for r in records]
    composite = round(sum(scores) / len(scores), 1)

    round_obj.composite_score = composite
    round_obj.model_count = len(scores)
    round_obj.completed = True
    round_obj.save(update_fields=['composite_score', 'model_count', 'completed'])

    return JsonResponse(EvaluationRoundSerializer(round_obj).data)


@csrf_exempt
@require_POST
def follow_up_stream(request):
    """流式追问 → SSE 实时推送 AI 回答"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'detail': '无效的 JSON'}, status=400)

    record_id = data.get('record_id')
    question_text = data.get('question', '').strip()
    model_id = data.get('model_id')

    if not record_id or not question_text:
        return JsonResponse({'detail': '缺少 record_id 或 question'}, status=400)

    try:
        record = AnswerRecord.objects.select_related('question').get(pk=record_id)
    except AnswerRecord.DoesNotExist:
        return JsonResponse({'detail': '答题记录不存在'}, status=404)

    try:
        if model_id:
            provider, model_name = get_ai_provider_by_id(model_id)
        else:
            provider, model_name = get_ai_provider()
    except (AiModelConfig.DoesNotExist, ValueError) as e:
        return JsonResponse({'detail': str(e)}, status=400)

    # 构建追问历史
    existing_followups = record.follow_ups.all()
    history_lines = []
    for fu in existing_followups:
        history_lines.append(f"问：{fu.user_question}")
        history_lines.append(f"答：{fu.ai_response[:200]}...")
    follow_up_history = '\n'.join(history_lines) if history_lines else ''

    def sse_generator():
        try:
            for event_type, content in provider.follow_up_stream(
                title=record.question.title,
                user_answer=record.user_answer,
                score=record.ai_score,
                highlights=record.ai_highlights,
                missing_points=record.ai_missing_points,
                suggestion=record.ai_suggestion,
                follow_up_history=follow_up_history,
                follow_up_question=question_text,
            ):
                if event_type == 'done':
                    # 保存追问记录
                    fu = FollowUpQuestion.objects.create(
                        answer_record=record,
                        user_question=question_text,
                        ai_response=content,
                        ai_model_name=model_name,
                    )
                    yield f"event: followup_result\ndata: {json.dumps(FollowUpQuestionSerializer(fu).data, ensure_ascii=False, default=str)}\n\n"
                else:
                    yield f"event: {event_type}\ndata: {json.dumps({'content': content}, ensure_ascii=False, default=str)}\n\n"

            yield "event: done\ndata: {}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'detail': str(e)}, ensure_ascii=False, default=str)}\n\n"

    response = StreamingHttpResponse(
        sse_generator(),
        content_type='text/event-stream',
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response


class AnswerRecordViewSet(viewsets.ReadOnlyModelViewSet):
    """答题历史"""

    def get_serializer_class(self):
        if self.action == 'list':
            return AnswerRecordListSerializer
        return AnswerRecordSerializer

    def get_queryset(self):
        qs = AnswerRecord.objects.select_related('question', 'question__category').all()
        user_id = self.request.query_params.get('user_id')
        if user_id:
            qs = qs.filter(user_id=user_id)
        return qs


class AiModelConfigViewSet(viewsets.ModelViewSet):
    """AI 模型配置 CRUD（读取时不暴露 api_key，写入时接受 api_key）"""
    queryset = AiModelConfig.objects.all()

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return AiModelConfigWriteSerializer
        return AiModelConfigSerializer


class AiRoleConfigViewSet(viewsets.ModelViewSet):
    """AI 角色配置 CRUD"""
    queryset = AiRoleConfig.objects.all()
    serializer_class = AiRoleConfigSerializer

    @action(detail=True, methods=['post'], url_path='tts-preview')
    def tts_preview(self, request, pk=None):
        """按角色配置生成 TTS 试听音频（base64）"""
        text = (request.data.get('text') or '').strip()
        if not text:
            return Response({'detail': '缺少 text'}, status=status.HTTP_400_BAD_REQUEST)

        role = self.get_object()
        if not role.voice:
            return Response({'detail': '该角色未配置 voice'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            provider, _ = get_ai_provider()
            audio_base64 = provider.synthesize_speech(
                text=text,
                tts_model=role.tts_model,
                voice=role.voice,
            )
        except Exception as e:
            return Response({'detail': f'TTS 生成失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            'role_id': role.id,
            'role_key': role.role_key,
            'tts_model': role.tts_model,
            'voice': role.voice,
            'audio_base64': audio_base64,
            'mime_type': 'audio/mpeg',
        })


@csrf_exempt
@require_POST
def battle_analysis_stream(request):
    """对战分析 → SSE 实时推送 AI 对比分析"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'detail': '无效的 JSON'}, status=400)

    question_id = data.get('question_id')
    user_a = data.get('user_a', {})
    user_b = data.get('user_b', {})
    model_id = data.get('model_id')

    if not all([question_id, user_a.get('name'), user_b.get('name')]):
        return JsonResponse({'detail': '缺少必要参数'}, status=400)

    try:
        question = Question.objects.get(pk=question_id)
    except Question.DoesNotExist:
        return JsonResponse({'detail': '题目不存在'}, status=404)

    try:
        if model_id:
            provider, _ = get_ai_provider_by_id(model_id)
        else:
            provider, _ = get_ai_provider()
    except (AiModelConfig.DoesNotExist, ValueError) as e:
        return JsonResponse({'detail': str(e)}, status=400)

    def sse_generator():
        try:
            for event_type, content in provider.battle_analysis_stream(
                title=question.title,
                user_a_name=user_a['name'],
                user_a_answer=user_a.get('answer', ''),
                user_a_scores=user_a.get('scores', ''),
                user_b_name=user_b['name'],
                user_b_answer=user_b.get('answer', ''),
                user_b_scores=user_b.get('scores', ''),
            ):
                if event_type == 'result':
                    yield f"event: battle_result\ndata: {json.dumps(content, ensure_ascii=False, default=str)}\n\n"
                else:
                    yield f"event: {event_type}\ndata: {json.dumps({'content': content}, ensure_ascii=False, default=str)}\n\n"

            yield "event: done\ndata: {}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'detail': str(e)}, ensure_ascii=False, default=str)}\n\n"

    response = StreamingHttpResponse(
        sse_generator(),
        content_type='text/event-stream',
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response
