"""安全护栏：内容过滤 + 年龄适配。"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# 敏感内容关键词（初中生不宜）
_BLOCKED_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p)
    for p in [
        r"(?i)(色情|赌博|暴力|自杀|毒品|成人)",
        r"(?i)(\bsuicide\b|\bkill\b|\bdrugs?\b|\bporn\b)",
    ]
]


@dataclass
class SafetyResult:
    passed: bool = True
    reason: str = ""


@dataclass
class SafetyPolicy:
    """安全策略配置。"""

    allow_web_search: bool = True
    restricted_topics: list[str] = field(default_factory=list)


def check_input(text: str) -> SafetyResult:
    """检查用户输入是否包含违规内容。"""
    for pat in _BLOCKED_PATTERNS:
        if pat.search(text):
            return SafetyResult(
                passed=False,
                reason="输入包含不适合的内容，请重新表述你的问题。",
            )
    return SafetyResult()


def check_output(text: str) -> SafetyResult:
    """检查 AI 输出是否包含不适合初中生的内容。"""
    for pat in _BLOCKED_PATTERNS:
        if pat.search(text):
            return SafetyResult(
                passed=False,
                reason="oh",
            )
    return SafetyResult()
