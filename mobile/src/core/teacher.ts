import config from '../../prompts/config.json';
import type { HandlerContext, HarnessEvent, HarnessStage, Message } from './types';
import { DeepSeekClient } from './deepseek';
import { buildSystemPrompt } from './systemPrompt';
import { ToolRegistry } from '../tools/registry';

/**
 * 从 config.intents 中提取指令和进度消息
 */
function buildIntentInstructions(): Record<string, string> {
  const intents = config.intents || {};
  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(intents)) {
    if (typeof value === 'string') {
      // 向后兼容：如果是字符串直接用
      result[key] = value;
    } else if (typeof value === 'object' && value) {
      // 新格式：对象中有 description 和 approach
      const intentObj = value as any;
      const desc = intentObj.description || '';
      const approach = intentObj.approach;
      
      if (Array.isArray(approach)) {
        // 如果 approach 是数组，用序号列出
        result[key] = desc + '\n\n' + approach.map((a: string, i: number) => `${i + 1}. ${a}`).join('\n\n');
      } else if (approach) {
        result[key] = desc + '\n\n' + approach;
      } else {
        result[key] = desc;
      }
    }
  }
  
  return result;
}

/**
 * 从 config.intents 中提取进度消息
 */
function buildIntentProgress(): Record<string, string> {
  const intents = config.intents || {};
  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(intents)) {
    if (typeof value === 'object' && value && typeof (value as any).progress_message === 'string') {
      result[key] = (value as any).progress_message;
    }
  }
  
  return result;
}

const INTENT_INSTRUCTIONS: Record<string, string> = buildIntentInstructions() || {
  teach: '学生需要你讲解题目。用苏格拉底式引导，分步启发，多提问少给答案。',
  verify: '学生要你判断他的答案是否正确。先判断对错，正确就肯定，错误就指出错在哪里并引导他纠正。',
  concept: '学生想理解一个概念。用通俗易懂的方式解释，多举生活例子。',
  review: '学生想复习或练习。出几道题考查他，根据他的回答给予反馈。',
  correct: '学生指出你讲错了。先承认错误，感谢指正，再重新给出正确的解答。',
  feedback: '学生对教学方式有意见。认真对待反馈，调整回应方式。回答要诚恳简短。',
};

const INTENT_PROGRESS: Record<string, string> = buildIntentProgress() || {
  teach: '让老师想想怎么讲……',
  verify: '让老师看看你算得对不对……',
  concept: '让老师想想怎么解释……',
  review: '老师来考考你……',
  correct: '老师看看哪里讲错了……',
  feedback: '老师知道了……',
};

/** Intents that may use tools (calculator, web search) */
const TOOL_ENABLED_INTENTS = new Set(['teach', 'verify', 'concept', 'review']);

export class Teacher {
  readonly name = 'teacher';
  private client: DeepSeekClient;
  private registry: ToolRegistry;

  constructor(client: DeepSeekClient, registry: ToolRegistry) {
    this.client = client;
    this.registry = registry;
  }

  async *execute(context: HandlerContext, signal?: AbortSignal): AsyncGenerator<HarnessEvent> {
    const { intent, subjects, subject, studentProfile, studentName, isContinuation } = context;

    // Progress message
    const progressMsg = isContinuation
      ? '继续讲……'
      : (INTENT_PROGRESS[intent] || '让老师想想……');
    yield { type: 'progress', stage: intent as HarnessStage, message: progressMsg, intent, subjects };

    // Parse profile
    let weakPoints: string[] | undefined;
    let strengths: string[] | undefined;
    if (studentProfile) {
      try {
        const p = JSON.parse(studentProfile);
        if (Array.isArray(p.weakPoints)) weakPoints = p.weakPoints;
        if (Array.isArray(p.strengths)) strengths = p.strengths;
      } catch { /* ignore invalid JSON */ }
    }

    // Build system prompt + intent instruction
    const basePrompt = buildSystemPrompt({ subject, studentName, weakPoints, strengths });
    const intentInstruction = INTENT_INSTRUCTIONS[intent] || INTENT_INSTRUCTIONS.teach;
    const sysPrompt = `${basePrompt}\n\n## 当前任务\n${intentInstruction}`;

    const history: Message[] = [
      { role: 'system', content: sysPrompt },
      ...context.history,
    ];

    // Call AI (with tools for applicable intents)
    const tools = TOOL_ENABLED_INTENTS.has(intent) ? this.registry.toOpenaiSpecs() : undefined;
    const { message: response, toolCalls } = await this.client.chatCompletion(
      history,
      tools,
      0.7,
      4096,
      signal,
    );

    // Handle tool calls if any
    if (toolCalls && toolCalls.length > 0) {
      for (const tc of toolCalls) {
        yield { type: 'tool_call', tool_name: tc.function.name, arguments: tc.function.arguments };
        const toolResult = await this.registry.executeTool(tc.function.name, tc.function.arguments);
        yield { type: 'tool_result', tool_name: tc.function.name, result: toolResult };
        history.push({ role: 'assistant', content: response.content, tool_calls: [tc] });
        history.push({ role: 'tool', content: toolResult, tool_call_id: tc.id });
      }

      const final = await this.client.chatCompletion(history, this.registry.toOpenaiSpecs(), 0.7, 4096, signal);
      const content = final.message.content || '';
      if (content) yield { type: 'delta', content };
      yield { type: 'done', history: [...history, final.message] };
      return;
    }

    // Direct response (no tool calls)
    const content = response.content || '';
    yield { type: 'delta', content };
    yield { type: 'done', history: [...history, response] };
  }
}
