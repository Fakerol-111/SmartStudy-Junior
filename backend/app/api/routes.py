from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.harness import StudyHarness
from app.core.system_prompt import TutorConfig

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    conversation_history: list[dict] = []
    subject: str = "general"
    student_name: str = "同学"
    weak_points: list[str] = []


class ChatResponse(BaseModel):
    reply: str
    conversation_history: list[dict]


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """对话接口：发送消息并获取回复（非流式）。"""
    from app.main import deepseek_client, tool_registry

    if not deepseek_client:
        raise HTTPException(status_code=503, detail="服务未就绪")

    harness = StudyHarness(deepseek_client, tool_registry)
    config = TutorConfig(
        subject=req.subject,
        student_name=req.student_name,
        weak_points=req.weak_points,
    )

    # 收集最终结果
    final_history = req.conversation_history.copy()
    full_reply = ""

    async for event in harness.process_message(req.message, final_history, config):
        if event["type"] == "delta":
            full_reply += event["content"]
        elif event["type"] == "error":
            raise HTTPException(status_code=400, detail=event["detail"])
        elif event["type"] == "done":
            final_history = event["history"]

    return ChatResponse(reply=full_reply, conversation_history=final_history)
