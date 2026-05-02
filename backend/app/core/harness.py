from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from app.core.deepseek_client import DeepSeekClient
from app.core.safety import SafetyPolicy, check_input, check_output
from app.core.system_prompt import TutorConfig, build_system_prompt
from app.tools.registry import ToolRegistry


class StudyHarness:
    """核心引擎 —— 管理对话循环与工具调度。"""

    def __init__(
        self,
        client: DeepSeekClient,
        registry: ToolRegistry,
        policy: SafetyPolicy | None = None,
    ) -> None:
        self.client = client
        self.registry = registry
        self.policy = policy or SafetyPolicy()

    async def process_message(
        self,
        message: str,
        conversation_history: list[dict[str, Any]],
        tutor_config: TutorConfig | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """处理一条用户消息，产出 SSE 事件块。

        每个产出 dict 格式:
          - type: "delta" | "tool_call" | "tool_result" | "done" | "error"
          根据 type 不同附带不同字段。
        """
        # 1. 安全过滤
        safety = check_input(message)
        if not safety.passed:
            yield {"type": "error", "detail": safety.reason}
            return

        # 2. 组装 System Prompt
        sys_prompt = build_system_prompt(tutor_config)
        history = conversation_history.copy()
        if not history or history[0].get("role") != "system":
            history.insert(0, {"role": "system", "content": sys_prompt})

        # 3. 添加用户消息
        history.append({"role": "user", "content": message})

        # 4. 主循环 —— 处理工具调用直到模型输出最终回复
        max_tool_rounds = 10
        for _ in range(max_tool_rounds):
            history, tool_calls = await self.client.chat_completion_with_tools(
                history,
                tools=self.registry.to_openai_specs(),
            )

            if not tool_calls:
                # 模型最终回复
                final_content = history[-1].get("content", "")
                if final_content:
                    yield {"type": "delta", "content": final_content}
                break

            # 检查是否有 API 错误
            if tool_calls[0].get("type") == "error":
                yield {"type": "error", "detail": tool_calls[0].get("detail", "API 调用失败")}
                return

            # 处理工具调用
            for tc in tool_calls:
                fn = tc.get("function")
                if not fn:
                    yield {"type": "error", "detail": f"工具调用格式异常: {tc}"}
                    return
                yield {
                    "type": "tool_call",
                    "tool_name": fn["name"],
                    "arguments": fn["arguments"],
                }

                result = await self.registry.execute_tool(fn["name"], fn["arguments"])

                yield {
                    "type": "tool_result",
                    "tool_name": fn["name"],
                    "result": result,
                }

                history.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result,
                })
        else:
            yield {"type": "error", "detail": "工具调用次数过多，请简化你的问题。"}

        # 5. 输出安全过滤
        final_msg = history[-1].get("content", "")
        out_safety = check_output(final_msg)
        if not out_safety.passed:
            yield {"type": "error", "detail": out_safety.reason}
            return

        yield {
            "type": "done",
            "history": history,
        }

    async def stream_response(
        self,
        message: str,
        conversation_history: list[dict[str, Any]],
        tutor_config: TutorConfig | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """流式版本 —— 逐 token 流式输出最终回复。"""
        # 1. 安全过滤
        safety = check_input(message)
        if not safety.passed:
            yield {"type": "error", "detail": safety.reason}
            return

        # 2. 组装上下文
        sys_prompt = build_system_prompt(tutor_config)
        history = conversation_history.copy()
        if not history or history[0].get("role") != "system":
            history.insert(0, {"role": "system", "content": sys_prompt})

        history.append({"role": "user", "content": message})

        max_tool_rounds = 10
        for _ in range(max_tool_rounds):
            # 非流式工具调用回合
            history, tool_calls = await self.client.chat_completion_with_tools(
                history,
                tools=self.registry.to_openai_specs(),
            )

            if not tool_calls:
                # 流式输出最终回复
                yield {"type": "thinking_done"}
                async for chunk in self._stream_assistant_reply(history[-1]):
                    yield chunk
                break

            if tool_calls[0].get("type") == "error":
                yield {"type": "error", "detail": tool_calls[0].get("detail", "API 调用失败")}
                return

            for tc in tool_calls:
                fn = tc.get("function")
                if not fn:
                    yield {"type": "error", "detail": f"工具调用格式异常: {tc}"}
                    return

                result = await self.registry.execute_tool(fn["name"], fn["arguments"])
                yield {"type": "tool_result", "tool_name": fn["name"], "result": result}

                history.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result,
                })
        else:
            yield {"type": "error", "detail": "工具调用次数过多，请简化你的问题。"}

        out_safety = check_output(history[-1].get("content", ""))
        if not out_safety.passed:
            yield {"type": "error", "detail": out_safety.reason}
            return

        yield {"type": "done", "history": history}

    async def _stream_assistant_reply(
        self,
        assistant_message: dict[str, Any],
    ) -> AsyncIterator[dict[str, Any]]:
        """回放已获取到的 assistant 回复内容，逐段产出。"""
        content = assistant_message.get("content", "")
        if content:
            # 模拟流式输出，按段落产出
            import re
            segments = re.split(r"(\n{2,})", content)
            for seg in segments:
                if seg:
                    yield {"type": "delta", "content": seg}
