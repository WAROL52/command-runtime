import { AIAdapter } from "./ai-adapter"
import { toOpenAITool } from "./types"
import type { Runtime } from "../../runtime/runtime"

export interface OpenAIAdapter<TContext = any> {
  tools: ReturnType<typeof toOpenAITool>[]
  executeTool(name: string, args: Record<string, unknown>): Promise<any>
}

export function createOpenAIAdapter<TContext>(
  runtime: Runtime<TContext>,
  context: TContext
): OpenAIAdapter<TContext> {
  const ai = new AIAdapter(runtime, context)

  return {
    get tools() {
      return ai.toTools().map(toOpenAITool)
    },
    async executeTool(name: string, args: Record<string, unknown>) {
      return ai.executeTool({ name, arguments: args })
    },
  }
}
