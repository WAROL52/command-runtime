import type { Runtime } from "../../runtime/runtime"
import type { CommandMeta, CommandOptionMeta as OptMeta } from "../../runtime/introspection"
import type { AITool, AIToolCall, AIToolResult } from "./types"
import type { CommandResult } from "../../contracts/command-result"

export class AIAdapter<TContext = any> {
  constructor(
    private runtime: Runtime<TContext>,
    private context: TContext
  ) {}

  toTools(): AITool[] {
    const tree = this.runtime.getCommandTree()
    const tools: AITool[] = []
    for (const cmd of tree) {
      this.flattenTools(cmd, [], tools)
    }
    return tools
  }

  async executeTool(call: AIToolCall): Promise<AIToolResult> {
    const path = call.name.split(".")
    const args = call.arguments ?? {}
    const input = args["input"]
    const optionEntries = this.toOptionEntries(args)
    const result = await this.runtime.execute(path, input, optionEntries, this.context)
    return this.toResult(result)
  }

  private flattenTools(
    meta: CommandMeta,
    parents: string[],
    acc: AITool[]
  ): void {
    const fullName = [...parents, meta.name].join(".")

    const properties: Record<string, unknown> = {}
    if (meta.input) {
      properties.input = {
        type: "string",
        description: "Command input",
      }
    }
    if (meta.options) {
      for (const opt of meta.options) {
        const prop: Record<string, unknown> = {
          type: this.inferType(opt),
          description: opt.description ?? "",
        }
        properties[opt.name] = prop
      }
    }

    acc.push({
      name: fullName,
      description: meta.description ?? "",
      inputSchema: {
        type: "object",
        properties,
        ...(Object.keys(properties).length > 0 ? {} : { additionalProperties: false }),
      },
    } satisfies AITool)

    if (meta.children) {
      for (const child of meta.children) {
        this.flattenTools(child, [...parents, meta.name], acc)
      }
    }
  }

  private inferType(opt: OptMeta): string {
    if (opt.input?.description) return opt.input.description
    return "string"
  }

  private toOptionEntries(input: Record<string, unknown>): { level: number; name: string; value: unknown }[] {
    return Object.entries(input)
      .filter(([key]) => key !== "input")
      .map(([name, value]) => ({ level: 0, name, value }))
  }

  private toResult(result: CommandResult<any>): AIToolResult {
    if (!result.success) {
      return {
        success: false,
        error: result.errors.map((e) => e.message).join("; "),
      }
    }
    return { success: true, data: result.data }
  }
}
