from __future__ import annotations

import io
import os
import tempfile
from typing import Any

from app.tools.registry import BaseTool


class Plotter(BaseTool):
    name: str = "plotter"
    description: str = "绘制数学函数图像，支持一元函数、多元函数等。返回图像文件路径。"
    parameters: dict = {
        "type": "object",
        "properties": {
            "expr": {
                "type": "string",
                "description": "函数表达式，如 'x**2', 'sin(x)', 'x**3 - 2*x'",
            },
            "x_range": {
                "type": "array",
                "description": "x 轴范围，如 [-10, 10]",
                "items": {"type": "number"},
                "minItems": 2,
                "maxItems": 2,
            },
            "title": {
                "type": "string",
                "description": "图表标题",
            },
        },
        "required": ["expr"],
    }

    _plot_dir: str = ""

    async def execute(
        self,
        expr: str,
        x_range: list[float] | None = None,
        title: str = "",
    ) -> str:
        import matplotlib
        matplotlib.use("Agg")  # 无头模式
        import matplotlib.pyplot as plt
        import numpy as np

        if not self._plot_dir:
            self._plot_dir = os.path.join(
                tempfile.gettempdir(), "smartstudy_plots"
            )
            os.makedirs(self._plot_dir, exist_ok=True)

        x_min, x_max = x_range if x_range else (-10, 10)
        xs = np.linspace(x_min, x_max, 1000)

        try:
            ys = self._safe_eval(expr, xs)
        except Exception as e:
            return f"绘图错误: 无法解析表达式 '{expr}' — {e}"

        fig, ax = plt.subplots(figsize=(8, 5))
        ax.plot(xs, ys, "b-", linewidth=2)
        ax.axhline(y=0, color="gray", linestyle="--", linewidth=0.5)
        ax.axvline(x=0, color="gray", linestyle="--", linewidth=0.5)
        ax.set_xlabel("x")
        ax.set_ylabel("y")
        ax.set_title(title or f"y = {expr}")
        ax.grid(True, alpha=0.3)

        # 保存为 SVG 字符串
        buf = io.StringIO()
        fig.savefig(buf, format="svg", bbox_inches="tight")
        plt.close(fig)

        svg_content = buf.getvalue()
        # 返回 SVG 的 data URI 供前端直接显示
        import urllib.parse
        encoded = urllib.parse.quote(svg_content)
        data_uri = f"data:image/svg+xml;charset=utf-8,{encoded}"

        return f"![函数图像]({data_uri})\n\n函数 y = {expr} 在 [{x_min}, {x_max}] 上的图像已生成。"

    @staticmethod
    def _safe_eval(expr: str, xs: Any) -> Any:
        """安全地计算函数表达式。"""
        import numpy as np
        namespace = {
            "x": xs,
            "sin": np.sin,
            "cos": np.cos,
            "tan": np.tan,
            "sqrt": np.sqrt,
            "log": np.log,
            "exp": np.exp,
            "abs": np.abs,
            "pi": np.pi,
            "e": np.e,
        }
        return eval(expr, {"__builtins__": {}}, namespace)
