import type { Runtime } from "../../runtime/runtime"
import type { CommandResult } from "../../contracts/command-result"

export interface HttpRequest {
  method: string
  path: string
  body?: unknown
  headers?: Record<string, string>
}

export interface HttpResponse {
  status: number
  body: unknown
  headers?: Record<string, string>
}

export interface HttpAdapterOptions<TContext> {
  runtime: Runtime<TContext>
  context: TContext | (() => TContext | Promise<TContext>)
  pathPrefix?: string
  parsePath?: (request: HttpRequest) => string[]
  parseInput?: (request: HttpRequest) => unknown
}

export async function handleHttp<TContext>(
  request: HttpRequest,
  opts: HttpAdapterOptions<TContext>
): Promise<HttpResponse> {
  const { runtime, pathPrefix = "/commands/" } = opts
  const context = typeof opts.context === "function"
    ? await (opts.context as () => TContext | Promise<TContext>)()
    : opts.context

  const path = opts.parsePath
    ? opts.parsePath(request)
    : defaultParsePath(request.path, pathPrefix)

  const input = opts.parseInput
    ? opts.parseInput(request)
    : defaultParseInput(request)

  if (path.length === 0) {
    return {
      status: 400,
      body: { success: false, errors: [{ message: "No command specified in path" }] },
    }
  }

  const result = await runtime.execute(path, input, [], context)

  return formatResult(result)
}

function defaultParsePath(urlPath: string, prefix: string): string[] {
  let p = urlPath.split("?")[0] ?? urlPath
  if (p.startsWith(prefix)) {
    p = p.slice(prefix.length)
  }
  if (p.startsWith("/")) {
    p = p.slice(1)
  }
  p = p.replace(/\/+$/, "")
  if (!p) return []
  return p.split("/").filter(Boolean)
}

function defaultParseInput(request: HttpRequest): unknown {
  return request.body
}

function formatResult(result: CommandResult<any>): HttpResponse {
  if (!result.success) {
    return {
      status: 400,
      body: result,
    }
  }
  return {
    status: 200,
    body: result,
  }
}
