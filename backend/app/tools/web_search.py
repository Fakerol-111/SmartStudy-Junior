from __future__ import annotations

import os

from app.tools.registry import BaseTool


class WebSearch(BaseTool):
    name: str = "web_search"
    description: str = "搜索互联网获取最新信息。当遇到不确定的实时信息、最新政策、教材版本差异时使用。"
    parameters: dict = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "搜索关键词，建议用中文",
            },
        },
        "required": ["query"],
    }

    async def execute(self, query: str) -> str:
        # 优先使用环境变量配置的搜索 API
        api_key = os.getenv("SEARCH_API_KEY", "")
        engine = os.getenv("SEARCH_ENGINE", "duckduckgo")

        if api_key and engine == "bing":
            return await self._search_bing(query, api_key)
        elif api_key and engine == "serpapi":
            return await self._search_serpapi(query, api_key)
        else:
            return await self._search_duckduckgo(query)

    async def _search_duckduckgo(self, query: str) -> str:
        """使用 DuckDuckGo（无需 API Key，但有频率限制）。"""
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.duckduckgo.com/",
                    params={
                        "q": query,
                        "format": "json",
                        "no_html": "1",
                        "skip_disambig": "1",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                results = []

                abstract = data.get("AbstractText", "")
                if abstract:
                    results.append(f"**摘要**: {abstract}")

                source = data.get("AbstractSource", "")
                src_url = data.get("AbstractURL", "")
                if source and src_url:
                    results.append(f"**来源**: [{source}]({src_url})")

                related = data.get("RelatedTopics", [])
                for topic in related[:5]:
                    if isinstance(topic, dict):
                        text = topic.get("Text", "")
                        url = topic.get("FirstURL", "")
                        if text:
                            results.append(f"- {text}")

                if not results:
                    results.append(f"没有找到关于「{query}」的搜索结果。")

                return "\n\n".join(results)
        except Exception as e:
            return f"搜索失败: {e}\n请稍后重试或换个关键词。"

    async def _search_bing(self, query: str, api_key: str) -> str:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.bing.microsoft.com/v7.0/search",
                    headers={"Ocp-Apim-Subscription-Key": api_key},
                    params={"q": query, "count": 5, "mkt": "zh-CN"},
                )
                resp.raise_for_status()
                data = resp.json()

                results = []
                for item in data.get("webPages", {}).get("value", [])[:5]:
                    name = item.get("name", "")
                    url = item.get("url", "")
                    snippet = item.get("snippet", "")
                    results.append(f"### [{name}]({url})\n{snippet}")

                return "\n\n".join(results) if results else f"没有找到关于「{query}」的搜索结果。"
        except Exception as e:
            return f"搜索失败: {e}"

    async def _search_serpapi(self, query: str, api_key: str) -> str:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://serpapi.com/search",
                    params={
                        "q": query,
                        "api_key": api_key,
                        "engine": "google",
                        "hl": "zh-cn",
                        "num": 5,
                    },
                )
                resp.raise_for_status()
                data = resp.json()

                results = []
                for item in data.get("organic_results", [])[:5]:
                    title = item.get("title", "")
                    url = item.get("link", "")
                    snippet = item.get("snippet", "")
                    results.append(f"### [{title}]({url})\n{snippet}")

                return "\n\n".join(results) if results else f"没有找到关于「{query}」的搜索结果。"
        except Exception as e:
            return f"搜索失败: {e}"
