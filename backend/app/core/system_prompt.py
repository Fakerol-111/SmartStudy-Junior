"""分学科 System Prompt 定义（从 prompts/config.json 加载）。"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path


def _load_prompt_config() -> dict:
    """从 prompts/config.json 加载配置。"""
    config_path = Path(__file__).parent.parent.parent.parent / "prompts" / "config.json"
    if config_path.exists():
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


_PROMPT_CONFIG = _load_prompt_config()


def _build_base_prompt() -> str:
    """根据配置构建基础 prompt。"""
    base = _PROMPT_CONFIG.get("base", {})
    if not base:
        # Fallback 用默认值
        return "你是 SmartStudy 智慧学习助手。"
    
    parts = [base.get("system_role", "你是 SmartStudy 智慧学习助手。")]
    
    # 核心原则
    principles = base.get("core_principles", [])
    if principles:
        parts.append("## 核心教学原则\n")
        for i, p in enumerate(principles, 1):
            parts.append(f"{i}. **{p.split('：')[0]}**：{p.split('：')[1] if '：' in p else p}")
    
    # 输出规范
    output_rules = base.get("output_rules", {})
    if output_rules:
        parts.append("\n## 输出规范\n")
        if "latex_format" in output_rules:
            parts.append(f"- {output_rules['latex_format']}")
        if "language_style" in output_rules:
            parts.append(f"- 语言风格：{output_rules['language_style']}")
    
    # 可用工具
    tools = base.get("available_tools", [])
    if tools:
        parts.append("\n## 可用工具\n")
        parts.append("你可以使用以下工具来辅助教学：\n")
        for tool in tools:
            parts.append(f"- **{tool.get('name')}** — {tool.get('description', '')}")
    
    return "\n".join(parts)


BASE_TUTOR_PROMPT = _build_base_prompt()


def _build_subject_prompts() -> dict[str, str]:
    """从 config.subjects 构建学科提示，适配新的对象结构。"""
    subjects_config = _PROMPT_CONFIG.get("subjects", {})
    result = {}
    
    for subject_key, subject_value in subjects_config.items():
        if isinstance(subject_value, str):
            # 向后兼容：如果是字符串直接用
            result[subject_key] = subject_value
        elif isinstance(subject_value, dict):
            # 新格式：对象中有 description、teaching_approach、common_pitfalls 等
            desc = subject_value.get("description", "")
            approach = subject_value.get("teaching_approach", "")
            
            if approach:
                result[subject_key] = f"{desc}\n{approach}"
            else:
                result[subject_key] = desc
        else:
            # 其他情况，使用默认值
            result[subject_key] = f"【{subject_key}】"
    
    return result


SUBJECT_PROMPTS: dict[str, str] = _build_subject_prompts() or {
    "math": "【数学】侧重逻辑推导和公式运用。要求每一步都有理有据。",
    "physics": "【物理】联系生活实际，用实验和现象帮助理解抽象概念。",
    "chemistry": "【化学】注意实验安全和化学反应原理，用微观原理解释宏观现象。",
    "english": "【英语】注重语境理解，通过例句和情景对话讲解语法和词汇。",
    "chinese": "【语文】侧重文本赏析和写作手法，鼓励学生表达自己的理解。",
    "history": "【历史】注重时间线和因果关系，用故事化的方式讲述历史事件。",
    "geography": "【地理】善用地图和图表，将地理知识与生活场景结合。",
    "biology": "【生物】从身边的生命现象入手，由浅入深讲解生命科学。",
    "politics": "【道德与法治】联系社会实际，培养学生的法治意识和道德判断。",
}


@dataclass
class TutorConfig:
    subject: str = "general"
    student_name: str = "同学"
    weak_points: list[str] = field(default_factory=list)
    extra_instructions: str = ""


def build_system_prompt(config: TutorConfig | None = None) -> str:
    """组装完整的 System Prompt。"""
    cfg = config or TutorConfig()
    parts = [BASE_TUTOR_PROMPT]

    subject_instruction = SUBJECT_PROMPTS.get(cfg.subject)
    if subject_instruction:
        parts.append(subject_instruction)

    if cfg.subject != "general" and not subject_instruction:
        parts.append(f"【{cfg.subject}】")

    if cfg.weak_points:
        weak = "；".join(cfg.weak_points)
        parts.append(f"## 该学生薄弱点\n学生在以下知识点上需要加强：{weak}。请特别关注这些方面的讲解。")

    if cfg.extra_instructions:
        parts.append(f"## 补充指令\n{cfg.extra_instructions}")

    return "\n\n".join(parts)
