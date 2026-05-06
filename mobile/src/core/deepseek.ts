import type { DeepSeekConfig, Message, ToolCall, ApiComponent } from './types';
import { apiUsageTracker } from './apiUsageTracker';

export class DeepSeekClient {
  private config: DeepSeekConfig;
  private component: ApiComponent;

  constructor(config: DeepSeekConfig, component: ApiComponent = 'handler') {
    this.config = config;
    this.component = component;
  }

  async chatCompletion(
    messages: Message[],
    tools?: any[],
    temperature = 0.7,
    maxTokens = 4096,
    signal?: AbortSignal,
  ): Promise<{ message: Message; toolCalls: ToolCall[] }> {
    const body: any = {
      model: this.config.model,
      messages: messages.map((m) => {
        const base: any = { role: m.role, content: m.content };
        if (m.tool_call_id) base.tool_call_id = m.tool_call_id;
        if (m.reasoning_content) base.reasoning_content = m.reasoning_content;
        if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
          base.tool_calls = m.tool_calls.map((tc) => ({
            id: tc.id,
            type: tc.type,
            function: tc.function,
          }));
        }
        return base;
      }),
      stream: false,
      temperature,
      max_tokens: maxTokens,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch(
      `${this.config.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API 错误 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    const msg = choice.message;

    // Track API usage (fire-and-forget)
    const usage = data.usage;
    if (usage) {
      apiUsageTracker.record({
        model: this.config.model,
        component: this.component,
        promptTokens: usage.prompt_tokens ?? 0,
        completionTokens: usage.completion_tokens ?? 0,
        totalTokens: usage.total_tokens ?? 0,
      });
    }

    const toolCalls: ToolCall[] = (msg.tool_calls || []).map((tc: any) => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));

    const assistantMessage: Message = {
      role: 'assistant',
      content: msg.content || '',
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    };
    if (msg.reasoning_content) {
      assistantMessage.reasoning_content = msg.reasoning_content;
    }

    return { message: assistantMessage, toolCalls };
  }
}
