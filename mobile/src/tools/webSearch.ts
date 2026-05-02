import { BaseTool } from './registry';

export class WebSearch extends BaseTool {
  name = 'web_search';
  description = '搜索互联网获取最新信息。当遇到不确定的实时信息、最新政策、教材版本差异时使用。';
  parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词，建议用中文',
      },
    },
    required: ['query'],
  };

  async execute(kwargs: Record<string, any>): Promise<string> {
    const query = (kwargs.query || '').trim();
    if (!query) {
      return '请提供搜索关键词';
    }

    try {
      return await this.searchDuckDuckGo(query);
    } catch (e: any) {
      return `搜索失败: ${e.message}`;
    }
  }

  private async searchDuckDuckGo(query: string): Promise<string> {
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );

    if (!response.ok) {
      throw new Error(`搜索服务错误 (${response.status})`);
    }

    const data = await response.json();
    const results: string[] = [];

    if (data.AbstractText) {
      results.push(`**摘要**: ${data.AbstractText}`);
    }

    if (data.AbstractURL) {
      results.push(`**来源**: ${data.AbstractURL}`);
    }

    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 5)) {
        if (topic.Text) {
          results.push(`- ${topic.Text}`);
        }
      }
    }

    if (results.length === 0) {
      return `没有找到关于「${query}」的搜索结果，请换个关键词试试。`;
    }

    return results.join('\n\n');
  }
}
