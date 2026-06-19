export interface CommandError {
  message: string
  path?: (string | number)[]
  code?: string
}

export type CommandResult<T> =
  | { success: true; data: T }
  | { success: false; errors: CommandError[] }
