import type { Runtime } from "../../runtime/runtime"
import type { ParseResult } from "../../runtime/resolver"

export interface CliAdapterOptions<TContext> {
  runtime: Runtime<TContext>
  context: TContext | (() => TContext | Promise<TContext>)
  argv?: string[]
  version?: string
  out?: { log: (msg: string) => void; error: (msg: string) => void }
}

export async function runCli<TContext>(opts: CliAdapterOptions<TContext>): Promise<number> {
  const { runtime, version } = opts
  const argv = opts.argv ?? process.argv
  const stdout = opts.out?.log ?? console.log
  const stderr = opts.out?.error ?? console.error
  const context = typeof opts.context === "function"
    ? await (opts.context as () => TContext | Promise<TContext>)()
    : opts.context

  if (argv.includes("--version") || argv.includes("-V")) {
    stdout(version ?? runtime.name)
    return 0
  }

  if (argv.includes("--help") || argv.includes("-h")) {
    const path = extractPath(argv, runtime.name)
    const helpText = runtime.generateHelp(path.length > 0 ? path : undefined)
    stdout(helpText)
    return 0
  }

  const parsed = runtime.parse(argv)

  const { path, input, optionEntries } = parsed

  if (path.length === 0) {
    stdout(runtime.generateHelp())
    return 0
  }

  const result = await runtime.execute(path, input, optionEntries, context)

  if (!result.success) {
    for (const err of result.errors) {
      stderr(`[ERROR] ${err.message}`)
    }
    return 1
  }

  if (result.data !== undefined && result.data !== null) {
    stdout(JSON.stringify(result.data, null, 2))
  }

  return 0
}

function extractPath(argv: string[], programName: string): string[] {
  const path: string[] = []
  for (let i = 1; i < argv.length; i++) {
    const token = argv[i]!
    if (token === "--help" || token === "-h") break
    if (token.startsWith("-")) break
    if (token === programName) continue
    path.push(token)
  }
  return path
}
