from __future__ import annotations

from app.tools.registry import BaseTool


class OcrTool(BaseTool):
    name: str = "ocr"
    description: str = "识别图片中的文字和数学公式。支持手写和印刷体。"
    parameters: dict = {
        "type": "object",
        "properties": {
            "image_url": {
                "type": "string",
                "description": "图片的 URL 或 base64 data URI",
            },
            "language": {
                "type": "string",
                "description": "语言，默认 'chi_sim+eng'",
                "default": "chi_sim+eng",
            },
        },
        "required": ["image_url"],
    }

    async def execute(self, image_url: str, language: str = "chi_sim+eng") -> str:
        # 后续集成 PaddleOCR 或调用多模态模型
        # 当前返回占位信息
        return (
            "OCR 功能正在集成中。当前支持：\n"
            "1. 通过多模态模型直接识别图片内容\n"
            "2. 后续将集成 PaddleOCR 做本地识别\n\n"
            f"图片已接收 (长度: {len(image_url)} 字符)，请使用 AI 的多模态能力分析图片内容。"
        )
