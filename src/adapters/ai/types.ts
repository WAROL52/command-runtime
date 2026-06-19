export interface AITool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface AIToolCall {
  name: string
  arguments: Record<string, unknown>
}

export interface AIToolResult {
  success: boolean
  data?: unknown
  error?: string
}

export function toOpenAITool(tool: AITool): Record<string, unknown> {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }
}

export function toMCPTool(tool: AITool): Record<string, unknown> {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }
}
