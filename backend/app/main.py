from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import router
from app.core.config import Settings
from app.core.deepseek_client import DeepSeekClient
from app.db.database import init_db, close_db
from app.tools.calculator import Calculator
from app.tools.ocr import OcrTool
from app.tools.plotter import Plotter
from app.tools.registry import ToolRegistry
from app.tools.web_search import WebSearch

settings = Settings()
deepseek_client: DeepSeekClient | None = None
tool_registry: ToolRegistry | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global deepseek_client, tool_registry

    # 初始化数据库
    await init_db(settings)

    deepseek_client = DeepSeekClient(settings)
    tool_registry = ToolRegistry()

    # 注册所有工具
    tool_registry.register(Calculator())
    tool_registry.register(WebSearch())
    tool_registry.register(Plotter())
    tool_registry.register(OcrTool())

    yield

    if deepseek_client:
        await deepseek_client.close()
    await close_db()


app = FastAPI(
    title="SmartStudy API",
    description="智慧学习助手后端服务",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok", "tools": list(tool_registry._tools.keys()) if tool_registry else []}
