import type { DeepSeekConfig, ReviewResult, Message, ApiComponent } from './types';
import { DeepSeekClient } from './deepseek';
import prompts from '../../prompts/instructions.json';

const REVIEWER_PROMPT = prompts.reviewer.system_prompt.join('\n');

export class Reviewer {
  private client: DeepSeekClient;

  constructor(config: DeepSeekConfig, component: ApiComponent = 'reviewer') {
    this.client = new DeepSeekClient(config, component);
  }

  async review(
    studentInput: string,
    teacherResponse: string,
    subject: string,
    blacklist: string[] = [],
    signal?: AbortSignal,
  ): Promise<ReviewResult> {
    const blacklistHint = blacklist.length > 0
      ? `\n以下知识点已被学生标记为超纲，如果涉及请直接判为超纲: ${blacklist.join('、')}`
      : '';

    const messages: Message[] = [
      { role: 'system', content: REVIEWER_PROMPT },
      {
        role: 'user',
        content: `学科: ${subject}\n学生提问: ${studentInput}\nAI 老师的回答: ${teacherResponse}${blacklistHint}`,
      },
    ];

    try {
      const { message } = await this.client.chatCompletion(messages, undefined, 0.3, 1024, signal);
      const text = message.content.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          passed: !!parsed.passed,
          issues: Array.isArray(parsed.issues) ? parsed.issues : [],
          suggestion: parsed.suggestion || '',
          upgradeRequired: !parsed.passed,
        };
      }
    } catch {
      // Fall through to pass
    }

    return { passed: true, issues: [], suggestion: '' };
  }
}
