import type { CommandResult } from "./command-result"

export interface Middleware<TInput = unknown, TOutput = unknown, TContext = any> {
  name: string
  handle(
    input: TInput,
    context: TContext,
    next: (input: TInput, context: TContext) => Promise<CommandResult<TOutput>>
  ): Promise<CommandResult<TOutput>>
}
