from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from httpx import AsyncClient, HTTPStatusError, RequestError

from .config import Settings


class DeepSeekClient:
    """DeepSeek V4 API 客户端，支持 streaming + tool calling。"""

    def __init__(self, settings: Settings | None = None) -> None:
        s = settings or Settings()
        self.api_key = s.deepseek_api_key
        self.base_url = s.deepseek_base_url.rstrip("/")
        self.model = s.deepseek_model
        self._http = AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            timeout=60.0,
        )

    async def chat_completion(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        stream: bool = True,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncIterator[dict[str, Any]]:
        """流式聊天补全，逐 token 产出现块。

        每个产出的 dict 包含:
          - type: "delta" | "done" | "error"
          - 当 type="delta" 时, delta 字段可能是 "content" 或 "tool_calls"
        """
        body: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "stream": stream,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            body["tools"] = tools

        try:
            async with self._http.stream("POST", "/chat/completions", json=body) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    payload = line.removeprefix("data: ").strip()
                    if payload == "[DONE]":
                        yield {"type": "done"}
                        return
                    try:
                        chunk = json.loads(payload)
                    except json.JSONDecodeError:
                        continue
                    yield {"type": "delta", "chunk": chunk}
        except (HTTPStatusError, RequestError) as exc:
            yield {"type": "error", "detail": str(exc)}

    async def chat_completion_with_tools(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """非流式一次调用，用于工具调用回合。

        Returns:
          (updated_messages, tool_calls_list)
        """
        body: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "tools": tools,
            "stream": False,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        try:
            resp = await self._http.post("/chat/completions", json=body)
            resp.raise_for_status()
            data = resp.json()
        except (HTTPStatusError, RequestError) as exc:
            return messages, [{"type": "error", "detail": str(exc)}]

        choice = data["choices"][0]
        msg = choice["message"]

        messages.append({"role": "assistant", "content": msg.get("content") or ""})

        tool_calls_raw = msg.get("tool_calls") or []
        parsed_calls = []
        for tc in tool_calls_raw:
            parsed_calls.append({
                "id": tc["id"],
                "type": "function",
                "function": {
                    "name": tc["function"]["name"],
                    "arguments": tc["function"]["arguments"],
                },
            })

        return messages, parsed_calls

    async def close(self) -> None:
        await self._http.aclose()
