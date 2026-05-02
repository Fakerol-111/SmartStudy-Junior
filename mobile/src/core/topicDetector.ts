import type { DeepSeekConfig, Message } from './types';
import { DeepSeekClient } from './deepseek';
import prompts from '../../prompts/instructions.json';

export interface TopicResult {
  topicChanged: boolean;
  newSubject?: string;
  /** User indicates the previous topic wasn't finished — restore archived conversation */
  restorePrevious?: boolean;
}

const PROMPT = prompts.topicDetector.system_prompt.join('\n');

export class TopicDetector {
  private client: DeepSeekClient;

  constructor(config: DeepSeekConfig) {
    this.client = new DeepSeekClient(config);
  }

  async detect(
    newMessage: string,
    conversationHistory: Message[],
    currentSubject: string,
    signal?: AbortSignal,
  ): Promise<TopicResult> {
    // Only use dialogue messages, no system prompts
    const dialogue = conversationHistory.filter(
      (m) => m.role === 'user' || m.role === 'assistant',
    );

    const messages: Message[] = [
      { role: 'system', content: PROMPT },
      ...dialogue,
      {
        role: 'user',
        content: `[当前科目:${currentSubject}]\n最新消息:${newMessage}`,
      },
    ];

    try {
      const { message } = await this.client.chatCompletion(
        messages,
        undefined,
        0.2,
        128,
        signal,
      );
      const text = message.content.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const restorePrevious = !!parsed.restorePrevious;
        return {
          topicChanged: restorePrevious ? false : !!parsed.topicChanged,
          newSubject:
            typeof parsed.newSubject === 'string'
              ? parsed.newSubject
              : undefined,
          restorePrevious,
        };
      }
    } catch {
      // Fall through to default
    }

    // Default: conservative — assume same topic
    return { topicChanged: false };
  }
}
