import { BaseTool } from './registry';

export class Plotter extends BaseTool {
  name = 'plotter';
  description = '绘制数学函数图像。返回函数的关键点和特征描述。';
  parameters = {
    type: 'object',
    properties: {
      expr: {
        type: 'string',
        description: '函数表达式，如 "x^2", "sin(x)", "x^3 - 2*x"',
      },
      x_range: {
        type: 'array',
        description: 'x 轴范围，如 [-10, 10]',
        items: { type: 'number' },
        minItems: 2,
        maxItems: 2,
      },
    },
    required: ['expr'],
  };

  async execute(kwargs: Record<string, any>): Promise<string> {
    const expr = (kwargs.expr || '').trim();
    if (!expr) {
      return '请提供函数表达式';
    }

    // Generate key points/description of the function
    // (Actual SVG rendering will be done on the frontend side)
    const points = this.analyzeFunction(expr);
    return points;
  }

  private analyzeFunction(expr: string): string {
    // Simple analysis of the function
    const lines: string[] = [];
    lines.push(`**函数**: y = ${expr}`);
    lines.push('');
    lines.push('函数分析:');
    lines.push('- 这是一个一元函数');
    lines.push('- 建议在绘图组件中查看图像');

    // Try to find some basic properties
    if (expr.includes('sin') || expr.includes('cos')) {
      lines.push('- 周期函数');
    } else if (expr.includes('^2')) {
      lines.push('- 二次函数');
    } else if (expr.includes('^3')) {
      lines.push('- 三次函数');
    }

    return lines.join('\n');
  }
}
