import type { CommandInterface } from "../core/command"

export interface NextChildNode<TInput = unknown, TContext = any> {
  child: CommandInterface<any, TInput, any, TContext>
  nextChild: () => NextChildNode<TInput, TContext> | null
}

export interface ExecCmdOption<TInput = unknown, TContext = any> {
  input: TInput
  context: TContext
  nextChild: () => NextChildNode<TInput, TContext> | null
}

export interface ExecSubCmdOption<
  TChild extends CommandInterface,
  TInput = unknown,
  TContext = any
> {
  child: TChild
  input: TInput
  context: TContext
  nextChild: () => NextChildNode<TInput, TContext> | null
}
