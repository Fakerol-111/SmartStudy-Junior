import prompts from '../../prompts/instructions.json';
import { apiUsageTracker } from './apiUsageTracker';

function trackOcrUsage(data: any, component: 'ocr' | 'multimodal'): void {
  const usage = data.usage;
  if (!usage) return;
  // DashScope uses input_tokens/output_tokens; OpenAI uses prompt_tokens/completion_tokens
  apiUsageTracker.record({
    model: OCR_CONFIG.model,
    component,
    promptTokens: usage.input_tokens ?? usage.prompt_tokens ?? 0,
    completionTokens: usage.output_tokens ?? usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  });
}

const OCR_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_OCR_API_KEY || '',
  baseUrl: process.env.EXPO_PUBLIC_OCR_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model: process.env.EXPO_PUBLIC_OCR_MODEL || 'qwen-vl-plus',
};

export interface OcrResult {
  text: string;
  isTakeover: boolean;
}

/** Single image analysis — AI extracts text or takes over */
export async function analyzeImage(base64: string, signal?: AbortSignal): Promise<OcrResult> {
  const { apiKey, baseUrl, model } = OCR_CONFIG;
  if (!apiKey) {
    return {
      text: 'OCR API 未配置。请在 .env 中设置 EXPO_PUBLIC_OCR_API_KEY。',
      isTakeover: false,
    };
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompts.multimodal.analysis_prompt,
            },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          ],
        },
      ],
      max_tokens: 4096,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { text: `OCR API 错误 (${response.status}): ${errorText}`, isTakeover: false };
  }

  const data = await response.json();
  trackOcrUsage(data, 'ocr');
  const content = data.choices?.[0]?.message?.content || '';

  if (content.startsWith('【解答】')) {
    return { text: content.replace('【解答】', '').trim(), isTakeover: true };
  }
  if (content.startsWith('【OCR结果】')) {
    return { text: content.replace('【OCR结果】', '').trim(), isTakeover: false };
  }
  return { text: content, isTakeover: false };
}

/** Full conversation with the multimodal model (for takeover mode) */
export async function multimodalChat(
  history: { role: string; content: string }[],
  imageBase64?: string,
  signal?: AbortSignal,
): Promise<string> {
  const { apiKey, baseUrl, model } = OCR_CONFIG;

  const messages: any[] = [
    {
      role: 'system',
      content:
        prompts.multimodal.chat_system_prompt.join('\n'),
    },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  // If there's an image, attach it to the last user message
  if (imageBase64 && messages.length > 0) {
    const last = messages[messages.length - 1];
    if (last.role === 'user') {
      last.content = [
        { type: 'text', text: last.content },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
      ];
    }
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 4096,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    return `多模态模型请求失败: ${errorText}`;
  }

  const data = await response.json();
  trackOcrUsage(data, 'multimodal');
  return data.choices?.[0]?.message?.content || '（无响应）';
}
