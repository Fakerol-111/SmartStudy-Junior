import { BaseTool } from './registry';

// Safe subset of mathjs for middle school math
import {
  abs,
  add,
  cos,
  derivative,
  divide,
  evaluate,
  exp,
  factorial,
  format,
  gcd,
  lcm,
  log,
  multiply,
  parse,
  pi,
  pow,
  round,
  sin,
  simplify,
  sqrt,
  subtract,
  tan,
} from 'mathjs';

export class Calculator extends BaseTool {
  name = 'calculator';
  description = '执行数学计算，包括代数运算、解方程、化简、求导等。支持数学表达式。';
  parameters = {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: '数学表达式，如 "2 + 3*5", "sin(pi/2)", "derivative(x^2, x)" 等',
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
      const result = this.safeEvaluate(expression);
      const formatted = typeof result === 'number'
        ? format(result, { precision: 14 })
        : String(result);
      return `**表达式**: ${expression}\n**结果**: ${formatted}`;
    } catch (e: any) {
      return `计算错误: ${e.message}`;
    }
  }

  private safeEvaluate(expr: string): any {
    const lower = expr.toLowerCase();

    // derivative(x^2, x) -> 2x
    if (lower.startsWith('derivative(') || lower.startsWith('diff(')) {
      return this.handleDerivative(expr);
    }

    // simplify(...)
    if (lower.startsWith('simplify(')) {
      const inner = expr.slice(expr.indexOf('(') + 1, expr.lastIndexOf(')'));
      return simplify(inner).toString();
    }

    // factor(...) - use simplify
    if (lower.startsWith('factor(')) {
      return `因式分解: ${simplify(expr.slice(expr.indexOf('(') + 1, expr.lastIndexOf(')'))).toString()}`;
    }

    // General evaluation
    try {
      const result = evaluate(expr, {
        pi,
        sin,
        cos,
        tan,
        sqrt,
        log,
        exp,
        abs,
        factorial,
        gcd,
        lcm,
      });
      return result;
    } catch {
      // Try symbolic evaluation
      try {
        const node = parse(expr);
        return node.toString();
      } catch {
        throw new Error(`无法计算表达式: ${expr}`);
      }
    }
  }

  private handleDerivative(expr: string): string {
    const inner = expr.slice(expr.indexOf('(') + 1, expr.lastIndexOf(')'));
    const parts = splitArgs(inner);
    if (parts.length >= 2) {
      const result = derivative(parts[0], parts[1]);
      return result.toString();
    }
    throw new Error('求导需要两个参数: derivative(表达式, 变量)');
  }
}

function splitArgs(s: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current: string[] = [];
  for (const ch of s) {
    if ('([{'.includes(ch)) { depth++; current.push(ch); }
    else if (')]}'.includes(ch)) { depth--; current.push(ch); }
    else if (ch === ',' && depth === 0) {
      args.push(current.join('').trim());
      current = [];
    } else {
      current.push(ch);
    }
  }
  if (current.length > 0) args.push(current.join('').trim());
  return args;
}
