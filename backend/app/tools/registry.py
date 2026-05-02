from __future__ import annotations

import json
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import Any


class BaseTool(ABC):
    """工具基类 —— 每个学科工具继承此类。"""

    name: str = ""
    description: str = ""
    parameters: dict[str, Any] = {}

    @abstractmethod
    async def execute(self, **kwargs: Any) -> str:
        """执行工具，返回结果文本。"""

    def to_openai_spec(self) -> dict[str, Any]:
        """返回 OpenAI / DeepSeek 兼容的 function spec。"""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


class ToolRegistry:
    """工具注册中心 —— 管理所有可用工具。"""

    def __init__(self) -> None:
        self._tools: dict[str, BaseTool] = {}

    def register(self, tool: BaseTool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> BaseTool | None:
        return self._tools.get(name)

    def list_tools(self) -> list[BaseTool]:
        return list(self._tools.values())

    def to_openai_specs(self) -> list[dict[str, Any]]:
        return [t.to_openai_spec() for t in self._tools.values()]

    async def execute_tool(self, name: str, arguments: str) -> str:
        """执行工具，arguments 是 JSON 字符串。

        Returns:
          工具执行结果的文本描述。
        """
        tool = self.get(name)
        if tool is None:
            return f"错误：未知工具 '{name}'"

        try:
            kwargs = json.loads(arguments) if arguments else {}
        except json.JSONDecodeError as e:
            return f"错误：工具参数解析失败 —— {e}"

        return await tool.execute(**kwargs)
