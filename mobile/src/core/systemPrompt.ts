import config from '../../prompts/config.json';
import type { TutorConfig } from './types';

/**
 * 从 prompts/config.json 中构建基础 Prompt
 */
function buildBaseTutorPrompt(): string {
  const base = config.base || {};
  if (!base) return '你是 SmartStudy 智慧学习助手。';

  const parts: string[] = [base.system_role || '你是 SmartStudy 智慧学习助手。'];

  // 核心原则
  if (base.core_principles && base.core_principles.length > 0) {
    parts.push('## 核心教学原则\n');
    base.core_principles.forEach((p: string, i: number) => {
      const [title, rest] = p.split('：');
      parts.push(`${i + 1}. **${title}**：${rest || p}`);
    });
  }

  // 输出规范
  if (base.output_rules) {
    parts.push('\n## 输出规范\n');
    if (base.output_rules.latex_format) parts.push(`- LaTeX: ${base.output_rules.latex_format}`);
    if (base.output_rules.language_style) parts.push(`- 语言风格：${base.output_rules.language_style}`);
    if (base.output_rules.response_structure) parts.push(`- 回复结构：${base.output_rules.response_structure}`);
    if (base.output_rules.feedback_tone) parts.push(`- 反馈语气：${base.output_rules.feedback_tone}`);
    if (base.output_rules.length_guidance) parts.push(`- 长度控制：${base.output_rules.length_guidance}`);
  }

  // 题目边界规则
  if (base.topic_end_rules) {
    parts.push('\n## 题目边界\n');
    parts.push(`__TOPIC_END__ 标记规则（严格）:`);
    if (base.topic_end_rules.when_to_add) {
      parts.push('- **只有**当以下两种情况之一成立时，才在回答末尾单独一行加上 __TOPIC_END__：');
      base.topic_end_rules.when_to_add.forEach((rule: string) => {
        parts.push(`  - ${rule}`);
      });
    }
    if (base.topic_end_rules.when_not_to_add) {
      parts.push('- 以下情况**严禁**加 __TOPIC_END__：');
      base.topic_end_rules.when_not_to_add.forEach((rule: string) => {
        parts.push(`  - ${rule}`);
      });
    }
  }

  // 可用工具
  if (base.available_tools && base.available_tools.length > 0) {
    parts.push('\n## 可用工具\n');
    parts.push('你可以使用以下工具来辅助教学：\n');
    base.available_tools.forEach((tool: any) => {
      const toolDesc = `**${tool.name}** — ${tool.description}`;
      const whenToUse = tool.when_to_use ? `\n  - 适用场景：${tool.when_to_use}` : '';
      parts.push(`${(base.available_tools as any[]).indexOf(tool) + 1}. ${toolDesc}${whenToUse}`);
    });
  }

  // 学生心理辅导策略
  if (base.student_psychology) {
    parts.push('\n## 学生心理辅导策略\n');
    const psych = base.student_psychology;
    if (psych.low_confidence) parts.push(`- 学生缺乏信心时：${psych.low_confidence}`);
    if (psych.repeated_questions) parts.push(`- 学生反复问同一题时：${psych.repeated_questions}`);
    if (psych.overthinking) parts.push(`- 学生钻牛角尖时：${psych.overthinking}`);
    if (psych.rush_or_lazy) parts.push(`- 学生敷衍或偷懒时：${psych.rush_or_lazy}`);
    if (psych.curiosity_and_interest) parts.push(`- 学生表现出兴趣时：${psych.curiosity_and_interest}`);
  }

  return parts.join('\n');
}

const BASE_TUTOR_PROMPT = buildBaseTutorPrompt();

/**
 * 从 config.subjects 构建学科提示，提取 description 和 teaching_approach
 */
function buildSubjectPrompts(): Record<string, string> {
  const subjects = config.subjects || {};
  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(subjects)) {
    if (typeof value === 'string') {
      // 向后兼容：如果是字符串直接用
      result[key] = value;
    } else if (typeof value === 'object' && value) {
      // 新格式：对象中有 description、teaching_approach 和 common_pitfalls
      const desc = (value as any).description || '';
      const approach = (value as any).teaching_approach || '';
      const pitfalls = (value as any).common_pitfalls;
      let text = desc + (approach ? `\n${approach}` : '');
      if (Array.isArray(pitfalls) && pitfalls.length > 0) {
        text += '\n\n该学科学生常见错误:\n' + pitfalls.map((p: string) => `- ${p}`).join('\n');
      }
      result[key] = text;
    }
  }
  
  return result;
}

const SUBJECT_PROMPTS: Record<string, string> = buildSubjectPrompts() || {
  math: '【数学】侧重逻辑推导和公式运用。要求每一步都有理有据。',
  physics: '【物理】联系生活实际，用实验和现象帮助理解抽象概念。',
  chemistry: '【化学】注意实验安全和化学反应原理，用微观原理解释宏观现象。',
  english: '【英语】注重语境理解，通过例句和情景对话讲解语法和词汇。',
  chinese: '【语文】侧重文本赏析和写作手法，鼓励学生表达自己的理解。',
  history: '【历史】注重时间线和因果关系，用故事化的方式讲述历史事件。',
  geography: '【地理】善用地图和图表，将地理知识与生活场景结合。',
  biology: '【生物】从身边的生命现象入手，由浅入深讲解生命科学。',
  politics: '【道德与法治】联系社会实际，培养学生的法治意识和道德判断。',
};

export function buildSystemPrompt(config?: TutorConfig): string {
  const cfg = config || { subject: 'general', studentName: '同学' };
  const parts: string[] = [BASE_TUTOR_PROMPT];

  if (cfg.subject && SUBJECT_PROMPTS[cfg.subject]) {
    parts.push(SUBJECT_PROMPTS[cfg.subject]);
  }

  if (cfg.weakPoints && cfg.weakPoints.length > 0) {
    parts.push(
      `## 该学生薄弱点\n学生在以下知识点上需要加强：${cfg.weakPoints.join('；')}。请特别关注这些方面的讲解。`
    );
  }

  if (cfg.strengths && cfg.strengths.length > 0) {
    parts.push(
      `## 该学生优势\n学生在以下方面表现较好：${cfg.strengths.join('；')}。可以在这些基础上进一步巩固提升。`
    );
  }

  if (cfg.extraInstructions) {
    parts.push(`## 补充指令\n${cfg.extraInstructions}`);
  }

  return parts.join('\n\n');
}
