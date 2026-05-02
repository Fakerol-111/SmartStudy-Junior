export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract parameters: Record<string, any>;

  abstract execute(kwargs: Record<string, any>): Promise<string>;

  toOpenaiSpec(): Record<string, any> {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    };
  }
}

export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();

  register(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  listTools(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  toOpenaiSpecs(): Record<string, any>[] {
    return this.listTools().map((t) => t.toOpenaiSpec());
  }

  async executeTool(name: string, argumentsStr: string): Promise<string> {
    const tool = this.get(name);
    if (!tool) {
      return `错误：未知工具 '${name}'`;
    }

    try {
      const kwargs = JSON.parse(argumentsStr);
      return await tool.execute(kwargs);
    } catch (e: any) {
      return `错误：工具执行失败 — ${e.message}`;
    }
  }
}
