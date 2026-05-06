import { evaluate, format } from 'mathjs';
import { BaseTool } from './registry';

export class Calculator extends BaseTool {
  name = 'calculator';
  description = '进行数学计算，包括算术、代数、三角函数、求导、积分等。适合验证答案、快速计算、解方程。';
  parameters = {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: '数学表达式，如 "sqrt(16)", "3! + 5*2", "sin(pi/4)", "2^10", "integrate(x^2, x)"',
      },
    },
    required: ['expression'],
  };

  async execute(kwargs: Record<string, any>): Promise<string> {
    const expression = (kwargs.expression || '').trim();
    if (!expression) {
      return '请提供数学表达式';
    }

    try {
      const result = evaluate(expression);

      if (typeof result === 'number' || typeof result === 'bigint') {
        return `\`${expression} = ${format(result, { precision: 14 })}\``;
      }

      if (typeof result === 'object' && result !== null) {
        const str = result.toString();
        if (str === '[object Object]') {
          return `\`${expression} = ${JSON.stringify(result)}\``;
        }
        return `\`${expression} = ${str}\``;
      }

      return `\`${expression} = ${String(result)}\``;
    } catch (e: any) {
      return `计算错误: ${e.message}。请检查表达式语法是否正确。`;
    }
  }
}
