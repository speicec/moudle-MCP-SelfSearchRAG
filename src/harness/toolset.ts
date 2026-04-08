/**
 * @spec harness.md#工具集管理
 * @layer 5
 * @description 工具集管理实现
 */

import type { ToolsetManager, ToolDefinition } from './interface';

export class DefaultToolsetManager implements ToolsetManager {
  private tools: Map<string, ToolDefinition> = new Map();
  private groups: Map<string, Set<string>> = new Map();

  registerTool(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} already registered`);
    }

    this.tools.set(tool.name, tool);

    if (tool.group) {
      if (!this.groups.has(tool.group)) {
        this.groups.set(tool.group, new Set());
      }
      this.groups.get(tool.group)!.add(tool.name);
    }
  }

  unregisterTool(name: string): void {
    const tool = this.tools.get(name);
    if (tool) {
      if (tool.group) {
        this.groups.get(tool.group)?.delete(name);
      }
      this.tools.delete(name);
    }
  }

  getTool(name: string): ToolDefinition | null {
    return this.tools.get(name) || null;
  }

  getToolsByGroup(group: string): ToolDefinition[] {
    const toolNames = this.groups.get(group);
    if (!toolNames) return [];

    return Array.from(toolNames)
      .map(name => this.tools.get(name))
      .filter((t): t is ToolDefinition => t !== undefined);
  }

  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  async executeTool(name: string, input: unknown): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    if (tool.dependencies) {
      for (const dep of tool.dependencies) {
        if (!this.tools.has(dep)) {
          throw new Error(`Tool ${name} depends on ${dep}, which is not registered`);
        }
      }
    }

    return tool.handler(input);
  }

  getGroups(): string[] {
    return Array.from(this.groups.keys());
  }

  getStats(): {
    totalTools: number;
    totalGroups: number;
    toolsByGroup: Record<string, number>;
  } {
    const toolsByGroup: Record<string, number> = {};

    for (const [group, tools] of this.groups) {
      toolsByGroup[group] = tools.size;
    }

    return {
      totalTools: this.tools.size,
      totalGroups: this.groups.size,
      toolsByGroup
    };
  }
}