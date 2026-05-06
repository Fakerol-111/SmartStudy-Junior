import type { DeepSeekConfig, Intent, RouterResult, Message, ApiComponent } from './types';
import { DeepSeekClient } from './deepseek';
import prompts from '../../prompts/instructions.json';

const ROUTER_PROMPT = prompts.router.system_prompt.join('\n');

export class Router {
  private client: DeepSeekClient;

  constructor(config: DeepSeekConfig, component: ApiComponent = 'router') {
    this.client = new DeepSeekClient(config, component);
  }

  async route(
    input: string,
    currentSubject: string,
    hasHistory: boolean,
    signal?: AbortSignal,
  ): Promise<RouterResult> {
    const contextHint = hasHistory
      ? `\n(当前学科: ${currentSubject}，对话有历史记录)`
      : '\n(新对话，无历史记录)';

    const messages: Message[] = [
      { role: 'system', content: ROUTER_PROMPT },
      { role: 'user', content: input + contextHint },
    ];

    try {
      const { message } = await this.client.chatCompletion(messages, undefined, 0.3, 512, signal);
      const text = message.content.trim();
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          intent: this.validateIntent(parsed.intent),
          subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [currentSubject],
          newTopic: !!parsed.newTopic,
          targetHandler: parsed.intent === 'verify' ? 'verify'
            : parsed.intent === 'concept' ? 'concept'
            : parsed.intent === 'review' ? 'review'
            : parsed.intent === 'correct' ? 'correct'
            : parsed.intent === 'feedback' ? 'feedback'
            : 'teach',
          confidence: 1,
        };
      }
    } catch {
      // Fall through to default
    }

    // Fallback: treat as teach
    return {
      intent: 'teach',
      subjects: [currentSubject],
      newTopic: false,
      targetHandler: 'teach',
      confidence: 0.5,
    };
  }

  private validateIntent(intent: string): Intent {
    const valid: Intent[] = ['teach', 'verify', 'concept', 'review', 'correct', 'feedback', 'unknown'];
    return valid.includes(intent as Intent) ? intent as Intent : 'unknown';
  }
}
